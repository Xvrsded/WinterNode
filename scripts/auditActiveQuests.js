import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import { fetchQuests } from '../src/quest/questFetcher.js';
import { parseQuest, validateQuestDuration } from '../src/quest/questParser.js';
import { resolveQuestHero } from '../src/quest/questAssetResolver.js';
import { createDiscordClient } from '../src/discord/client.js';
import { DISCORD_CONFIG } from '../src/config/discord.js';
import { fetchAllQuestBotMessages, extractQuestIdFromMessage } from '../src/quest/questNotificationService.js';
import { logger } from '../src/utils/logger.js';

const runAudit = async () => {
  logger.info('Starting strict read-only audit...');
  
  // Fetch API
  const res = await fetchQuests();
  if (!res || !res.data) {
    logger.error('Failed to fetch quests from API');
    process.exit(1);
  }
  const rawQuests = res.data;
  
  // Fetch Discord
  const client = createDiscordClient();
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise(resolve => client.once('ready', resolve));
  const channel = await client.channels.fetch(DISCORD_CONFIG.quest.channelId);
  const botMessages = await fetchAllQuestBotMessages(channel);
  
  const now = new Date();
  
  let stats = {
    totalApi: rawQuests.length,
    active: 0,
    upcoming: 0,
    expired: 0,
    invalid: 0, // test/placeholder
    missingHero: 0,
    anomalousDuration: 0,
    expectedMessages: 0,
    actualQuestMessages: 0,
    missingMessages: 0,
    duplicateIds: 0,
    unexpectedMessages: 0,
    unrelatedMessages: 0
  };
  
  const expectedQuestIds = new Set();
  
  for (const raw of rawQuests) {
    try {
       const q = parseQuest(raw);
       
       if (q.classification === 'test' || q.classification === 'placeholder') {
         stats.invalid++;
         continue;
       }
       
       const startsAt = q.timing?.startsAt ? new Date(q.timing.startsAt) : null;
       const expiresAt = q.timing?.expiresAt ? new Date(q.timing.expiresAt) : null;
       
       if (startsAt && startsAt > now) {
         stats.upcoming++;
         continue;
       }
       if (expiresAt && expiresAt <= now) {
         stats.expired++;
         continue;
       }
       
       const dur = validateQuestDuration(q.timing?.startsAt, q.timing?.expiresAt);
       if (!dur.valid) {
         stats.anomalousDuration++;
         continue;
       }
       
       stats.active++;
       
       // Verify hero
       const hero = await resolveQuestHero(q.assets?.hero);
       if (!hero.valid && hero.reason === 'missing_hero') {
         stats.missingHero++;
       } else if (hero.valid) {
         expectedQuestIds.add(q.questId);
         stats.expectedMessages++;
       }
    } catch(e) {
       stats.invalid++;
    }
  }

  const foundQuestIds = new Map();
  for (const msg of botMessages) {
     const questId = extractQuestIdFromMessage(msg);
     if (!questId) {
       stats.unrelatedMessages++;
       continue;
     }
     
     stats.actualQuestMessages++;
     if (foundQuestIds.has(questId)) {
        foundQuestIds.set(questId, foundQuestIds.get(questId) + 1);
        stats.duplicateIds++;
     } else {
        foundQuestIds.set(questId, 1);
     }
     
     if (!expectedQuestIds.has(questId)) {
        stats.unexpectedMessages++;
     }
  }
  
  for (const expected of expectedQuestIds) {
     if (!foundQuestIds.has(expected)) {
        stats.missingMessages++;
     }
  }
  
  console.log(`
==================================================
QUEST CHANNEL AUDIT
==================================================
API total: ${stats.totalApi}
Active: ${stats.active}
Upcoming: ${stats.upcoming}
Expired: ${stats.expired}
Invalid: ${stats.invalid}
Missing Hero: ${stats.missingHero}
Duration anomalies: ${stats.anomalousDuration}

Expected Quest messages: ${stats.expectedMessages}
Actual Quest messages: ${stats.actualQuestMessages}

Missing: ${stats.missingMessages}
Duplicates: ${stats.duplicateIds}
Unexpected: ${stats.unexpectedMessages}

Unrelated messages preserved: ${stats.unrelatedMessages}
==================================================`);

  client.destroy();
  process.exit(0);
};

runAudit().catch(console.error);
