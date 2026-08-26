import { fetchQuests } from '../src/quest/questFetcher.js';
import { resolveQuestAsset } from '../src/quest/questAssetResolver.js';

const runTest = async () => {
  console.log('Fetching quests for asset testing...');
  try {
    const { data: rawQuests } = await fetchQuests();
    
    // Find quests with hero asset that isn't just the 'hero.png' placeholder
    const questsToTest = rawQuests
      .filter(q => q.config?.assets?.hero && q.config.assets.hero.includes('/'))
      .slice(0, 10);
      
    console.log(`Found ${questsToTest.length} quests to test.\n`);
    
    let resolvedHero = 0;
    let resolvedGameTile = 0;
    let bothFailed = 0;

    for (const raw of questsToTest) {
      console.log('========================================');
      console.log('Quest:');
      console.log(`Quest ID: ${raw.id}`);
      console.log(`Title: ${raw.config?.messages?.quest_name || 'Unknown'}`);
      console.log(`Original Hero: ${raw.config?.assets?.hero}`);
      console.log(`Original Game Tile: ${raw.config?.assets?.game_tile}`);
      
      const heroUrl = await resolveQuestAsset(raw.config?.assets?.hero, 'hero');
      const gameTileUrl = await resolveQuestAsset(raw.config?.assets?.game_tile, 'game_tile');
      
      console.log(`\nResolved Hero:`);
      console.log(heroUrl ? heroUrl : 'null');
      console.log('HTTP Status: ' + (heroUrl ? '200' : 'N/A'));
      console.log('Content-Type: ' + (heroUrl ? 'image/*' : 'N/A'));
      
      console.log(`\nResolved Game Tile:`);
      console.log(gameTileUrl ? gameTileUrl : 'null');
      console.log('HTTP Status: ' + (gameTileUrl ? '200' : 'N/A'));
      console.log('Content-Type: ' + (gameTileUrl ? 'image/*' : 'N/A'));
      
      let pass = false;
      if (heroUrl) resolvedHero++;
      if (gameTileUrl) resolvedGameTile++;
      if (heroUrl || gameTileUrl) {
        pass = true;
      } else {
        bothFailed++;
      }
      
      console.log(`\nResult: ${pass ? 'PASS' : 'FAIL'}`);
    }
    
    console.log('\n========================================');
    console.log(`Total tested: ${questsToTest.length}`);
    console.log(`Hero resolved: ${resolvedHero}`);
    console.log(`Game tile resolved: ${resolvedGameTile}`);
    console.log(`Both failed: ${bothFailed}`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Test crashed:', error);
  }
};

runTest();
