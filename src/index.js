import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './database/mongodb.js';
import { createDiscordClient } from './discord/client.js';
import { startQuestMonitor, stopQuestMonitor } from './quest/questMonitor.js';
import { startCollectiblesMonitor, stopCollectiblesMonitor } from './collectibles/collectiblesMonitor.js';
import { initializeWinterStore } from './shop/winterStoreMonitor.js';

let isShuttingDown = false;
let client;

const start = async () => {
  try {
    logger.info('Starting Discord Quest Notifier...');
    
    // Connect to MongoDB
    await connectDatabase();
    
    // Create Discord client
    logger.info('Connecting to Discord...');
    client = createDiscordClient();
    
    client.once('clientReady', async () => {
      logger.info('Discord client ready');
      logger.info('Discord Quest Notifier is online');
      
      // Start Quest Monitor after Discord and DB are ready
      await startQuestMonitor();
      
      // Start Collectibles Monitor
      await startCollectiblesMonitor(client);
      
      // Initialize Winter Store
      await initializeWinterStore(client);
    });

    client.on('error', (error) => {
      logger.error('Discord client encountered an error');
    });

    // Login to Discord
    await client.login(env.discord.token);
    
  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info('Shutdown signal received');
  
  try {
    stopQuestMonitor();
    stopCollectiblesMonitor();
    
    if (client) {
      client.destroy();
      logger.info('Discord client disconnected');
    }
    
    await disconnectDatabase();
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
