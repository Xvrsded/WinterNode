import fs from 'fs';
import { fetchQuests } from '../src/quest/questFetcher.js';

const runAudit = async () => {
  console.log('Fetching raw API data from https://api.discordquest.com/api/quests...');
  let res;
  try {
    res = await fetchQuests();
  } catch (e) {
    console.error(`Failed to fetch quests: ${e.message}`);
    process.exit(1);
  }

  if (!res || !res.data) {
    console.error('Failed to fetch quests or data is missing');
    process.exit(1);
  }

  const rawQuests = res.data;
  console.log(`Total quests found: ${rawQuests.length}`);
  
  console.log('\n--- TOP 3 RAW QUESTS ---');
  console.log(JSON.stringify(rawQuests.slice(0, 3), null, 2));

  console.log('\n--- SEARCHING FOR q_P_5 ---');
  const qP5 = rawQuests.find(q => q.id === 'q_P_5');
  if (qP5) {
    console.log('FOUND q_P_5:');
    console.log(JSON.stringify(qP5, null, 2));
  } else {
    console.log('q_P_5 NOT FOUND in production API.');
  }
};

runAudit().catch(console.error);
