import { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { winterStoreConfig } from './winterStoreConfig.js';
import { ShopPanel } from '../database/models/ShopPanel.js';
import { ShopTicket } from '../database/models/ShopTicket.js';
import { Counter } from '../database/models/Counter.js';
import { buildShopMessagePayload } from './winterStoreBuilder.js';

export const cleanupStaleTickets = async (client) => {
  try {
    const openTickets = await ShopTicket.find({ status: 'open' }).sort({ createdAt: 1 });
    
    const userTicketMap = new Map();

    for (const ticket of openTickets) {
      let isStale = false;
      try {
        const channel = await client.channels.fetch(ticket.channelId);
        if (!channel) isStale = true;
      } catch (error) {
        // If 404 Unknown Channel, it's stale
        if (error.code === 10003) {
          isStale = true;
        } else {
          // Keep it open if discord API is just down
          logger.warn(`[WinterStore] Could not fetch channel ${ticket.channelId}: ${error.message}`);
          continue; 
        }
      }

      if (isStale) {
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closeReason = 'channel_missing';
        await ticket.save();
        logger.info(`[WinterStore] Cleaned up stale ticket ${ticket.ticketId}`);
        continue;
      }

      // Check duplicate active ticket for user
      if (userTicketMap.has(ticket.userId)) {
        logger.info(`[WinterStore] Found duplicate active ticket for user ${ticket.userId}: ${ticket.ticketId}`);
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closeReason = 'duplicate_active_ticket';
        await ticket.save();
        
        try {
          const dupChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
          if (dupChannel) await dupChannel.delete();
        } catch(e) {}
      } else {
        userTicketMap.set(ticket.userId, ticket);
      }
    }
  } catch (error) {
    logger.error(`[WinterStore] Error cleaning up stale tickets: ${error.message}`);
  }
};

export const getActiveTicketCount = async (client) => {
  await cleanupStaleTickets(client);
  const count = await ShopTicket.countDocuments({ status: 'open' });
  return count;
};

export const initializeShopPanel = async (client) => {
  try {
    await cleanupStaleTickets(client);

    const channelId = winterStoreConfig.channelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      logger.error(`[WinterStore] SHOP_CHANNEL_NOT_FOUND: ${channelId}`);
      return;
    }

    const { payload, hash } = buildShopMessagePayload();
    let shopPanelDocs = await ShopPanel.find({ type: 'winter_store', channelId });

    if (shopPanelDocs.length > 1) {
      logger.info(`[WinterStore] Found duplicate shop panels (${shopPanelDocs.length}). Pruning...`);
      const canonicalDoc = shopPanelDocs[0];
      
      for (let i = 1; i < shopPanelDocs.length; i++) {
        const doc = shopPanelDocs[i];
        try {
          const msgToDel = await channel.messages.fetch(doc.messageId).catch(() => null);
          if (msgToDel) await msgToDel.delete();
        } catch (e) {}
        await ShopPanel.deleteOne({ _id: doc._id });
      }
      shopPanelDocs = [canonicalDoc];
    }

    let panelDoc = shopPanelDocs[0];
    let panelMessage = null;

    if (panelDoc) {
      panelMessage = await channel.messages.fetch(panelDoc.messageId).catch(() => null);
      if (!panelMessage) {
        logger.info('[WinterStore] Saved shop message not found in channel. Recreating...');
        await ShopPanel.deleteOne({ _id: panelDoc._id });
        panelDoc = null;
      }
    }

    if (!panelDoc || !panelMessage) {
      logger.info('[WinterStore] Creating new shop panel message...');
      panelMessage = await channel.send(payload);
      
      await ShopPanel.create({
        channelId,
        messageId: panelMessage.id,
        hash
      });
      logger.info(`[WinterStore] Created shop panel ${panelMessage.id}`);
    } else {
      if (panelDoc.hash !== hash) {
        logger.info('[WinterStore] Hash changed. Updating shop panel message...');
        await panelMessage.edit(payload);
        panelDoc.hash = hash;
        await panelDoc.save();
        logger.info('[WinterStore] Shop panel message updated.');
      } else {
        logger.info('[WinterStore] Hash unchanged. Skipping update.');
      }
    }
  } catch (error) {
    if (error.code === 50013) {
      logger.error('[WinterStore] MISSING_PERMISSIONS in shop channel');
    } else if (error.name === 'DiscordAPIError') {
      logger.error(`[WinterStore] DISCORD_API_ERROR: ${error.message}`);
    } else {
      logger.error(`[WinterStore] Error initializing shop panel: ${error.message}`);
    }
  }
};

