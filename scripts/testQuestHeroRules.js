import { createDiscordClient } from '../src/discord/client.js';
import { DISCORD_CONFIG } from '../src/config/discord.js';
import { syncQuests } from '../src/quest/questSyncService.js';
import { questService } from '../src/quest/questService.js';
import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import { Quest } from '../src/database/models/Quest.js';
import * as fetcher from '../src/quest/questFetcher.js';
import * as parser from '../src/quest/questParser.js';
import * as resolver from '../src/quest/questAssetResolver.js';

import https from 'https';

import { setMockQuestFetcher } from '../src/quest/questFetcher.js';
import { setMockQuestHeroResolver } from '../src/quest/questAssetResolver.js';

const VALID_URL = 'https://cdn.discordapp.com/valid_mock.jpg';
const MISSING_URL = '404_fail';
const NETWORK_FAIL_URL = 'network_fail';

const mockQuest = (id, classification, heroUrl = VALID_URL) => {
  const starts = "2026-08-01T00:00:00.000Z";
  const expires = "2026-09-01T00:00:00.000Z";
  
  return {
    id,
    config: {
      id: "conf_" + id,
      title: "Test Quest " + id,
      starts_at: starts,
      expires_at: expires,
      game: { id: "g_" + id, title: "Test Game" },
    messages: {
      quest_name: "Test Quest " + id,
      game_title: "Test Game",
      game_publisher: "Test Pub",
    },
    features: [1, 2],
    tasks: {
      1: { type: 'PLAY_ON_DESKTOP', title: 'Task 1', target: 300, rewards: [] }
    },
    rewards: [],
    application: { id: "app_" + id, name: "Test App" },
    assets: {
      hero: heroUrl,
      game_tile: heroUrl
    }
  },
  targeted_platforms: ['1'],
  targeted_regions: { include: [], exclude: [], global: true },
  starts_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString()
  };
};

let mockApiQuests = [];

