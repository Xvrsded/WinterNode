import { fetchQuests } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { resolveQuestAsset, resolveRewardAsset } from '../src/quest/questAssetResolver.js';
import { buildQuestNotification } from '../src/quest/questNotificationBuilder.js';

const runTests = async () => {
  console.log('Fetching REAL API data...');
  const { data: rawQuests } = await fetchQuests();
  
  const parsedQuests = rawQuests.map(q => parseQuest(q));
  
  // Find interesting quests for our tests
  const modernHeroQuest = parsedQuests.find(q => q.assets?.hero && q.assets.hero.includes('/'));
  const oldQuest = parsedQuests.find(q => q.assets?.hero === 'hero.png');
  const orbRewardQuest = parsedQuests.find(q => q.rewards.some(r => r.name && r.name.toLowerCase().includes('orb')));
  const avatarFrameQuest = parsedQuests.find(q => q.rewards.some(r => r.type === 3 || (r.name && r.name.toLowerCase().includes('frame'))));
  const multiRewardQuest = parsedQuests.find(q => q.rewards.length > 1);
  
  console.log('\n==============================');
  console.log('TEST 1: Hero valid + Orb reward valid');
  if (orbRewardQuest) {
    const embed = await buildQuestNotification(orbRewardQuest);
    console.log(`Quest ID: ${orbRewardQuest.questId}`);
    console.log(`Hero Image: ${embed.embeds[0].data.image?.url ? 'PRESENT' : 'MISSING'}`);
    console.log(`Reward Thumbnail: ${embed.embeds[0].data.thumbnail?.url ? 'PRESENT' : 'MISSING'}`);
    console.log(`Has Orbs: ${embed.embeds[0].data.fields.find(f => f.name === 'Rewards')?.value.includes('Orbs') ? 'YES' : 'NO'}`);
  } else {
    console.log('No orb reward quest found.');
  }

  console.log('\n==============================');
  console.log('TEST 2: Hero valid + Avatar Frame reward valid');
  if (avatarFrameQuest) {
    const embed = await buildQuestNotification(avatarFrameQuest);
    console.log(`Quest ID: ${avatarFrameQuest.questId}`);
    console.log(`Reward Thumbnail: ${embed.embeds[0].data.thumbnail?.url ? 'PRESENT' : 'MISSING'}`);
    console.log(`Has Frame Type/Text: ${embed.embeds[0].data.fields.find(f => f.name === 'Rewards')?.value.includes('Avatar Frame') || embed.embeds[0].data.fields.find(f => f.name === 'Rewards')?.value.includes('Frame') ? 'YES' : 'NO'}`);
  } else {
    console.log('No avatar frame quest found.');
  }

  console.log('\n==============================');
  console.log('TEST 5: Hero valid + multiple rewards');
  if (multiRewardQuest) {
    const embed = await buildQuestNotification(multiRewardQuest);
    console.log(`Quest ID: ${multiRewardQuest.questId}`);
    console.log(`Hero Image: ${embed.embeds[0].data.image?.url ? 'PRESENT' : 'MISSING'}`);
    const rewardsText = embed.embeds[0].data.fields.find(f => f.name === 'Rewards')?.value;
    console.log(`Multiple Reward Types in Text: ${rewardsText.split('Reward Type:').length > 2 ? 'YES' : 'NO'}`);
    console.log(`Thumbnail: ${embed.embeds[0].data.thumbnail?.url ? 'PRESENT' : 'MISSING'}`);
  } else {
    console.log('No multi reward quest found.');
  }
  
  console.log('\n==============================');
  console.log('TEST 6: Old Quest dengan hero.png');
  if (oldQuest) {
    const embed = await buildQuestNotification(oldQuest);
    console.log(`Quest ID: ${oldQuest.questId}`);
    console.log(`Hero Image: ${embed.embeds[0].data.image?.url ? 'PRESENT' : 'MISSING'}`);
  } else {
    console.log('No old quest found.');
  }
  
  console.log('\n==============================');
  console.log('TEST 7: Modern Quest dengan full CDN asset path');
  if (modernHeroQuest) {
    const embed = await buildQuestNotification(modernHeroQuest);
    console.log(`Quest ID: ${modernHeroQuest.questId}`);
    console.log(`Hero Image: ${embed.embeds[0].data.image?.url ? 'PRESENT' : 'MISSING'}`);
  } else {
    console.log('No modern quest found.');
  }
};

runTests();