export const handleCreateTicket = async (interaction) => {
  try {
    // 1. Cleanup and check active tickets for this user
    await cleanupStaleTickets(interaction.client);
    
    const existingTicket = await ShopTicket.findOne({ userId: interaction.user.id, status: 'open' });
    if (existingTicket) {
      return interaction.reply({ content: `❄️ Kamu masih memiliki ticket aktif.\n\nTicket:\n<#${existingTicket.channelId}>\n\nSilakan selesaikan ticket tersebut terlebih dahulu.`, ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(winterStoreConfig.menus.selectPackage)
      .setPlaceholder('🛍️ Pilih paket yang ingin kamu pesan');

    Object.values(winterStoreConfig.products).forEach(category => {
      category.items.forEach(item => {
        selectMenu.addOptions({
          label: item.name,
          description: `${item.description} • ${item.price}`.substring(0, 100),
          value: item.id
        });
      });
    });

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('❄️ Winter Store — Pilih Produk')
      .setDescription('Sebelum membuat ticket, silakan pilih produk atau layanan yang ingin kamu pesan dari menu di bawah.\n\n📦 Pilih paket yang sesuai dengan kebutuhanmu.')
      .setColor('#00FFFF');

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    logger.error(`[WinterStore] Error opening package selector: ${error.message}`);
    await interaction.reply({ content: 'Terjadi kesalahan saat membuka menu. Silakan coba lagi.', ephemeral: true }).catch(() => {});
  }
};

export const handlePackageSelect = async (interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guild = interaction.guild;
    const packageId = interaction.values[0];

    // Final check for active tickets before creating channel
    await cleanupStaleTickets(interaction.client);
    const existingTicket = await ShopTicket.findOne({ userId, status: 'open' });
    if (existingTicket) {
      return interaction.editReply({ content: `❄️ Kamu masih memiliki ticket aktif.\n\nTicket:\n<#${existingTicket.channelId}>\n\nSilakan selesaikan ticket tersebut terlebih dahulu.` });
    }

    let selectedItem = null;
    let selectedCategory = null;

    for (const category of Object.values(winterStoreConfig.products)) {
      const item = category.items.find(i => i.id === packageId);
      if (item) {
        selectedItem = item;
        selectedCategory = category;
        break;
      }
    }

    if (!selectedItem) {
      return interaction.editReply({ content: '❌ Paket tidak valid. Silakan coba lagi.' });
    }

    // Atomic Queue
    const counter = await Counter.findOneAndUpdate(
      { id: 'winterStoreTickets' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const queueNumber = counter.seq;
    const queueString = String(queueNumber).padStart(3, '0');

    // Channel naming
    const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPackage = selectedItem.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const ticketName = `${queueString}-${cleanPackage}-${cleanUsername}`.substring(0, 100);

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ],
      }
    ];

    const staffRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('staff') || r.name.toLowerCase().includes('admin'));
    if (staffRole) {
      permissionOverwrites.push({
        id: staffRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages
        ],
      });
    }

    const channelOptions = {
      name: ticketName,
      type: ChannelType.GuildText,
      permissionOverwrites,
    };

    if (winterStoreConfig.ticketCategoryId) {
      channelOptions.parent = winterStoreConfig.ticketCategoryId;
    }

    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create(channelOptions);
    } catch (e) {
       logger.error(`[WinterStore] Error creating ticket channel: ${e.message}`);
       return interaction.editReply({ content: '❌ Gagal membuat channel ticket.' });
    }

    await ShopTicket.create({
      ticketId: ticketName,
      channelId: ticketChannel.id,
      userId,
      username: interaction.user.username,
      queueNumber,
      packageId: selectedItem.id,
      packageName: selectedItem.name,
      packagePrice: selectedItem.price,
      status: 'open'
    });
    
    // Get active count
    const activeCount = await getActiveTicketCount(interaction.client);

    // Premium Embed construction
    const embed = new EmbedBuilder()
      .setTitle('❄️ WINTER STORE\nORDER TICKET')
      .setDescription('Terima kasih telah menghubungi Winter Store!\nPesanan kamu berhasil dibuat.\n\n────────────────')
      .setColor('#00FFFF')
      .setFooter({ text: `Winter Store • Order #${queueString}` })
      .setTimestamp();

    // Dynamically build product details string based on package fields
    let productDetailsStr = `> **Product**\n> ${selectedItem.name}\n\n`;
    
    if (selectedItem.label && selectedItem.label !== selectedItem.name) {
      productDetailsStr += `> **Package**\n> ${selectedItem.label}\n\n`;
    }
    
    if (selectedItem.method) {
      productDetailsStr += `> **Method**\n> ${selectedItem.method}\n\n`;
    }
    
    productDetailsStr += `> **Price**\n> ${selectedItem.price}`;
    
    if (selectedItem.hosting) {
      productDetailsStr += `\n\n> **Hosting**\n> ${selectedItem.hosting}`;
    }

    embed.addFields(
      { name: '🛍️ ORDER DETAILS', value: productDetailsStr },
      { name: '────────────────', value: '\u200B' },
      { name: '👤 CUSTOMER', value: `> **Customer**\n> <@${userId}>\n\n> **Order**\n> #${queueString}\n\n> **Status**\n> 🟡 Waiting for Staff\n\n> **Active Queue**\n> ${activeCount} orders` },
      { name: '────────────────', value: '\u200B' },
      { name: '📋 WHAT\'S NEXT?', value: 'Kirim detail kebutuhanmu di bawah.\nStaff akan membantu kamu sampai proses selesai.' }
    );

    const closeButton = new ButtonBuilder()
      .setCustomId(winterStoreConfig.buttons.closeTicket)
      .setLabel('🔒 Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder().addComponents(closeButton);

    const initialMessageContent = staffRole ? `<@&${staffRole.id}> ❄️ New Winter Store order! Order #${queueString} telah dibuat.` : `❄️ New Winter Store order! Order #${queueString} telah dibuat.`;

    await ticketChannel.send({ content: initialMessageContent, embeds: [embed], components: [actionRow] });

    await interaction.editReply({ content: `✅ Ticket berhasil dibuat!\n\nProduk:\n**${selectedItem.name}**\n\nNomor Antrian:\n**#${queueString}**\n\nTicket:\n<#${ticketChannel.id}>` });

  } catch (error) {
    logger.error(`[WinterStore] Error processing package select: ${error.message}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Gagal memproses pesanan. Silakan coba lagi atau hubungi staff.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.editReply({ content: '❌ Gagal memproses pesanan. Silakan coba lagi atau hubungi staff.' }).catch(() => {});
    }
  }
};

export const handleCloseTicket = async (interaction) => {
  try {
    const channelId = interaction.channel.id;
    
    // Immediate database state update
    const ticket = await ShopTicket.findOneAndUpdate(
      { channelId, status: 'open' },
      { status: 'closed', closedAt: new Date(), closeReason: 'user_closed' },
      { new: true }
    );

    await interaction.reply({ content: 'Ticket akan ditutup dalam 3 detik...' });
    
    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (error) {
        logger.error(`[WinterStore] Error deleting ticket channel: ${error.message}`);
      }
    }, 3000);

  } catch (error) {
    logger.error(`[WinterStore] Error closing ticket: ${error.message}`);
  }
};
