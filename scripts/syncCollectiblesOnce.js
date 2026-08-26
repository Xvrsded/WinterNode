import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import { createDiscordClient } from '../src/discord/client.js';
import { env } from '../src/config/env.js';
import { syncCollectibles } from '../src/collectibles/collectiblesMonitor.js';

const run = async () => {
  await connectDatabase();
  const client = createDiscordClient();
  
  client.once('clientReady', async () => {
    try {
      console.log('Starting one-time production sync...');
      await syncCollectibles(client);
      console.log('Sync complete.');
    } catch (e) {
      console.error('Fatal Error:', e);
    }
    client.destroy();
    await disconnectDatabase();
    process.exit(0);
  });
  
  client.login(env.discord.token);
};

run();
