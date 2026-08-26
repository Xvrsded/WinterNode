import { fetchQuests } from '../src/quest/questFetcher.js';

const run = async () => {
  try {
    const { data: quests } = await fetchQuests();
    
    console.log(`Total quests: ${quests.length}`);
    
    for (let i = 0; i < Math.min(10, quests.length); i++) {
      const q = quests[i];
      console.log('========================================');
      console.log(`Quest ID: ${q.id}`);
      console.log(`App ID: ${q.config?.application?.id}`);
      console.log('Raw Assets:');
      console.log(JSON.stringify(q.config?.assets, null, 2));
    }
  } catch (e) {
    console.error('Failed to inspect assets', e);
  }
};

run();
