import { fetchQuests } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { renderQuestCard } from '../src/quest/questCardRenderer.js';
import fs from 'fs';
import path from 'path';

const runTests = async () => {
  console.log('Fetching REAL API data...');
  const { data: rawQuests } = await fetchQuests();
  
  const parsedQuests = rawQuests.map(q => parseQuest(q));
  
  // Find interesting quests for our tests
  const modernHeroQuest = parsedQuests.find(q => q.assets?.hero && q.assets.hero.includes('/') && q.rewards.some(r => r.asset?.includes('/')));
  const oldQuest = parsedQuests.find(q => q.assets?.hero === 'hero.png');
  const multiRewardQuest = parsedQuests.find(q => q.rewards.length > 1);
  
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
  }

  const testCases = [
    { name: '1. EA SPORTS FC 26 (or equivalent modern)', quest: modernHeroQuest },
    { name: '6. Multiple rewards', quest: multiRewardQuest },
    { name: '10. Legacy quest dengan hero.png', quest: oldQuest }
  ];

  for (const tc of testCases) {
    if (tc.quest) {
      console.log(`\n==============================`);
      console.log(`TEST: ${tc.name}`);
      console.log(`Quest ID: ${tc.quest.questId}`);
      
      try {
        const card = await renderQuestCard(tc.quest);
        const outPath = path.join(tmpDir, card.filename);
        fs.writeFileSync(outPath, card.buffer);
        console.log(`SUCCESS: Rendered card to ${outPath}`);
      } catch (err) {
        console.error(`FAILED to render card:`, err);
      }
    }
  }
};

runTests();
