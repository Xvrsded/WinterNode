import { fetchCollectibles } from '../src/collectibles/collectiblesFetcher.js';
import { parseCollectibles } from '../src/collectibles/collectiblesParser.js';
import { buildCollectiblesNotifications, getPayloadDiagnostics } from '../src/collectibles/collectiblesNotificationBuilder.js';
import { createDiscordClient } from '../src/discord/client.js';
import { env } from '../src/config/env.js';

const CHANNEL_ID = '1537724207507570739';

const testChunking = async () => {
  const client = createDiscordClient();
  client.once('clientReady', async () => {
    try {
      console.log('Fetching raw API data...');
      const rawData = await fetchCollectibles();
      const releases = parseCollectibles(rawData);
      
      let small, medium, large;
      
      for (const r of releases) {
        if (!small && r.items.length <= 10) small = r;
        if (!medium && r.items.length >= 20 && r.items.length <= 30) medium = r;
        if (!large && r.items.length >= 40) large = r;
      }
      
      const tests = [
        { name: 'SMALL', release: small },
        { name: 'MEDIUM', release: medium },
        { name: 'LARGE', release: large }
      ];

      const channel = await client.channels.fetch(CHANNEL_ID);

      for (const t of tests) {
        if (!t.release) {
          console.warn(`Could not find a release for ${t.name} test.`);
          continue;
        }

        console.log(`\n==================================================`);
        console.log(`TEST: ${t.name} (${t.release.items.length} items) - ${t.release.name}`);
        console.log(`==================================================`);
        
        const payloads = buildCollectiblesNotifications(t.release);
        const diagnostics = getPayloadDiagnostics(payloads, t.release);
        
        console.log('DIAGNOSTICS:');
        console.log(JSON.stringify(diagnostics, null, 2));
        
        if (diagnostics.itemsOmitted > 0) {
          console.error(`ERROR: Omitted ${diagnostics.itemsOmitted} items!`);
          continue;
        }

        console.log(`Sending ${payloads.length} chunks...`);
        for (let i = 0; i < payloads.length; i++) {
          try {
            const msg = await channel.send(payloads[i]);
            console.log(`- Sent Chunk ${i+1}: ${msg.id}`);
            if (msg.crosspostable) {
              await msg.crosspost();
              console.log(`- Crossposted Chunk ${i+1}`);
            }
          } catch(e) {
            console.error(`Failed to send chunk ${i+1}:`, e.message);
            if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
          }
        }
      }

    } catch (e) {
      console.error('Fatal Error:', e);
    }
    client.destroy();
    process.exit(0);
  });
  client.login(env.discord.token);
};

testChunking();
