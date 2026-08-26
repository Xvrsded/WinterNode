import { sendQuestNotification } from '../src/quest/questNotificationService.js';
import { createDiscordClient, getDiscordClient } from '../src/discord/client.js';
import { fetchQuests, fetchRegions } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { env } from '../src/config/env.js';
import { DISCORD_CONFIG } from '../src/config/discord.js';
import { logger } from '../src/utils/logger.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const run = async () => {
  console.log('========================================');
  console.log('SENDING ALL ACTIVE QUESTS TO DISCORD');
  console.log('========================================');
  
  try {
    const [questsRes, regionsRes] = await Promise.all([
      fetchQuests().catch(() => null),
      fetchRegions().catch(() => null)
    ]);

    if (!questsRes || !questsRes.data) {
      throw new Error('API fetch failed');
    }
    
    const rawQuests = questsRes.data;
    const rawRegions = regionsRes?.data?.quests || [];
    const regionMap = new Map();
    for (const r of rawRegions) {
      regionMap.set(r.id, r);
    }

    const now = new Date();
    
    const activeQuests = [];
    
    for (const raw of rawQuests) {
      const parsed = parseQuest(raw, regionMap);
      
      // Check if it's active
      if (parsed.timing && parsed.timing.expiresAt) {
        const expiresAt = new Date(parsed.timing.expiresAt);
        if (expiresAt > now) {
          activeQuests.push(parsed);
        }
      } else {
        // No expiry, assume active
        activeQuests.push(parsed);
      }
    }
    
    console.log(`Found ${activeQuests.length} active quests.`);
    
    if (activeQuests.length === 0) {
      console.log('No active quests to send.');
      return;
    }

    const client = createDiscordClient();
    const readyPromise = new Promise(resolve => client.once('clientReady', resolve));
    await client.login(env.discord.token);
    await readyPromise;
    console.log('Discord client ready.');

    let successCount = 0;
    
    for (let i = 0; i < activeQuests.length; i++) {
      const quest = activeQuests[i];
      
      // Bypass the normal protection for this forced broadcast
      quest.syncState = 'NEW';
      quest.status = 'NEW';
      
      console.log(`Sending quest ${i + 1}/${activeQuests.length}: ${quest.title}`);
      
      const result = await sendQuestNotification(quest);
      if (result.success) {
        successCount++;
        console.log(`-> Success (Message ID: ${result.messageId})`);
      } else {
        console.log(`-> Failed: ${result.error}`);
      }
      
      if (i < activeQuests.length - 1) {
        // Sleep for 3 seconds between messages to avoid rate limits
        await delay(3000);
      }
    }
    
    console.log('========================================');
    console.log(`Finished! Successfully sent ${successCount}/${activeQuests.length} active quests.`);
    console.log('========================================');

  } catch (error) {
    console.error('Script crashed:', error.message);
  } finally {
    const activeClient = getDiscordClient();
    if (activeClient) activeClient.destroy();
    process.exit(0);
  }
};

run();