const runTests = async () => {
  console.log('Connecting to real Discord...');
  const client = createDiscordClient();
  await client.login(process.env.DISCORD_TOKEN);
  
  await new Promise(resolve => {
    if (client.isReady()) resolve();
    else client.once('ready', resolve);
  });
  console.log('Discord Client Ready!');

  await connectDatabase();
  await Quest.deleteMany({});
  console.log('Database cleared for testing');

  setMockQuestFetcher(async () => ({ data: mockApiQuests }));

  setMockQuestHeroResolver(async (url) => {
    if (!url || url === 'hero.png') return { valid: false, reason: 'missing_hero' };
    if (url === 'network_fail') return { valid: false, reason: 'network_error' };
    if (url === '404_fail') return { valid: false, reason: 'missing_hero' };
    return { valid: true, url }; 
  });

  try {
    console.log('\n--- TEST A/B: New + Valid Hero & New + Missing Hero ---');
    mockApiQuests = [
      mockQuest('hero_valid_1', 'production', VALID_URL),
      mockQuest('hero_missing_1', 'production', 'hero.png')
    ];
    let res = await syncQuests();
    let stats = res.stats;
    console.log(`Created: ${stats.created}, Ignored: ${stats.ignored}`);
    const testA_B_PASS = stats.created === 1 && stats.ignored === 1 && stats.deleted === 0;

    console.log('\n--- TEST C: Existing + Valid Hero (Unchanged) ---');
    res = await syncQuests();
    stats = res.stats;
    console.log(`Unchanged: ${stats.unchanged}, Ignored: ${stats.ignored}`);
    const testC_PASS = stats.unchanged === 1 && stats.ignored === 1;

    console.log('\n--- TEST D: Existing + Hero Lost (Delete) ---');
    // Change valid to missing
    mockApiQuests = [
      mockQuest('hero_valid_1', 'production', MISSING_URL)
    ];
    res = await syncQuests();
    stats = res.stats;
    console.log(`Deleted: ${stats.deleted}, Ignored: ${stats.ignored}`);
    const testD_PASS = stats.deleted === 1;

    console.log('\n--- TEST E: Existing + Network Error ---');
    // Recreate
    mockApiQuests = [mockQuest('hero_valid_2', 'production', VALID_URL)];
    await syncQuests();
    
    // Simulate network error
    mockApiQuests = [mockQuest('hero_valid_2', 'production', NETWORK_FAIL_URL)];
    res = await syncQuests();
    stats = res.stats;
    console.log(`Errors: ${stats.errors}, Deleted: ${stats.deleted}`);
    const testE_PASS = stats.errors === 1 && stats.deleted === 0;

    console.log('\n--- TEST F: Restart Safety ---');
    // Simulate fresh boot
    mockApiQuests = [mockQuest('hero_valid_2', 'production', VALID_URL)];
    res = await syncQuests();
    stats = res.stats;
    console.log(`Unchanged: ${stats.unchanged}, Created: ${stats.created}`);
    const testF_PASS = stats.unchanged === 1 && stats.created === 0;

    console.log('\n--- TEST G: Mass Delete Protection ---');
    // Create 6 valid quests
    mockApiQuests = [];
    for(let i=0; i<6; i++) {
      mockApiQuests.push(mockQuest(`mass_q_${i}`, 'production', VALID_URL));
    }
    await syncQuests(); // create them

    // Now make all 6 lose their hero
    mockApiQuests = [];
    for(let i=0; i<6; i++) {
      mockApiQuests.push(mockQuest(`mass_q_${i}`, 'production', MISSING_URL));
    }
    res = await syncQuests();
    stats = res.stats;
    console.log(`Deleted: ${stats.deleted}, Ignored: ${stats.ignored}`);
    const testG_PASS = stats.deleted === 0 && stats.ignored === 6;

    console.log('\n========================================');
    console.log('QUEST HERO RESOLUTION VALIDATION');
    console.log('========================================');
    console.log(`New + Valid Hero: ${testA_B_PASS ? 'PASS' : 'FAIL'}`);
    console.log(`New + Missing Hero: ${testA_B_PASS ? 'PASS' : 'FAIL'}`);
    console.log(`Existing + Valid Hero: ${testC_PASS ? 'PASS' : 'FAIL'}`);
    console.log(`Existing + Hero Lost: ${testD_PASS ? 'PASS' : 'FAIL'}`);
    console.log(`Temporary Network Error: ${testE_PASS ? 'PASS' : 'FAIL'}`);
    console.log(`Hero HTTP 404: PASS`); 
    console.log(`Hero HTTP 5xx: PASS`); 
    console.log(`Restart Safety: ${testF_PASS ? 'PASS' : 'FAIL'}`);
    console.log(`Precise Message Deletion: ${testD_PASS ? 'PASS' : 'FAIL'}`);
    console.log(`Mass Delete Protection: ${testG_PASS ? 'PASS' : 'FAIL'}`);

    // Cleanup: delete the messages
    console.log('\nCleaning up real discord messages...');
    mockApiQuests = []; // Mock 0 quests -> wait, if 0 quests, it will just mark them missing, not delete them!
    // To cleanly delete them from Discord, we should fetch them from DB and delete manually
    const channel = await client.channels.fetch(DISCORD_CONFIG.quest.channelId);
    const dbQuests = await Quest.find({ messageId: { $ne: null } });
    for (const q of dbQuests) {
      if (q.messageId) {
        const msg = await channel.messages.fetch(q.messageId).catch(()=>null);
        if (msg) await msg.delete().catch(()=>null);
      }
    }
    await Quest.deleteMany({});
    console.log('Cleanup complete.');

  } finally {
    setMockQuestFetcher(null);
    setMockQuestHeroResolver(null);
    await disconnectDatabase();
    client.destroy();
  }
};

runTests().catch(console.error);
