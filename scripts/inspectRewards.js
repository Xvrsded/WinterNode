import { fetchQuests } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { resolveRewardAsset } from '../src/quest/questAssetResolver.js';

const runTests = async () => {
  console.log('Fetching REAL API data...');
  const { data: rawQuests } = await fetchQuests();
  
  const parsedQuests = rawQuests.map(q => parseQuest(q));
  
  // Find interesting quests for our tests
  const modernHeroQuest = parsedQuests.find(q => q.questId === '1419750903006630042'); // EA SPORTS FC 26
  const orbRewardQuest = parsedQuests.find(q => q.rewards.some(r => r.type === 5 || (r.name && r.name.toLowerCase().includes('orb'))));
  
  const testCases = [
    { name: 'EA SPORTS FC 26 Avatar Frame', quest: modernHeroQuest },
    { name: 'Virtual Currency / Orb Quest', quest: orbRewardQuest }
  ];

  for (const tc of testCases) {
    if (tc.quest) {
      console.log(`\n==============================`);
      console.log(`INSPECTING: ${tc.name}`);
      console.log(`Quest ID: ${tc.quest.questId}`);
      
      for (const reward of tc.quest.rewards) {
        console.log(`\nReward Name: ${reward.name}`);
        console.log(`Reward Type: ${reward.type}`);
        console.log(`Reward Asset (Raw): ${reward.asset}`);
        
        if (reward.asset) {
          const resolvedUrl = await resolveRewardAsset(reward.asset);
          console.log(`Resolved URL: ${resolvedUrl || 'FAILED TO RESOLVE (Probably placeholder or missing)'}`);
        } else {
          console.log(`No asset provided in API.`);
        }
      }
    }
  }
};

runTests();
