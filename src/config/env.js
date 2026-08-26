import dotenv from 'dotenv';

dotenv.config();

export const env = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID
  },
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  quest: {
    apiUrl: process.env.QUEST_API_URL,
    pollInterval: process.env.QUEST_POLL_INTERVAL_MS ? parseInt(process.env.QUEST_POLL_INTERVAL_MS, 10) : 300000
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  shop: {
    channelId: process.env.WINTER_STORE_CHANNEL_ID || '1537724513146376263',
    ticketCategoryId: process.env.WINTER_SHOP_TICKET_CATEGORY_ID || null
  }
};

const missingVariables = [];

if (!env.discord.token) missingVariables.push('DISCORD_TOKEN');
if (!env.mongodb.uri) missingVariables.push('MONGODB_URI');

if (missingVariables.length > 0) {
  console.error(`[ERROR] Missing required environment variables: ${missingVariables.join(', ')}`);
  process.exit(1);
}
