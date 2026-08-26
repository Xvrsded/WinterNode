import { fetchQuests } from '../src/quest/questFetcher.js';
import { env } from '../src/config/env.js';

const run = async () => {
  const questsRes = await fetchQuests();
  const rawQuests = questsRes.data;
  const now = new Date();

  // Find active quests with quests/ hero paths (more recent format)
  const found = [];
  for (const q of rawQuests) {
    const c = q.config || {};
    if (c.expires_at && new Date(c.expires_at) > now && c.assets?.hero?.startsWith('quests/')) {
      found.push(q);
      if (found.length >= 3) break;
    }
  }

  for (const q of found) {
    const c = q.config || {};
    console.log('='.repeat(80));
    console.log(`QUEST: ${c.messages?.quest_name} (${q.id})`);
    
    // task_config
    console.log('\n--- task_config ---');
    console.dir(c.task_config, { depth: null });

    // task_config_v2
    console.log('\n--- task_config_v2 ---');
    console.dir(c.task_config_v2, { depth: null });

    // rewards
    console.log('\n--- rewards_config.rewards ---');
    if (c.rewards_config?.rewards) {
      for (const r of c.rewards_config.rewards) {
        console.log(`  type=${r.type} sku_id=${r.sku_id} asset="${r.asset}" name="${r.messages?.name}"`);
      }
    }
    console.log('');
  }
};

run().catch(e => console.error(e));
