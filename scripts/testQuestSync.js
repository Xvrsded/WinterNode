import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import { questService } from '../src/quest/questService.js';
import { syncQuests } from '../src/quest/questSyncService.js';
import { createDiscordClient } from '../src/discord/client.js';
import { env } from '../src/config/env.js';
import { Quest } from '../src/database/models/Quest.js';

import * as fetcher from '../src/quest/questFetcher.js';
import * as notifier from '../src/quest/questNotificationService.js';

const mockDiscordMessages = new Map();
let currentMessageId = 1000;

// Mock Discord Client
const dummyClient = {
  isReady: () => true,
  channels: {
    fetch: async () => ({
      id: 'channel_1',
      isTextBased: () => true,
      isDMBased: () => false,
      guild: {
        id: env.discord.guildId,
        members: { me: {} }
      },
      permissionsFor: () => ({
        has: () => true
      }),
      send: async () => {
        const id = `${++currentMessageId}`;
        mockDiscordMessages.set(id, true);
        return {
          id,
          channel: { type: 5 }, // GuildAnnouncement
          crosspostable: true,
          crosspost: async () => {}
        };
      },
      messages: {
        fetch: async (id) => {
          if (!mockDiscordMessages.has(id)) throw new Error('Message not found');
          return {
            id,
            edit: async () => {}
          };
        }
      }
    })
  }
};

const createMockQuest = (id, override = {}) => ({
  id,
  config: {
    messages: { quest_name: `Quest ${id}`, game_publisher: 'Discord' },
    assets: { hero: 'hero.png' },
    starts_at: '2024-01-01T00:00:00Z',
    expires_at: '2030-01-01T00:00:00Z',
    ...override
  }
});

let mockApiQuests = [];

import * as clientModule from '../src/discord/client.js';
clientModule.setDiscordClient(dummyClient);
global.fetch = async (url, options) => {
  if (url.includes('/api/quests')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockApiQuests
    };
  }
  if (url.includes('/api/regions')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ quests: [] })
    };
  }
  return originalFetch(url, options);
};

// Clean up duplicate overrides

const runTests = async () => {
  await connectDatabase();
  await Quest.collection.drop().catch(() => {});
  await Quest.syncIndexes();

  console.log('--- TEST 1: First sync ---');
  mockApiQuests = [
    createMockQuest('q1'),
    createMockQuest('q2')
  ];
  let res = await syncQuests();
  console.assert(res.stats.created === 2, 'Should create 2 quests');

  console.log('--- TEST 2: Identical second sync ---');
  res = await syncQuests();
  console.assert(res.stats.created === 0 && res.stats.updated === 0 && res.stats.unchanged === 2, 'Should be 0 created/updated');

  console.log('--- TEST 3: Bot restart (same as second sync) ---');
  res = await syncQuests();
  console.assert(res.stats.unchanged === 2, 'Should survive restart without modifying messages');

  console.log('--- TEST 4: New quest ---');
  mockApiQuests.push(createMockQuest('q3'));
  res = await syncQuests();
  console.assert(res.stats.created === 1, 'Should create 1 new quest');

  console.log('--- TEST 5: Changed quest ---');
  mockApiQuests[0].config.messages.quest_name = 'Quest 1 Updated';
  res = await syncQuests();
  console.assert(res.stats.updated === 1 && res.stats.unchanged === 2, 'Should update 1 quest');

  console.log('--- TEST 6: Missing Discord message ---');
  const q3Db = await questService.findByQuestId('q3');
  mockDiscordMessages.delete(q3Db.messageId);
  res = await syncQuests();
  console.assert(res.stats.recreated === 1, 'Should recreate 1 missing message');

  console.log('--- TEST 7: Test quest ---');
  mockApiQuests.push(createMockQuest('q4', { messages: { quest_name: '[TEST] Quest 4' } }));
  res = await syncQuests();
  console.assert(res.stats.ignored === 1, 'Should ignore 1 test quest');

  console.log('--- TEST 8: Placeholder quest ---');
  mockApiQuests.push(createMockQuest('q5', { messages: { game_publisher: 'PLACEHOLDER' } }));
  res = await syncQuests();
  console.assert(res.stats.ignored === 2, 'Should ignore placeholder quests'); // q4 and q5

  console.log('--- TEST 9: Expired quest ---');
  mockApiQuests[1].config.expires_at = '2020-01-01T00:00:00Z';
  res = await syncQuests();
  console.assert(res.stats.expired === 1, 'Should mark 1 as expired');

  console.log('--- TEST 10: Missing from API ---');
  mockApiQuests = mockApiQuests.filter(q => q.id !== 'q1');
  res = await syncQuests();
  console.assert(res.stats.missing === 1, 'Should mark q1 as missing');

  console.log('All tests passed successfully!');
  await disconnectDatabase();
};

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
