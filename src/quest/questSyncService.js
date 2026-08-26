import { fetchQuests, fetchRegions } from './questFetcher.js';
import { parseQuest, createQuestHash } from './questParser.js';
import { questService } from './questService.js';
import { sendQuestNotification, editQuestNotification, deleteQuestNotification, fetchAllQuestBotMessages, extractQuestIdFromMessage } from './questNotificationService.js';
import { resolveQuestHero } from './questAssetResolver.js';
import { logger } from '../utils/logger.js';
import { getDiscordClient } from '../discord/client.js';
import { DISCORD_CONFIG } from '../config/discord.js';

let isSyncing = false;
let hasDoneFullSync = false;
let lastFullSyncTime = 0;

export const syncQuests = async () => {
  if (isSyncing) {
    logger.warn('[QUEST] Sync already in progress, skipping cycle');
    return { skipped: true, reason: 'sync_already_in_progress' };
  }

  isSyncing = true;
  try {
    logger.info('[QUEST] Starting incremental quest sync process...');

    const [questsRes, regionsRes] = await Promise.all([
      fetchQuests().catch(e => {
        logger.error(`fetchQuests failed: ${e.message}`);
        return null;
      }),
      fetchRegions().catch(e => {
        logger.error(`fetchRegions failed: ${e.message}`);
        return null;
      })
    ]);

    if (!questsRes || !questsRes.data || !Array.isArray(questsRes.data)) {
      logger.error('API_UNSAFE_FOR_RECONCILIATION: Failed to fetch valid quests from API (malformed or missing data)');
      return { success: false, reason: 'api_fetch_failed' };
    }

    const rawQuests = questsRes.data;
    const allExistingQuests = await questService.getAllQuests();

    // API COMPLETENESS GUARD
    if (allExistingQuests.length > 5 && rawQuests.length === 0) {
      logger.error('API_UNSAFE_FOR_RECONCILIATION: API unexpectedly returned 0 quests while DB has existing ones.');
      return { success: false, reason: 'api_incomplete' };
    }

    const rawRegions = regionsRes?.data?.quests || [];
    const regionMap = new Map();
    for (const r of rawRegions) regionMap.set(r.id, r);

    const activeValidQuests = new Map();
    const ignoredQuestIds = new Set();
    const networkErrorQuests = new Set();

    let stats = {
      totalApi: rawQuests.length,
      production: 0,
      test: 0,
      placeholder: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      recreated: 0,
      ignored: 0,
      missing: 0,
      expired: 0,
      deleted: 0,
      errors: 0
    };

    for (const raw of rawQuests) {
      try {
        const quest = parseQuest(raw, regionMap);
        
        if (quest.classification !== 'production') {
          ignoredQuestIds.add(quest.questId);
          if (quest.classificationReason === 'expired') stats.expired++;
          else if (quest.classificationReason === 'upcoming') stats.ignored++;
          else if (quest.classification === 'test') stats.test++;
          else if (quest.classification === 'placeholder') stats.placeholder++;
          else stats.ignored++;

          await questService.updateQuest(quest.questId, {
            ...quest,
            hash: createQuestHash(quest),
            status: quest.classificationReason === 'expired' ? 'expired' : 'ignored'
          }, { upsert: true });
          continue;
        }

        // Production, validate hero
        let heroResult = await resolveQuestHero(quest.assets?.hero);
        if (!heroResult.valid && quest.assets?.gameTile) {
          const tileResult = await resolveQuestHero(quest.assets?.gameTile);
          if (tileResult.valid) {
            heroResult = tileResult;
          } else if (tileResult.reason === 'network_error') {
            heroResult.reason = 'network_error';
          }
        }

        if (!heroResult.valid) {
          if (heroResult.reason === 'network_error') {
            logger.warn(`[QuestHero] Network error resolving hero for ${quest.questId}. Skipping this cycle.`);
            networkErrorQuests.add(quest.questId);
            stats.errors++;
            continue;
          } else {
            quest.classification = 'ignored';
            quest.classificationReason = heroResult.reason;
            ignoredQuestIds.add(quest.questId);
            stats.ignored++;
            
            await questService.updateQuest(quest.questId, {
              ...quest,
              hash: createQuestHash(quest),
              status: 'ignored'
            }, { upsert: true });
            continue;
          }
        }

        // Passed all gates!
        stats.production++;
        activeValidQuests.set(quest.questId, quest);

      } catch (e) {
        logger.warn(`Failed to process quest ${raw.id || 'unknown'}: ${e.message}`);
      }
    }

    const client = getDiscordClient();
    if (!client || !client.isReady()) {
      logger.error('API_UNSAFE_FOR_RECONCILIATION: Discord client not ready');
      return { success: false, reason: 'discord_not_ready' };
    }

    const channelId = DISCORD_CONFIG.quest.channelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      logger.error('API_UNSAFE_FOR_RECONCILIATION: Discord channel not found');
      return { success: false, reason: 'discord_channel_missing' };
    }

    const nowTime = Date.now();
    const isFullSync = !hasDoneFullSync || (nowTime - lastFullSyncTime > 30 * 60 * 1000);

    const discordQuestMessages = new Map();
    const messagesByQuestId = new Map();

    if (isFullSync) {
      logger.info(`[QUEST] Performing FULL Discord reconciliation...`);
      const allBotMessages = await fetchAllQuestBotMessages(channel);
      for (const msg of allBotMessages) {
        const questId = extractQuestIdFromMessage(msg);
        if (questId) {
          discordQuestMessages.set(msg.id, { message: msg, questId });
          if (!messagesByQuestId.has(questId)) messagesByQuestId.set(questId, []);
          messagesByQuestId.get(questId).push(msg);
        }
      }
      hasDoneFullSync = true;
      lastFullSyncTime = nowTime;
    } else {
      // Incremental sync
      for (const dbQuest of allExistingQuests) {
        if (dbQuest.messageId) {
           const msg = await channel.messages.fetch({ message: dbQuest.messageId, force: true }).catch(() => null);
           if (msg) {
             const questId = extractQuestIdFromMessage(msg);
             if (questId) {
                discordQuestMessages.set(msg.id, { message: msg, questId });
                if (!messagesByQuestId.has(questId)) messagesByQuestId.set(questId, []);
                messagesByQuestId.get(questId).push(msg);
             }
           }
        }
      }
    }

    // RULE 8 — DUPLICATES
    for (const [questId, messages] of messagesByQuestId.entries()) {
      if (messages.length > 1) {
         const dbRecord = allExistingQuests.find(q => q.questId === questId);
         let canonical = messages.find(m => m.id === dbRecord?.messageId);
         if (!canonical) {
            messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            canonical = messages[0];
         }
         
         for (const m of messages) {
            if (m.id !== canonical.id) {
               logger.info(`[QUEST] Deleting duplicate message ${m.id} for quest ${questId}`);
               await m.delete().catch(() => {});
               discordQuestMessages.delete(m.id);
               stats.deleted++;
            }
         }
         messagesByQuestId.set(questId, [canonical]);
      }
    }

    // RULES 1-4 — RECONCILIATION
    for (const [questId, quest] of activeValidQuests.entries()) {
      const dbRecord = allExistingQuests.find(q => q.questId === questId);
      const currentHash = createQuestHash(quest);
      const discordMsgs = messagesByQuestId.get(questId);
      const discordMsg = discordMsgs ? discordMsgs[0] : null;

      if (!discordMsg) {
         if (dbRecord && dbRecord.messageId) {
            // RULE 4
            logger.info(`[QUEST] Recreating missing message for ${questId}`);
            const result = await sendQuestNotification(quest);
            if (result.success) {
               stats.recreated++;
               await questService.updateQuest(questId, { ...quest, hash: currentHash, messageId: result.messageId, channelId: result.channelId, status: 'active' }, { upsert: true });
            } else stats.errors++;
         } else {
            // RULE 1
            logger.info(`[QUEST] Creating new notification for ${questId}`);
            const result = await sendQuestNotification(quest);
            if (result.success) {
               stats.created++;
               await questService.updateQuest(questId, { ...quest, hash: currentHash, messageId: result.messageId, channelId: result.channelId, status: 'active' }, { upsert: true });
            } else stats.errors++;
         }
      } else {
         if (dbRecord && dbRecord.hash === currentHash) {
            // RULE 2
            stats.unchanged++;
            await questService.updateQuest(questId, { status: 'active' }, { upsert: true });
         } else {
            // RULE 3
            logger.info(`[QUEST] Updating notification for ${questId}`);
            const result = await editQuestNotification(quest, discordMsg.id, channel.id, false);
            if (result.success) {
               stats.updated++;
               await questService.updateQuest(questId, { ...quest, hash: currentHash, status: 'active' }, { upsert: true });
            } else stats.errors++;
         }
      }
    }

    // RULES 5, 6, 9 — DELETIONS
    const questsFromApi = new Set(rawQuests.map(q => q.id));
    for (const [questId, messages] of messagesByQuestId.entries()) {
      const msg = messages[0];
      if (!msg) continue;
      
      if (networkErrorQuests.has(questId)) continue; // Keep and retry
      if (activeValidQuests.has(questId)) continue; // It's valid and active
      
      // Delete ineligible/expired
      logger.info(`[QUEST] Deleting ineligible/expired message ${msg.id} for quest ${questId}`);
      await msg.delete().catch(() => {});
      stats.deleted++;
      
      let dbStatus = 'missing';
      if (ignoredQuestIds.has(questId)) {
         const dbRecord = allExistingQuests.find(q => q.questId === questId);
         dbStatus = dbRecord?.status || 'ignored';
         if (dbRecord && dbRecord.classificationReason === 'expired') {
            dbStatus = 'expired';
         }
      } else if (!questsFromApi.has(questId)) {
         stats.missing++;
      }
      await questService.updateQuest(questId, { messageId: null, status: dbStatus }, { upsert: true });
    }

    // Final DB cleanup for quests that were active but are now missing from API and had no Discord message to delete
    for (const dbQuest of allExistingQuests) {
       if (dbQuest.status === 'active' && !questsFromApi.has(dbQuest.questId) && !networkErrorQuests.has(dbQuest.questId)) {
          stats.missing++;
          await questService.updateQuest(dbQuest.questId, { messageId: null, status: 'missing' });
       }
    }

    logger.info(`QUEST SYNC`);
    logger.info(`=========`);
    logger.info(`API quests: ${stats.totalApi}`);
    logger.info(`Production: ${stats.production}`);
    logger.info(`Test: ${stats.test}`);
    logger.info(`Placeholder: ${stats.placeholder}`);
    logger.info(`Created: ${stats.created}`);
    logger.info(`Updated: ${stats.updated}`);
    logger.info(`Unchanged: ${stats.unchanged}`);
    logger.info(`Recreated: ${stats.recreated}`);
    logger.info(`Ignored: ${stats.ignored}`);
    logger.info(`Missing: ${stats.missing}`);
    logger.info(`Expired: ${stats.expired}`);
    logger.info(`Deleted: ${stats.deleted}`);
    logger.info(`Errors: ${stats.errors}`);

    return {
      mode: isFullSync ? "FULL" : "INCREMENTAL",
      total: stats.totalApi,
      stats
    };

  } finally {
    isSyncing = false;
  }
};
