import { PermissionsBitField } from 'discord.js';
import { createDiscordClient, getDiscordClient } from '../src/discord/client.js';
import { env } from '../src/config/env.js';
import { DISCORD_CONFIG } from '../src/config/discord.js';

const runAudit = async () => {
  console.log('========================================');
  console.log('DISCORD CONFIGURATION AUDIT');
  console.log('========================================');

  let botUser = null;
  let guildFoundInCache = false;
  let fetchGuild = null;
  let fetchChannel = null;
  let fetchRole = null;
  let channelError = null;
  let guildError = null;
  let roleError = null;

  let viewChannel = 'NO';
  let sendMessages = 'NO';
  let embedLinks = 'NO';

  let configValid = true;
  let configReason = 'Everything looks good.';

  const client = createDiscordClient();
  const readyPromise = new Promise(resolve => client.once('clientReady', resolve));

  try {
    await client.login(env.discord.token);
    await readyPromise;
    
    botUser = client.user;
    console.log('\nBot:');
    console.log(botUser.tag);
    console.log('\nBot ID:');
    console.log(botUser.id);
    console.log('\nGuild ID:');
    console.log(DISCORD_CONFIG.guildId);

    guildFoundInCache = client.guilds.cache.has(DISCORD_CONFIG.guildId);
    console.log('\nGuild Cache:');
    console.log(guildFoundInCache ? 'FOUND' : 'NOT FOUND');

    try {
      fetchGuild = await client.guilds.fetch(DISCORD_CONFIG.guildId);
      console.log('\nGuild Fetch:');
      console.log('SUCCESS');
      console.log('\nGuild Name:');
      console.log(fetchGuild.name);
    } catch (e) {
      guildError = e;
      configValid = false;
      configReason = `Guild Fetch Failed: [${e.code}] ${e.message}`;
      console.log('\nGuild Fetch:');
      console.log('FAILED');
      console.log('\nGuild Name:');
      console.log('N/A');
    }

    console.log('\n========================================');
    console.log('CHANNEL');
    console.log(`\nChannel ID:\n${DISCORD_CONFIG.quest.channelId}`);

    try {
      fetchChannel = await client.channels.fetch(DISCORD_CONFIG.quest.channelId);
      console.log('\nChannel Fetch:');
      console.log('SUCCESS');
      console.log('\nChannel Name:');
      console.log(fetchChannel.name);
      console.log('\nChannel Type:');
      console.log(fetchChannel.type);
      console.log('\nChannel Guild:');
      console.log(fetchChannel.guild?.id || 'N/A');
      console.log('\nChannel Guild Match:');
      const match = fetchChannel.guild?.id === DISCORD_CONFIG.guildId;
      console.log(match ? 'YES' : 'NO');
      if (!match) {
        configValid = false;
        configReason = 'Channel belongs to another guild';
      }
      if (!fetchChannel.isTextBased()) {
        configValid = false;
        configReason = 'Channel is not text-based';
      }
    } catch (e) {
      channelError = e;
      configValid = false;
      configReason = `Channel Fetch Failed: [${e.code}] ${e.message}`;
      console.log('\nChannel Fetch:');
      console.log('FAILED');
      console.log('\nChannel Name:\nN/A');
      console.log('\nChannel Type:\nN/A');
      console.log('\nChannel Guild:\nN/A');
      console.log('\nChannel Guild Match:\nNO');
    }

    console.log('\n========================================');
    console.log('ROLE');
    console.log(`\nRole ID:\n${DISCORD_CONFIG.quest.roleId}`);

    if (fetchGuild) {
      try {
        fetchRole = await fetchGuild.roles.fetch(DISCORD_CONFIG.quest.roleId);
        if (fetchRole) {
          console.log('\nRole Fetch:');
          console.log('SUCCESS');
          console.log('\nRole Name:');
          console.log(fetchRole.name);
          console.log('\nRole Guild:');
          console.log(fetchRole.guild.id);
          console.log('\nRole Guild Match:');
          const match = fetchRole.guild.id === DISCORD_CONFIG.guildId;
          console.log(match ? 'YES' : 'NO');
          if (!match) {
            configValid = false;
            if (configValid) configReason = 'Role belongs to another guild';
          }
        } else {
          configValid = false;
          if (configValid) configReason = 'Role not found in guild';
          console.log('\nRole Fetch:\nFAILED');
          console.log('\nRole Name:\nN/A');
          console.log('\nRole Guild:\nN/A');
          console.log('\nRole Guild Match:\nNO');
        }
      } catch (e) {
        roleError = e;
        configValid = false;
        if (configValid) configReason = `Role Fetch Failed: [${e.code}] ${e.message}`;
        console.log('\nRole Fetch:\nFAILED');
        console.log('\nRole Name:\nN/A');
        console.log('\nRole Guild:\nN/A');
        console.log('\nRole Guild Match:\nNO');
      }
    } else {
      console.log('\nRole Fetch:\nFAILED (Guild not fetched)');
      console.log('\nRole Name:\nN/A');
      console.log('\nRole Guild:\nN/A');
      console.log('\nRole Guild Match:\nNO');
    }

    console.log('\n========================================');
    console.log('BOT PERMISSIONS');

    if (fetchGuild && fetchChannel) {
      const botMember = await fetchGuild.members.fetch(client.user.id).catch(() => null);
      if (botMember) {
        const permissions = fetchChannel.permissionsFor(botMember);
        if (permissions) {
          if (permissions.has(PermissionsBitField.Flags.ViewChannel)) viewChannel = 'YES';
          if (permissions.has(PermissionsBitField.Flags.SendMessages)) sendMessages = 'YES';
          if (permissions.has(PermissionsBitField.Flags.EmbedLinks)) embedLinks = 'YES';
        }
      }
    }
    
    console.log(`\nViewChannel:\n${viewChannel}`);
    console.log(`\nSendMessages:\n${sendMessages}`);
    console.log(`\nEmbedLinks:\n${embedLinks}`);
    
    if (viewChannel === 'NO' || sendMessages === 'NO' || embedLinks === 'NO') {
      configValid = false;
      if (configReason === 'Everything looks good.') {
        configReason = 'Missing required permissions in channel';
      }
    }

    console.log('\n========================================');
    console.log('RESULT');
    console.log(`\nConfiguration:\n${configValid ? 'VALID' : 'INVALID'}`);
    console.log(`\nReason:\n${configReason}`);
    console.log('\nMessages Sent:\n0');
    console.log('\nDatabase Modified:\nNO');
    console.log('\n========================================');

  } catch (err) {
    console.error('Audit crashed unexpectedly:', err);
  } finally {
    const activeClient = getDiscordClient();
    if (activeClient) activeClient.destroy();
    process.exit(0);
  }
};

runAudit();
