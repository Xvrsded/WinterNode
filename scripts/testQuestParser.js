import { fetchQuests, fetchRegions } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';

const run = async () => {
  try {
    console.log('Fetching quests...');
    const { data: quests } = await fetchQuests();
    
    console.log('Fetching regions...');
    const { data: regionData } = await fetchRegions();
    
    console.log('Building region map...');
    const regionMap = new Map();
    if (regionData && Array.isArray(regionData.quests)) {
      for (const record of regionData.quests) {
        regionMap.set(record.id, record);
      }
    }
    
    console.log('\n========================================');
    console.log('QUEST PARSER TEST');
    console.log('========================================');
    console.log(`Total raw quests: ${quests.length}`);
    
    let successCount = 0;
    let failedCount = 0;
    
    // Data quality counters
    let hasTitle = 0;
    let hasGame = 0;
    let hasStart = 0;
    let hasExpiration = 0;
    let hasAssets = 0;
    let hasTasks = 0;
    let hasRewards = 0;
    let hasRegionMap = 0;
    let isGlobal = 0;
    
    let sampleNormalized = null;
    
    for (const raw of quests) {
      try {
        const parsed = parseQuest(raw, regionMap);
        successCount++;
        
        if (parsed.title) hasTitle++;
        if (parsed.gameTitle || parsed.application.name) hasGame++;
        if (parsed.timing.startsAt) hasStart++;
        if (parsed.timing.expiresAt) hasExpiration++;
        if (parsed.assets.hero || parsed.assets.gameTile) hasAssets++;
        if (parsed.tasks.length > 0) hasTasks++;
        if (parsed.rewards.length > 0) hasRewards++;
        if (parsed.regions.isGlobal !== null) {
          hasRegionMap++;
          if (parsed.regions.isGlobal) isGlobal++;
        }
        
        if (!sampleNormalized && parsed.rewards.length > 0) {
          sampleNormalized = parsed;
        }
      } catch (e) {
        failedCount++;
        console.warn(`[WARN] Failed to parse quest ${raw.id}: ${e.message}`);
      }
    }
    
    console.log(`\nParsed:`);
    console.log(`SUCCESS: ${successCount}`);
    console.log(`FAILED: ${failedCount}`);
    
    console.log(`\n--- DATA QUALITY REPORT ---`);
    console.log(`Total Quest: ${quests.length}`);
    console.log(`Quest with title: ${hasTitle}`);
    console.log(`Quest without title: ${quests.length - hasTitle}`);
    console.log(`Quest with game: ${hasGame}`);
    console.log(`Quest without game: ${quests.length - hasGame}`);
    console.log(`Quest with start: ${hasStart}`);
    console.log(`Quest with expiration: ${hasExpiration}`);
    console.log(`Quest with assets: ${hasAssets}`);
    console.log(`Quest with tasks: ${hasTasks}`);
    console.log(`Quest with rewards: ${hasRewards}`);
    console.log(`Quest with region mapping: ${hasRegionMap}`);
    console.log(`Quest without region mapping: ${quests.length - hasRegionMap}`);
    
    console.log(`\nSample normalized quest:`);
    console.log(JSON.stringify(sampleNormalized || parseQuest(quests[0], regionMap), null, 2));
    console.log('========================================');
    
  } catch (e) {
    console.error('Test failed:', e);
  }
};

run();
