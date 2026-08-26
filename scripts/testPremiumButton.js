import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { env } from '../src/config/env.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const channelId = '1537724207507570739'; // Collectibles channel
    const channel = await client.channels.fetch(channelId);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('dummy') // Premium buttons don't usually have customId, they just have skuId. Let's see discord.js usage.
        // Actually, discord.js v14.27.0 ButtonBuilder has setSkuId
    );
    
    const premiumButton = {
      type: 2,
      style: 6,
      sku_id: '1533919389806493928'
    };
      
    console.log('Sending message with Premium Button...');
    await channel.send({
      content: 'Test Premium Button for SKU: 1533919389806493928',
      components: [
        {
          type: 1, // ActionRow
          components: [
            premiumButton
          ]
        }
      ]
    });
    console.log('Successfully sent Premium Button!');
  } catch (error) {
    console.error('Failed to send Premium Button:', error.message);
    if (error.rawError) {
        console.error('Raw Error:', JSON.stringify(error.rawError, null, 2));
    }
  } finally {
    client.destroy();
  }
});

client.login(env.discord.token);
