import { Client, GatewayIntentBits } from 'discord.js';

let discordClient = null;

export const createDiscordClient = () => {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  return discordClient;
};

export const getDiscordClient = () => {
  return discordClient;
};

export const setDiscordClient = (mockClient) => {
  discordClient = mockClient;
};
