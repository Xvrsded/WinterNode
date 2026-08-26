import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } from 'discord.js';
import { env } from '../src/config/env.js';
import { createDiscordClient } from '../src/discord/client.js';

const CHANNEL_ID = '1537724207507570739';

const testLimits = async () => {
  const client = createDiscordClient();
  client.once('clientReady', async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      
      // Binary search or loop to find max sections
      const container1 = new ContainerBuilder().setAccentColor(0x5865F2);
      for(let i=0; i<15; i++) {
        const section = new SectionBuilder();
        section.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Item ${i}`));
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL('https://cdn.discordapp.com/avatar-decoration-presets/a_33656b7ed12cde00c1826b654cf65590.png'));
        container1.addSectionComponents(section);
      }

      const container2 = new ContainerBuilder().setAccentColor(0x5865F2);
      for(let i=15; i<30; i++) {
        const section = new SectionBuilder();
        section.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Item ${i}`));
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL('https://cdn.discordapp.com/avatar-decoration-presets/a_33656b7ed12cde00c1826b654cf65590.png'));
        container2.addSectionComponents(section);
      }
      
      const payload = {
        components: [container1, container2],
        flags: [MessageFlags.IsComponentsV2]
      };
      
      console.log('Sending payload with 2 containers (15 sections each)...');
      await channel.send(payload);
      console.log('Success with 30 sections!');
    } catch(e) {
      console.error('Failed:', e.message);
      if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
    }
    client.destroy();
    process.exit(0);
  });
  client.login(env.discord.token);
};

testLimits();
