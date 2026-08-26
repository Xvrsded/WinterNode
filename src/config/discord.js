import { env } from './env.js';

export const DISCORD_CONFIG = {
  guildId: env.discord.guildId,
  quest: {
    channelId: "1537724125815242753",
    roleId: "1518223431819329576"
  }
};

// Fixed configuration validation
if (!DISCORD_CONFIG.quest.channelId) {
  throw new Error("Quest channel ID is not configured");
}

if (!DISCORD_CONFIG.quest.roleId) {
  throw new Error("Quest role ID is not configured");
}
