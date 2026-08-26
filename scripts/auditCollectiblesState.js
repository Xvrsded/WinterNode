import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import { fetchCollectibles } from '../src/collectibles/collectiblesFetcher.js';
import { parseCollectibles } from '../src/collectibles/collectiblesParser.js';
import crypto from 'node:crypto';

const createItemsHash = (items) => {
  const hashObjects = items.map(item => ({
    skuId: item.skuId,
    name: item.name,
    type: item.type,
    asset: item.asset,
    regularPrice: item.regularPrice,
    nitroPrice: item.nitroPrice,
    orbPrice: item.orbPrice
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
import { CollectibleRelease } from '../src/database/models/CollectibleRelease.js';

// Simple deep compare to find changed paths
function findDifferences(obj1, obj2, path = '') {
  const diffs = [];
  
  if (obj1 === obj2) return diffs;
  
  if (obj1 && obj2 && typeof obj1 === 'object' && typeof obj2 === 'object') {
    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for (const key of keys) {
      const newPath = path ? `${path}.${key}` : key;
      const val1 = obj1[key];
      const val2 = obj2[key];
      
      if (val1 === undefined) {
         diffs.push(`+ ${newPath}: ${JSON.stringify(val2)}`);
      } else if (val2 === undefined) {
         diffs.push(`- ${newPath}: ${JSON.stringify(val1)}`);
      } else if (typeof val1 === 'object' && typeof val2 === 'object') {
         if (val1 !== null && val2 !== null) {
            diffs.push(...findDifferences(val1, val2, newPath));
         } else if (val1 !== val2) {
            diffs.push(`* ${newPath}: ${JSON.stringify(val1)} => ${JSON.stringify(val2)}`);
         }
      } else if (val1 !== val2) {
         diffs.push(`* ${newPath}: ${JSON.stringify(val1)} => ${JSON.stringify(val2)}`);
      }
    }
  } else if (obj1 !== obj2) {
    diffs.push(`* ${path}: ${JSON.stringify(obj1)} => ${JSON.stringify(obj2)}`);
  }
  
  return diffs;
}

const runAudit = async () => {
  await connectDatabase();
  
  console.log('Fetching API...');
  const rawData = await fetchCollectibles();
  const releases = parseCollectibles(rawData);
  
  const dbReleases = await CollectibleRelease.find();
  const dbCount = dbReleases.length;
  const isColdStart = dbCount === 0;
  
  const apiSkuSet = new Set(releases.map(r => r.categorySkuId));
  const dbSkuSet = new Set(dbReleases.map(r => r.categorySkuId));
  
  const matching = [...apiSkuSet].filter(sku => dbSkuSet.has(sku));
  const apiOnly = [...apiSkuSet].filter(sku => !dbSkuSet.has(sku));
  const dbOnly = [...dbSkuSet].filter(sku => !apiSkuSet.has(sku));
  
  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  
  const changedBreakdown = [];
  
  for (const release of releases) {
    const existing = dbReleases.find(db => db.categorySkuId === release.categorySkuId);
    if (!existing) {
      newCount++;
    } else {
      // Create hash using the current method
      const currentHash = createItemsHash(release.items);
      
      if (existing.itemsHash === currentHash) {
         unchangedCount++;
      } else {
         changedCount++;
         
         // Let's diff the items arrays directly to see what changed
         // First we sort them by skuId just in case
         const sortFn = (a, b) => a.skuId.localeCompare(b.skuId);
         
         // Standardize objects to plain objects
         const oldItems = existing.items.map(i => i.toObject ? i.toObject() : i).sort(sortFn);
         const newItems = release.items.sort(sortFn);
         
         // Remove non-hash fields for clean diff
         const cleanItems = (items) => items.map(item => ({
            skuId: item.skuId,
            name: item.name,
            type: item.type,
            asset: item.asset, // original CDN identifier
            regularPrice: item.regularPrice,
            nitroPrice: item.nitroPrice,
            orbPrice: item.orbPrice
         }));
         
         const diffs = findDifferences(cleanItems(oldItems), cleanItems(newItems));
         
         changedBreakdown.push({
           name: release.name,
           categorySkuId: release.categorySkuId,
           oldHash: existing.itemsHash,
           newHash: currentHash,
           diffs
         });
      }
    }
  }
  
  console.log(`\n==================================================`);
  console.log(`COLLECTIBLES STATE AUDIT`);
  console.log(`==================================================\n`);
  
  console.log(`API releases: ${releases.length}`);
  console.log(`DB releases: ${dbCount}\n`);
  
  console.log(`Matching: ${matching.length}`);
  console.log(`API-only: ${apiOnly.length}`);
  console.log(`DB-only: ${dbOnly.length}\n`);
  
  console.log(`Cold start: ${isColdStart}\n`);
  
  console.log(`New: ${newCount}`);
  console.log(`Changed: ${changedCount}`);
  console.log(`Unchanged: ${unchangedCount}\n`);
  
  console.log(`Baseline inserted: 0 (Audit mode)\n`);
  
  if (changedBreakdown.length > 0) {
    console.log(`Changed field breakdown:\n`);
    for (const change of changedBreakdown) {
      console.log(`Release: ${change.name}`);
      console.log(`Category SKU: ${change.categorySkuId}`);
      console.log(`Old hash: ${change.oldHash}`);
      console.log(`New hash: ${change.newHash}`);
      console.log(`Changed fields:`);
      for (const diff of change.diffs) {
         console.log(`  ${diff}`);
      }
      console.log('');
    }
  }
  
  console.log(`Announcements queued: 0 (Audit mode)`);
  console.log(`Announcements sent: 0 (Audit mode)`);
  console.log(`Messages created: 0 (Audit mode)`);
  console.log(`Crossposts successful: 0 (Audit mode)`);
  console.log(`Crossposts pending: 0 (Audit mode)`);
  console.log(`Errors: 0\n`);
  console.log(`==================================================`);
  
  await disconnectDatabase();
};

runAudit().catch(e => {
  console.error("Audit error:", e);
  process.exit(1);
});
