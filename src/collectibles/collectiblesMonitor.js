import crypto from 'node:crypto';
import { fetchCollectibles } from './collectiblesFetcher.js';
import { parseCollectibles } from './collectiblesParser.js';
import { buildCollectiblesNotifications, getPayloadDiagnostics } from './collectiblesNotificationBuilder.js';
import { CollectibleRelease } from '../database/models/CollectibleRelease.js';
import { logger } from '../utils/logger.js';

const CHANNEL_ID = '1537724207507570739';

const extractCollectibleCategorySkuId = (message) => {
  const markerRegex = /collectible-release:(\d+):part:(\d+)/;
  
  if (message.components) {
    const str = JSON.stringify(message.components);
    const match = str.match(markerRegex);
    if (match) {
      return { categorySkuId: match[1], partIndex: parseInt(match[2], 10) };
    }
  }
  
  // Fallback to checking embeds or content if somehow placed there
  const str = JSON.stringify(message);
  const match = str.match(markerRegex);
  if (match) {
    return { categorySkuId: match[1], partIndex: parseInt(match[2], 10) };
  }
  
  return null;
};

const createItemsHash = (items) => {
  const sortedItems = [...items].sort((a, b) => a.skuId.localeCompare(b.skuId));
  const hashObjects = sortedItems.map(item => ({
    skuId: item.skuId,
    name: item.name,
    type: item.type,
    asset: item.asset,
    regularPrice: item.regularPrice,
    nitroPrice: item.nitroPrice,
    orbPrice: item.orbPrice,
    shopUrl: item.shopUrl
  }));

  const stableStringify = (obj) => {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      return `[${obj.map(item => stableStringify(item)).join(',')}]`;
    }
    const sortedKeys = Object.keys(obj).sort();
    return `{${sortedKeys.map(k => `"${k}":${stableStringify(obj[k])}`).join(',')}}`;
  };

  const jsonString = stableStringify(hashObjects);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
};

