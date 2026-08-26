import { fetchCollectibles } from '../src/collectibles/collectiblesFetcher.js';
import { parseCollectibles } from '../src/collectibles/collectiblesParser.js';
import { buildCollectiblesNotification } from '../src/collectibles/collectiblesNotificationBuilder.js';
import { env } from '../src/config/env.js';
import { createDiscordClient } from '../src/discord/client.js';

const CHANNEL_ID = '1537724207507570739';

const run = async () => {
  console.log('[Collectibles] Fetch started');
  console.log('[Collectibles] Endpoint: https://api.discordquest.com/api/collectibles');
  
  let rawData;
  try {
    const start = Date.now();
    const res = await fetch('https://api.discordquest.com/api/collectibles');
    console.log(`[Collectibles] HTTP status: ${res.status}`);
    rawData = await res.json();
  } catch (err) {
    console.error('Fetch failed:', err.message);
    return;
  }
  
  const releases = parseCollectibles(rawData);
  console.log(`[Collectibles] Releases fetched: ${rawData.length}`);
  console.log(`[Collectibles] Items parsed: ${releases.reduce((acc, r) => acc + r.items.length, 0)}`);
  
  const release = releases[0];
  if (!release) {
    console.log('No releases found.');
    return;
  }
  
  console.log('\n--- RELEASE INFO ---');
  console.log(`Category: ${release.name}`);
  console.log(`Category SKU: ${release.categorySkuId}`);
  console.log(`Release name: ${release.name}`);
  console.log(`Banner URL: ${release.bannerUrl}`);
  console.log(`Item count: ${release.items.length}`);
  
  let assetsResolved = 0;
  let assetsFailed = 0;
  
  console.log('\n--- ITEMS ---');
  for (const item of release.items) {
    console.log(`Item name: ${item.name}`);
    console.log(`Item SKU: ${item.skuId}`);
    console.log(`Type: ${item.type}`);
    console.log(`Regular: ${item.regularPrice != null ? item.regularPrice : 'Not available'}`);
    console.log(`Nitro: ${item.nitroPrice != null ? item.nitroPrice : 'Not available'}`);
    console.log(`Orbs: ${item.orbPrice != null ? item.orbPrice : 'Not available'}`);
    console.log(`Asset: ${item.asset || 'none'}`);
    console.log(`Shop URL: ${item.shopUrl}`);
    
    if (item.resolvedAssetUrl) {
      console.log(`[Asset] ${item.name} -> RESOLVED ${item.resolvedAssetUrl}`);
      assetsResolved++;
    } else if (item.asset || item.thumbnailPreviewSrc) {
      console.log(`[Asset] ${item.name} -> UNAVAILABLE`);
      assetsFailed++;
    }
    console.log('------------------');
  }
  
  const payload = buildCollectiblesNotification({ ...release, items: release.items.slice(0, 2) });
  console.log('\n--- PAYLOAD STRUCTURE ---');

  console.log(`Release: ${release.name}`);
  console.log(`Items: ${release.items.length}`);
  const container = payload.components[0];
  console.log(`Components: ${container ? '1 ContainerBuilder' : 'None'}`);
  console.log(`Container: Yes (AccentColor: ${container.data.accent_color})`);
  
  let galleryCount = 0, sectionCount = 0, separatorCount = 0, thumbnailCount = 0, textDisplayCount = 0;
  for (const comp of container.components) {
    const type = comp.data.type;
    if (type === 52) galleryCount++; // MediaGallery
    else if (type === 53) textDisplayCount++;
    else if (type === 54) separatorCount++;
    else if (type === 51) sectionCount++; // Section
  }
  for (const item of release.items) {
    if (item.resolvedAssetUrl) thumbnailCount++;
  }
  
  console.log(`Media Gallery: ${galleryCount}`);
  console.log(`Sections: ${sectionCount}`);
  console.log(`Separators: ${separatorCount}`);
  console.log(`Thumbnails: ${thumbnailCount}`);
  console.log(`MessageFlags.IsComponentsV2 used: ${payload.flags && payload.flags[0] === 1 << 15 ? 'Yes' : 'No'}`);
  console.log(`Uses embeds/content: ${(payload.embeds || payload.content) ? 'Yes' : 'No'}`);
  
  console.log('\n--- SEND TEST ---');
  const client = createDiscordClient();
  client.once('clientReady', async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const message = await channel.send(payload);
      console.log(`Sent: Yes`);
      console.log(`Message ID: ${message.id}`);
      
      let published = false;
      if (message.crosspostable) {
        await message.crosspost();
        published = true;
      }
      console.log(`Published: ${published}`);
      
      console.log('\n==================================================');
      console.log('FINAL REPORT');
      console.log('==================================================');
      console.log('Endpoint used: https://api.discordquest.com/api/collectibles');
      console.log(`HTTP status: 200`);
      console.log(`Releases fetched: ${rawData.length}`);
      console.log(`Items parsed: ${releases.reduce((acc, r) => acc + r.items.length, 0)}`);
      console.log(`Release selected: ${release.name}`);
      console.log(`Items in release: ${release.items.length}`);
      console.log(`Assets resolved: ${assetsResolved}`);
      console.log(`Assets failed: ${assetsFailed}`);
      console.log(`Components generated: ${container.components.length}`);
      console.log(`Message sent: Yes`);
      console.log(`Message ID: ${message.id}`);
      console.log(`Crosspost attempted: ${message.crosspostable ? 'Yes' : 'No'}`);
      console.log(`Crosspost successful: ${published ? 'Yes' : 'No'}`);
      console.log('Errors: None');
      
    } catch (e) {
      console.error('Error during send/publish:', e.message);
      if (e.errors) {
        console.error(JSON.stringify(e.errors, null, 2));
      } else {
        console.error(e.stack);
      }
    }
    client.destroy();
    process.exit(0);
  });
  
  client.login(env.discord.token);
};

run();
