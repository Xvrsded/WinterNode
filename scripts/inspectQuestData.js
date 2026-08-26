import { fetchQuests } from '../src/quest/questFetcher.js';

const findPaths = (obj, currentPath = '', paths = new Set()) => {
  if (obj === null || obj === undefined) return paths;
  
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      findPaths(obj[0], `${currentPath}[0]`, paths);
    }
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      paths.add(newPath);
      findPaths(obj[key], newPath, paths);
    }
  }
  return paths;
};

const run = async () => {
  try {
    const { data: quests } = await fetchQuests();
    console.log(`Total quests: ${quests.length}`);
    
    if (quests.length === 0) return;
    
    // Find all unique paths across a sample of 50 quests
    const allPaths = new Set();
    for (let i = 0; i < Math.min(50, quests.length); i++) {
      findPaths(quests[i], '', allPaths);
    }
    
    console.log('\n--- ALL DISCOVERED PATHS ---');
    const sortedPaths = Array.from(allPaths).sort();
    sortedPaths.forEach(p => console.log(p));
    
    // Search for reward related paths
    console.log('\n--- REWARD RELATED PATHS ---');
    const rewardPaths = sortedPaths.filter(p => p.toLowerCase().includes('reward'));
    if (rewardPaths.length > 0) {
      rewardPaths.forEach(p => console.log(p));
    } else {
      console.log('REWARD DATA NOT FOUND IN QUEST DATASET');
    }

    // Inspect first quest
    console.log('\n--- SAMPLE QUEST 0 ---');
    console.log(JSON.stringify(quests[0], null, 2));

    // Inspect a quest with a reward if any
    if (rewardPaths.length > 0) {
      console.log('\n--- SAMPLE QUEST WITH REWARDS ---');
      const rewardQuest = quests.find(q => JSON.stringify(q).toLowerCase().includes('reward'));
      if (rewardQuest) {
         console.log(JSON.stringify(rewardQuest, null, 2));
      }
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
};

run();
