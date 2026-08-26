import { fetchQuests } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';

const runTests = async () => {
  console.log('Fetching REAL API data...');
  const { data: rawQuests } = await fetchQuests();
  
  // Find EA SPORTS FC 26
  const eaQuest = rawQuests.find(q => q.id === '1419750903006630042');
  if (eaQuest) {
    console.log('\n[RewardResolver] RAW EA SPORTS FC 26:');
    console.log(JSON.stringify(eaQuest.config?.rewards_config, null, 2));
  }
  
  // Find Virtual Currency
  const orbQuest = rawQuests.find(q => q.id === '1309334608533258240' || q.config?.rewards_config?.rewards?.some(r => r.type === 5));
  if (orbQuest) {
    console.log(`\n[RewardResolver] RAW VIRTUAL CURRENCY (Quest: ${orbQuest.id}):`);
    console.log(JSON.stringify(orbQuest.config?.rewards_config, null, 2));
  }
};

runTests();
