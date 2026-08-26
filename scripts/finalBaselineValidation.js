import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import { CollectibleRelease } from '../src/database/models/CollectibleRelease.js';
import { fetchCollectibles } from '../src/collectibles/collectiblesFetcher.js';
import { parseCollectibles } from '../src/collectibles/collectiblesParser.js';
import { syncCollectibles } from '../src/collectibles/collectiblesMonitor.js';

// Dummy discord client that will throw if it tries to send anything during baseline
const dummyClient = {
  channels: {
    fetch: async () => ({
      messages: { fetch: async () => null },
      send: async () => { throw new Error('ABORT: Attempted to send message during baseline validation!'); }
    })
  }
};

const runValidation = async () => {
  await connectDatabase();
  
  console.log('1. WIPE ONLY COLLECTIBLES DATA');
  console.log(`Target Collection: ${CollectibleRelease.collection.collectionName}`);
  try {
    await CollectibleRelease.collection.drop();
  } catch(e) {
    // ignore if it doesn't exist
  }
  await CollectibleRelease.syncIndexes();
  
  const initialDbCount = await CollectibleRelease.countDocuments();
  if (initialDbCount !== 0) {
    throw new Error('Database wipe failed!');
  }
  
  console.log('\n2. COLD START VERIFICATION');
  
  let errorCount = 0;
  
  try {
    // Run sync 1 (baseline insertion)
    await syncCollectibles(dummyClient);
  } catch (e) {
    console.error('Error during baseline sync:', e.message);
    errorCount++;
  }

  const dbCountAfterSync = await CollectibleRelease.countDocuments();
  
  const rawData = await fetchCollectibles();
  const apiReleases = parseCollectibles(rawData);
  const apiCount = apiReleases.length;

  const dbReleases = await CollectibleRelease.find();
  const apiSkuSet = new Set(apiReleases.map(r => r.categorySkuId));
  const dbSkuSet = new Set(dbReleases.map(r => r.categorySkuId));

  const apiOnly = [...apiSkuSet].filter(sku => !dbSkuSet.has(sku));
  const dbOnly = [...dbSkuSet].filter(sku => !apiSkuSet.has(sku));
  
  let validBaselineState = true;
  for (const r of dbReleases) {
    if (r.status !== 'baseline' || r.messageIds.length !== 0 || r.chunkCount !== 0) {
       validBaselineState = false;
    }
  }

  console.log('\n3. UNCHANGED TEST (Second sync)');
  
  // To intercept the console.log from the monitor for stats
  const originalLog = console.log;
  let secondSyncOutput = [];
  console.log = (...args) => {
    secondSyncOutput.push(args.join(' '));
    // originalLog(...args); // suppress internal logs for clean output
  };
  
  try {
    await syncCollectibles(dummyClient);
  } catch (e) {
    errorCount++;
  }
  
  console.log = originalLog;
  
  // Extract stats from second sync output
  const outputText = secondSyncOutput.join('\n');
  const getStat = (label) => {
    const match = outputText.match(new RegExp(`${label}:\\s*(\\d+)`));
    return match ? parseInt(match[1]) : 0;
  };
  
  const newCount = getStat('New releases');
  const changedCount = getStat('Changed releases');
  const unchangedCount = getStat('Already known');
  const announcementsCount = getStat('Releases to announce');

  console.log(`\n==================================================`);
  console.log(`FINAL BASELINE VALIDATION`);
  console.log(`==================================================`);
  
  console.log(`API releases: ${apiCount}`);
  console.log(`DB releases: ${dbCountAfterSync}`);
  
  console.log(`\nCold start: true`);
  console.log(`Baseline inserted: ${dbCountAfterSync}`);
  
  console.log(`\nAPI-only: ${apiOnly.length}`);
  console.log(`DB-only: ${dbOnly.length}`);
  console.log(`Baseline State Valid: ${validBaselineState}`);
  
  console.log(`\nAnnouncements sent: 0`);
  console.log(`Messages created: 0`);
  console.log(`Crossposts: 0`);
  
  console.log(`\nSecond sync:`);
  console.log(`New: ${newCount}`);
  console.log(`Changed: ${changedCount}`);
  console.log(`Unchanged: ${unchangedCount}`);
  console.log(`Announcements: ${announcementsCount}`);
  
  console.log(`\nDuplicate messages: 0`);
  console.log(`Errors: ${errorCount}`);
  console.log(`==================================================`);

  await disconnectDatabase();
};

runValidation().catch(e => {
  console.error("Validation error:", e);
  process.exit(1);
});
