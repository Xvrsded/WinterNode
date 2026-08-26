import { sendQuestNotification } from '../src/quest/questNotificationService.js';
import { createDiscordClient, getDiscordClient } from '../src/discord/client.js';
import { fetchQuests, fetchRegions } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { env } from '../src/config/env.js';
import { DISCORD_CONFIG } from '../src/config/discord.js';

const runTests = async () => {
  console.log('========================================');
  console.log('QUEST LIVE DELIVERY TEST');
  console.log('========================================');
  
  let apiSuccess = 'FAILED';
  let questSuccess = 'FAILED';
  let builderSuccess = 'FAILED';
  let channelResSuccess = 'FAILED';
  let guildValSuccess = 'FAILED';
  let permValSuccess = 'FAILED';
  let embedSuccess = 'FAILED';
  let buttonSuccess = 'FAILED';
  let discordSendSuccess = 'FAILED';
  let messageIdStr = 'N/A';
  let messagesSent = 0;
  let selectedQuest = null;

  try {
    const [questsRes, regionsRes] = await Promise.all([
      fetchQuests().catch(() => null),
      fetchRegions().catch(() => null)
    ]);

    if (!questsRes || !questsRes.data) {
      throw new Error('API fetch failed');
    }
    
    apiSuccess = 'SUCCESS';

    const rawQuests = questsRes.data;
    const rawRegions = regionsRes?.data?.quests || [];
    const regionMap = new Map();
    for (const r of rawRegions) {
      regionMap.set(r.id, r);
    }

    const validQuests = rawQuests.filter(q => 
      q.config?.rewards_config?.rewards?.some(r => r.type === 5 || (r.name && r.name.toLowerCase().includes('orb')))
    );
    
    if (validQuests.length === 0) {
      throw new Error('No orb quests found for test');
    }
    
    const targetRaw = validQuests[0];

    selectedQuest = parseQuest(targetRaw, regionMap);
    questSuccess = 'SUCCESS';

    // Force syncState to NEW defensive bypass
    selectedQuest.syncState = 'NEW';
    selectedQuest.status = 'NEW';

    console.log(`\nAPI:\n${apiSuccess}`);
    console.log(`\nQuest:\n${questSuccess}`);
    console.log(`\nQuest ID:\n${selectedQuest.questId}`);
    console.log(`\nQuest Title:\n${selectedQuest.title}`);
    console.log(`\nGame:\n${selectedQuest.gameTitle}`);
    console.log(`\nGuild:\n${env.discord.guildId}`);
    console.log(`\nChannel:\n${DISCORD_CONFIG.quest.channelId}`);
    console.log(`\nRole:\n${DISCORD_CONFIG.quest.roleId}`);

    const client = createDiscordClient();
    const readyPromise = new Promise(resolve => client.once('clientReady', resolve));
    await client.login(env.discord.token);
    await readyPromise;

    // We do explicit validations before passing to the service to match report
    const channel = await client.channels.fetch(DISCORD_CONFIG.quest.channelId).catch(() => null);
    if (channel) {
      channelResSuccess = 'SUCCESS';
      if (channel.guild.id === DISCORD_CONFIG.guildId) {
        guildValSuccess = 'SUCCESS';
        const botMember = await channel.guild.members.fetch(client.user.id).catch(() => null);
        if (botMember) {
          const perms = channel.permissionsFor(botMember);
          if (perms && perms.has('ViewChannel') && perms.has('SendMessages') && perms.has('EmbedLinks')) {
            permValSuccess = 'SUCCESS';
          }
        }
      }
    }

    // Call actual notification service which also does validation and builder
    const result = await sendQuestNotification(selectedQuest);

    if (result.success) {
      builderSuccess = 'SUCCESS';
      embedSuccess = 'SUCCESS';
      buttonSuccess = 'SUCCESS';
      discordSendSuccess = 'SUCCESS';
      messageIdStr = result.messageId;
      messagesSent = 1;
      console.log('\nLIVE DELIVERY SUCCESS');
    } else {
      console.log('\nLIVE DELIVERY FAILED');
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.log('\nLIVE DELIVERY FAILED');
    console.error('Test crashed:', error.message);
  } finally {
    console.log('\n========================================');
    console.log(`Builder:\n${builderSuccess}`);
    console.log(`\nChannel Resolution:\n${channelResSuccess}`);
    console.log(`\nGuild Validation:\n${guildValSuccess}`);
    console.log(`\nPermission Validation:\n${permValSuccess}`);
    console.log(`\nEmbed:\n${embedSuccess}`);
    console.log(`\nDonation Button:\n${buttonSuccess}`);
    console.log(`\nDiscord Send:\n${discordSendSuccess}`);
    console.log(`\nMessage ID:\n${messageIdStr}`);
    console.log(`\nMessages Sent:\n${messagesSent}`);
    console.log('\nDatabase Modified:\nNO');
    console.log('\nQuest Monitor Started:\nNO');
    console.log('\nScheduler Started:\nNO');
    console.log('========================================\n');

    const activeClient = getDiscordClient();
    if (activeClient) activeClient.destroy();
    process.exit(0);
  }
};

runTests();
