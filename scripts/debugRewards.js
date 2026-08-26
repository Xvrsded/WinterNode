import { fetchQuests } from '../src/quest/questFetcher.js';

const run = async () => {
  const questsRes = await fetchQuests();
  const rawQuests = questsRes.data;

  // Quest ID: 1537517701982064721 (Game of Thrones) or find Orbs quest
  for (const q of rawQuests) {
    if (q.id === '1537517701982064721' || q.config?.messages?.quest_name === 'Game of Thrones: Dragonfire' || q.id === '1509683146239512726' || q.id === '1417206015245418566') {
      console.log('='.repeat(80));
      console.log(`QUEST: ${q.config?.messages?.quest_name} (${q.id})`);
      
      const rewards = q.config?.rewards_config?.rewards;
      if (rewards) {
        for (const r of rewards) {
          console.log('\nRAW REWARD OBJECT:');
          console.dir(r, { depth: null });
        }
      }
    }
  }
};

run().catch(e => console.error(e));
