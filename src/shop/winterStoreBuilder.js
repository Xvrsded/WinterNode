import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import crypto from 'crypto';
import { winterStoreConfig } from './winterStoreConfig.js';

export const buildShopMessagePayload = () => {
  const embed = new EmbedBuilder()
    .setTitle('❄️ WINTER STORE')
    .setDescription('"Your Discord needs, all in one place."\n\nSelamat datang di Winter Store!\nMenyediakan berbagai kebutuhan Discord mulai dari Boost, Nitro, akun dekorasi, jasa setup server, joki Quest, hingga custom bot Discord.')
    .setColor('#00FFFF') // Cyan / Snow blue
    .setFooter({ text: 'Winter Store • Trusted Discord Services' });

  const products = winterStoreConfig.products;

  embed.addFields(
    { name: '━━━━━━━━━━━━━━━━━━━━', value: '\u200B' },
    {
      name: products.serverBoost.title,
      value: products.serverBoost.items.map(item => `**${item.label}**\n${item.showPriceInPanel}`).join('\n\n')
    },
    { name: '━━━━━━━━━━━━━━━━━━━━', value: '\u200B' },
    {
      name: products.discordAccount.title,
      value: products.discordAccount.items.map(item => `**${item.label}**\n${item.showPriceInPanel}`).join('\n\n')
    },
    { name: '━━━━━━━━━━━━━━━━━━━━', value: '\u200B' },
    {
      name: products.questService.title,
      value: products.questService.items.map(item => `**${item.label}**\n${item.method}\n${item.showPriceInPanel}`).join('\n\n')
    },
    { name: '━━━━━━━━━━━━━━━━━━━━', value: '\u200B' },
    {
      name: products.serverSetup.title,
      value: products.serverSetup.items.map(item => `**${item.label}** — ${item.showPriceInPanel}`).join('\n')
    },
    { name: '━━━━━━━━━━━━━━━━━━━━', value: '\u200B' },
    {
      name: products.customBot.title,
      value: products.customBot.items.map(item => `**${item.label}**\n${item.showPriceInPanel}`).join('\n')
    },
    { name: '━━━━━━━━━━━━━━━━━━━━', value: '\u200B' },
    {
      name: products.discordNitro.title,
      value: products.discordNitro.items.map(item => `**${item.label}** — ${item.showPriceInPanel}`).join('\n')
    },
    { name: '━━━━━━━━━━━━━━━━━━━━', value: '\u200B' }
  );

  const button = new ButtonBuilder()
    .setCustomId(winterStoreConfig.buttons.createTicket)
    .setLabel('🛒 Buat Pesanan')
    .setStyle(ButtonStyle.Primary);

  const actionRow = new ActionRowBuilder().addComponents(button);

  const payload = {
    embeds: [embed],
    components: [actionRow]
  };

  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  return { payload, hash };
};
