import { PermissionsBitField, ChannelType } from 'discord.js';
import { getDiscordClient } from '../discord/client.js';
import { DISCORD_CONFIG } from '../config/discord.js';
import { buildQuestNotification } from './questNotificationBuilder.js';
import { logger } from '../utils/logger.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getChannel = async (client) => {
  const channelId = DISCORD_CONFIG.quest.channelId;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error('Channel not found');
  if (!channel.isTextBased() || channel.isDMBased()) throw new Error('Invalid channel type');
  if (channel.guild.id !== DISCORD_CONFIG.guildId) throw new Error('Wrong guild');
  
  const botMember = channel.guild.members.me;
  const permissions = channel.permissionsFor(botMember);
  if (!permissions.has(PermissionsBitField.Flags.ViewChannel) || !permissions.has(PermissionsBitField.Flags.SendMessages)) {
    throw new Error('Missing permissions');
  }
  return channel;
};

export const fetchAllQuestBotMessages = async (channel) => {
  let messages = [];
  let lastId = undefined;
  
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    
    const batch = await handleRateLimit(() => channel.messages.fetch(options));
    if (batch.size === 0) break;
    
    // Filter to only messages sent by this bot
    const botMessages = batch.filter(m => m.author.id === channel.client.user.id);
    messages.push(...botMessages.values());
    
    lastId = batch.last().id;
  }
  
  return messages;
};

export const extractQuestIdFromMessage = (message) => {
  if (!message || !message.components || message.components.length === 0) return null;
  const raw = JSON.stringify(message.components);
  const match = raw.match(/Quest ID: `([0-9A-Za-z_-]+)`/);
  if (match) return match[1];
  return null;
};

const handleRateLimit = async (operation) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (err.status === 429) {
        // Discord API Rate Limit
        const retryAfter = err.global ? err.retryAfter : (err.retryAfter || 5000);
        logger.warn(`[QUEST] Rate limited (429). Retrying after ${retryAfter}ms (Attempt ${attempt}/3)...`);
        await delay(retryAfter + 500); // add a safety buffer
        if (attempt === 3) throw new Error('Rate limit exceeded after 3 attempts');
        continue;
      }
      throw err;
    }
  }
};

const attemptCrosspost = async (message) => {
  if (message.channel.type === ChannelType.GuildAnnouncement && message.crosspostable) {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Crosspost timeout')), 5000));
      await handleRateLimit(() => Promise.race([message.crosspost(), timeoutPromise]));
      logger.info(`[QUEST] Crossposted message ${message.id}`);
    } catch (err) {
      logger.warn(`[QUEST] Crosspost failed for ${message.id}: ${err.message}`);
    }
  }
};

export const sendQuestNotification = async (quest) => {
  const client = getDiscordClient();
  if (!client || !client.isReady()) {
    return { success: false, questId: quest.questId, error: 'Client not ready' };
  }

  try {
    const channel = await getChannel(client);
    const payload = await buildQuestNotification(quest);

    const message = await handleRateLimit(() => channel.send(payload));
    
    logger.info(`[QUEST] Sent new quest notification (Quest: ${quest.questId}, Message: ${message.id})`);
    
    // Attempt crosspost async
    attemptCrosspost(message).catch(() => {});
    
    return {
      success: true,
      questId: quest.questId,
      messageId: message.id,
      channelId: channel.id
    };

  } catch (error) {
    logger.error(`[QUEST] Failed to send quest notification (Quest: ${quest.questId}): ${error.message}`);
    return { success: false, questId: quest.questId, error: error.message };
  }
};

export const editQuestNotification = async (quest, messageId, channelId, verifyOnly = false) => {
  if (!messageId) return { success: false, error: 'Message not found' };

  const client = getDiscordClient();
  if (!client || !client.isReady()) {
    return { success: false, questId: quest.questId, error: 'Client not ready' };
  }

  try {
    const channel = await getChannel(client);
    const message = await handleRateLimit(() => channel.messages.fetch({ message: messageId, force: true }).catch(() => null));

    if (!message) {
      return { success: false, error: 'Message not found' };
    }

    if (verifyOnly) {
      return { success: true, messageId: message.id, channelId: channel.id };
    }

    const payload = await buildQuestNotification(quest);
    await handleRateLimit(() => message.edit(payload));
    
    logger.info(`[QUEST] Edited existing quest notification (Quest: ${quest.questId}, Message: ${message.id})`);

    return {
      success: true,
      questId: quest.questId,
      messageId: message.id,
      channelId: channel.id
    };

  } catch (error) {
    logger.error(`[QUEST] Failed to edit quest notification (Quest: ${quest.questId}): ${error.message}`);
    if (error.message === 'Message not found' || error.status === 404) {
      return { success: false, error: 'Message not found' };
    }
    return { success: false, questId: quest.questId, error: error.message };
  }
};

export const deleteQuestNotification = async (questId, messageId, channelId) => {
  if (!messageId) return { success: true }; // Nothing to delete

  const client = getDiscordClient();
  if (!client || !client.isReady()) {
    return { success: false, error: 'Client not ready' };
  }

  try {
    const channel = await getChannel(client);
    const message = await handleRateLimit(() => channel.messages.fetch({ message: messageId, force: true }).catch(() => null));

    if (!message) {
      // Already deleted
      return { success: true };
    }

    await handleRateLimit(() => message.delete());
    return { success: true };
  } catch (error) {
    logger.error(`[QUEST] Failed to delete quest notification (Quest: ${questId}, Message: ${messageId}): ${error.message}`);
    return { success: false, error: error.message };
  }
};