export const syncCollectibles = async (client) => {
  try {
    let rawData;
    try {
      rawData = await fetchCollectibles();
      if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        throw new Error('Empty or malformed releases list.');
      }
    } catch (e) {
      logger.error(`COLLECTIBLES_API_UNSAFE_FOR_RECONCILIATION: ${e.message}`);
      return;
    }

    const releases = parseCollectibles(rawData);
    
    // Safety check against suspicious drop
    const dbCount = await CollectibleRelease.countDocuments();
    if (dbCount > 0 && releases.length < dbCount * 0.5) {
      logger.error(`COLLECTIBLES_API_UNSAFE_FOR_RECONCILIATION: Suspicious drop in API releases (got ${releases.length}, expected near ${dbCount})`);
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) throw new Error(`Channel ${CHANNEL_ID} not found`);

    const channelMessages = await channel.messages.fetch({ limit: 100 });
    const existingMessages = new Map();
    
    let stats = { 
        recentDetected: 0, 
        created: 0, 
        updated: 0, 
        skipped: 0, 
        historicalSkipped: 0, 
        duplicatesDeleted: 0, 
        itemsOmitted: 0, 
        maxComponents: 0, 
        errors: 0 
    };
    
    for (const [id, msg] of channelMessages) {
      if (msg.author.id !== client.user.id) continue;
      
      const marker = extractCollectibleCategorySkuId(msg);
      if (!marker) continue; // Unrelated message
      
      const { categorySkuId, partIndex } = marker;
      if (!existingMessages.has(categorySkuId)) {
        existingMessages.set(categorySkuId, new Map());
      }
      
      const partsMap = existingMessages.get(categorySkuId);
      if (!partsMap.has(partIndex)) {
        partsMap.set(partIndex, []);
      }
      partsMap.get(partIndex).push(msg);
    }
    
    // Prune Duplicates safely
    for (const [categorySkuId, partsMap] of existingMessages) {
       for (const [partIndex, msgs] of partsMap) {
          if (msgs.length > 1) {
             msgs.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
             const canonical = msgs[0];
             const duplicates = msgs.slice(1);
             for (const dup of duplicates) {
                 logger.info(`[Collectibles] Deleting duplicate chunk ${partIndex} for ${categorySkuId}`);
                 await dup.delete();
                 stats.duplicatesDeleted++;
             }
             partsMap.set(partIndex, [canonical]);
          }
       }
    }

    for (const release of releases) {
      const itemsHash = createItemsHash(release.items);
      let existing = await CollectibleRelease.findOne({ categorySkuId: release.categorySkuId });

      if (release.classification === 'historical') {
         if (!existing) {
            await CollectibleRelease.create({
              categorySkuId: release.categorySkuId,
              name: release.name,
              bannerUrl: release.bannerUrl,
              items: release.items,
              itemsHash,
              messageIds: [],
              chunkCount: 0,
              channelId: CHANNEL_ID,
              status: 'baseline'
            });
         }
         stats.historicalSkipped++;
         continue; // Historical -> NEVER announce
      }
      
      if (release.classification !== 'recent') continue;
      
      stats.recentDetected++;

      const payloads = buildCollectiblesNotifications(release);
      const diagnostics = getPayloadDiagnostics(payloads, release);
      
      stats.itemsOmitted += diagnostics.itemsOmitted;
      for (const p of payloads) {
          const cCount = p.components[0]?.components?.length || 0;
          if (cCount > stats.maxComponents) stats.maxComponents = cCount;
      }
      
      if (diagnostics.itemsOmitted > 0) throw new Error(`HARD SAFETY ABORT: Omitted items for ${release.categorySkuId}`);
      for (const p of payloads) if ((p.components[0]?.components?.length || 0) > 40) throw new Error(`HARD SAFETY ABORT: >40 components for ${release.categorySkuId}`);
      
      const partsMap = existingMessages.get(release.categorySkuId) || new Map();
      
      let needsCreate = false;
      let needsUpdate = false;
      let missingChunks = [];
      let extraChunks = [];
      
      if (!existing) {
         if (partsMap.size > 0) {
            // Recent release exists in Discord but not in DB -> Baseline state
            const sentMsgIds = [];
            for (let i = 0; i < payloads.length; i++) {
               const msgs = partsMap.get(i);
               if (msgs && msgs.length > 0) sentMsgIds.push(msgs[0].id);
            }
            existing = await CollectibleRelease.create({
              categorySkuId: release.categorySkuId,
              name: release.name,
              bannerUrl: release.bannerUrl,
              items: release.items,
              itemsHash,
              messageIds: sentMsgIds,
              chunkCount: payloads.length,
              channelId: CHANNEL_ID,
              status: 'published'
            });
         } else {
            needsCreate = true;
         }
      }
      
      if (existing) {
         if (existing.itemsHash !== itemsHash) {
            needsUpdate = true;
         } else {
            for (let i = 0; i < payloads.length; i++) {
               if (!partsMap.has(i) || partsMap.get(i).length === 0) missingChunks.push(i);
            }
            for (const [partIndex, msgs] of partsMap) {
               if (partIndex >= payloads.length && msgs.length > 0) extraChunks.push(msgs[0]);
            }
         }
      }

      const finalMessageIds = [];

      if (needsCreate) {
         for (let i = 0; i < payloads.length; i++) {
            const msg = await channel.send(payloads[i]);
            finalMessageIds.push(msg.id);
            if (msg.crosspostable) await msg.crosspost();
         }
         await CollectibleRelease.create({
            categorySkuId: release.categorySkuId,
            name: release.name,
            bannerUrl: release.bannerUrl,
            items: release.items,
            itemsHash,
            messageIds: finalMessageIds,
            chunkCount: payloads.length,
            channelId: CHANNEL_ID,
            status: 'published'
         });
         stats.created++;
      } else if (needsUpdate) {
         for (let i = 0; i < payloads.length; i++) {
            const existingMsg = partsMap.has(i) && partsMap.get(i).length > 0 ? partsMap.get(i)[0] : null;
            if (existingMsg) {
               const updated = await existingMsg.edit(payloads[i]);
               finalMessageIds.push(updated.id);
            } else {
               const newMsg = await channel.send(payloads[i]);
               finalMessageIds.push(newMsg.id);
               if (newMsg.crosspostable) await newMsg.crosspost();
            }
         }
         for (const [partIndex, msgs] of partsMap) {
            if (partIndex >= payloads.length && msgs.length > 0) await msgs[0].delete();
         }
         existing.itemsHash = itemsHash;
         existing.items = release.items;
         existing.messageIds = finalMessageIds;
         existing.chunkCount = payloads.length;
         await existing.save();
         stats.updated++;
      } else if (missingChunks.length > 0 || extraChunks.length > 0) {
         for (let i = 0; i < payloads.length; i++) {
            if (missingChunks.includes(i)) {
               const msg = await channel.send(payloads[i]);
               if (msg.crosspostable) await msg.crosspost();
               finalMessageIds.push(msg.id);
            } else {
               const existingMsg = partsMap.get(i)[0];
               finalMessageIds.push(existingMsg.id);
            }
         }
         for (const msg of extraChunks) await msg.delete();
         existing.messageIds = finalMessageIds;
         existing.chunkCount = payloads.length;
         await existing.save();
         stats.updated++;
      } else {
         stats.skipped++;
      }
    }
    
    logger.info(`
COLLECTIBLES PRODUCTION SYNC

Recent releases detected: ${stats.recentDetected}
Created: ${stats.created}
Updated: ${stats.updated}
Skipped: ${stats.skipped}
Historical skipped: ${stats.historicalSkipped}
Duplicates deleted: ${stats.duplicatesDeleted}
Items omitted: ${stats.itemsOmitted}
Maximum components: ${stats.maxComponents}
Errors: ${stats.errors}
`);
    
  } catch (error) {
    logger.error(`[Collectibles] Fatal error during sync: ${error.message}`);
  }
};

let collectiblesInterval = null;

export const startCollectiblesMonitor = async (client) => {
  logger.info('[Collectibles] Starting monitor...');
  
  try {
     await syncCollectibles(client);
  } catch (err) {
     logger.error(`[Collectibles] Initial sync error: ${err.message}`);
  }
  
  collectiblesInterval = setInterval(() => {
    syncCollectibles(client).catch(err => {
      logger.error(`[Collectibles] Interval error: ${err.message}`);
    });
  }, 15 * 60 * 1000);
};

export const stopCollectiblesMonitor = () => {
  if (collectiblesInterval) {
    clearInterval(collectiblesInterval);
    collectiblesInterval = null;
    logger.info('[Collectibles] Monitor stopped');
  }
};
