import { DISCORD_CONFIG } from '../config/discord.js';
import { logger } from '../utils/logger.js';

export const fetchCollectibles = async () => {
  try {
    logger.info('[Collectibles] Fetch started');
    const response = await fetch('https://api.discordquest.com/api/collectibles', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    logger.info(`[Collectibles] Releases fetched: ${data.length}`);
    return data;
  } catch (error) {
    logger.error(`[Collectibles] Failed to fetch collectibles: ${error.message}`);
    throw error;
  }
};
