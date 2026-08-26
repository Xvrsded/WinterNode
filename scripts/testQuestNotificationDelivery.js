import { sendQuestNotification } from '../src/quest/questNotificationService.js';
import { createDiscordClient, getDiscordClient } from '../src/discord/client.js';
import { fetchQuests } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { env } from '../src/config/env.js';
import { DISCORD_CONFIG } from '../src/config/discord.js';

const runTests = async () => {
  console.log('========================================');
  console.log('LIVE QUEST NOTIFICATION TEST');
  console.log('========================================');
  
  const isLiveMode = process.env.QUEST_NOTIFICATION_TEST_SEND === 'true';
  
  if (!isLiveMode) {
    console.log('[QuestNotificationTest] Validation mode');
    console.log('[QuestNotificationTest] Discord send disabled');
    return;
  }

  try {
    console.log('Fetching quests from API...');
    const { data: rawQuests } = await fetchQuests();
    if (!rawQuests || rawQuests.length === 0) {
      console.error('No quests found in API');
      return;
    }

    const regionMap = new Map();
    let selectedQuest = null;

    // Find a quest with a title, game title, and tasks/rewards
    for (const raw of rawQuests) {
      const q = parseQuest(raw, regionMap);
      if (q.title && q.gameTitle && (q.tasks?.length > 0 || q.rewards?.length > 0)) {
        selectedQuest = q;
        break;
      }
    }

    if (!selectedQuest) {
      console.error('Could not find a suitable quest for testing.');
      return;
    }

    // Force syncState to NEW defensive bypass
    selectedQuest.syncState = 'NEW';
    selectedQuest.status = 'NEW';

    console.log(`Quest ID: ${selectedQuest.questId}`);
    console.log(`Quest Title: ${selectedQuest.title}`);
    console.log(`Game: ${selectedQuest.gameTitle}`);
    console.log(`Channel: ${DISCORD_CONFIG.quest.channelId}`);
    console.log(`Guild: ${env.discord.guildId}`);
    console.log(`Role: ${DISCORD_CONFIG.quest.roleId}`);
    console.log('Discord Send: READY');
    console.log('========================================\n');

    console.log('Connecting to Discord...');
    const client = createDiscordClient();
    const readyPromise = new Promise(resolve => client.once('clientReady', resolve));
    await client.login(env.discord.token);
    await readyPromise;

    const result = await sendQuestNotification(selectedQuest);

    console.log('\n========================================');
    console.log('LIVE TEST RESULT');
    console.log('========================================');
    if (result.success) {
      console.log('Status: SUCCESS');
      console.log(`Message ID: ${result.messageId}`);
      console.log(`Channel ID: ${result.channelId}`);
      console.log(`Quest ID: ${result.questId}`);
      console.log('Messages Sent: 1');
    } else {
      console.log('Status: FAILED');
      console.log(`Error: ${result.error}`);
      console.log('Messages Sent: 0');
    }
    console.log('========================================\n');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    const client = getDiscordClient();
    if (client) {
      client.destroy();
    }
    process.exit(0);
  }
};

runTests();
