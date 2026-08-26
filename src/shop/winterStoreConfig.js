export const winterStoreConfig = {
  channelId: process.env.WINTER_STORE_CHANNEL_ID || '1537724513146376263',
  ticketCategoryId: process.env.WINTER_SHOP_TICKET_CATEGORY_ID || null,
  panelId: 'winter-store-panel',
  buttons: {
    createTicket: 'winter_shop:create_ticket',
    closeTicket: 'winter_shop:close_ticket'
  },
  menus: {
    selectPackage: 'winter_shop:select_package'
  },
  products: {
    serverBoost: {
      title: '🚀 SERVER BOOST',
      items: [
        { id: 'boost_1_month', name: 'Boost Server — 1 Bulan', description: '14x Boost', price: 'Rp70.000', label: '14x Boost • 1 Month', showPriceInPanel: 'Rp70.000' },
        { id: 'boost_3_month', name: 'Boost Server — 3 Bulan', description: '14x Boost', price: 'Rp170.000', label: '14x Boost • 3 Months', showPriceInPanel: 'Rp170.000' }
      ]
    },
    discordAccount: {
      title: '👤 DISCORD ACCOUNT',
      items: [
        { id: 'decorated_account', name: 'Akun Discord Dekorasi', description: 'Akun Discord dekorasi', price: 'Mulai Rp70.000', label: 'Decorated Discord Account', showPriceInPanel: 'Starting from Rp70.000' }
      ]
    },
    questService: {
      title: '🎯 QUEST SERVICE',
      items: [
        { id: 'quest_joki', name: 'Joki Quest', description: 'Jasa joki Quest', price: 'Hubungi Staff', method: 'Via Login', label: 'Quest Joki', showPriceInPanel: 'Contact Staff' }
      ]
    },
    serverSetup: {
      title: '🛠️ SERVER SETUP',
      items: [
        { id: 'server_setup_basic', name: 'Server Setup — Basic', description: 'Setup server Discord', price: 'Mulai Rp30.000', label: 'Basic', showPriceInPanel: 'Rp30.000+' },
        { id: 'server_setup_premium', name: 'Server Setup — Premium', description: 'Setup server Discord', price: 'Mulai Rp70.000', label: 'Premium', showPriceInPanel: 'Rp70.000+' }
      ]
    },
    customBot: {
      title: '🤖 CUSTOM BOT',
      items: [
        { id: 'custom_bot', name: 'Custom Discord Bot', description: 'Custom bot', price: 'Rp150.000–Rp350.000', label: 'Custom Discord Bot', showPriceInPanel: 'Rp150.000 – Rp350.000' },
        { id: 'custom_bot_hosting', name: 'Custom Bot + Hosting', description: 'Custom bot + hosting', price: 'Rp150.000–Rp350.000 + Rp20.000', label: 'Hosting', showPriceInPanel: '+Rp20.000', hosting: 'Optional +Rp20.000' }
      ]
    },
    discordNitro: {
      title: '💎 DISCORD NITRO',
      items: [
        { id: 'nitro_link_3_month', name: 'Nitro Link — 3 Bulan', description: 'Nitro Link', price: 'Rp25.000', label: 'Nitro Link 3 Months', showPriceInPanel: 'Rp25.000' },
        { id: 'nitro_login_1_month', name: 'Nitro — 1 Bulan', description: 'Via Login', price: 'Rp40.000', method: 'Via Login', label: 'Nitro 1 Month via Login', showPriceInPanel: 'Rp40.000' },
        { id: 'nitro_login_3_month', name: 'Nitro — 3 Bulan', description: 'Via Login', price: 'Rp80.000', method: 'Via Login', label: 'Nitro 3 Months via Login', showPriceInPanel: 'Rp80.000' }
      ]
    }
  }
};
