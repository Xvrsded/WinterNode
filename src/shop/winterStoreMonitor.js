import { logger } from '../utils/logger.js';
import { winterStoreConfig } from './winterStoreConfig.js';
import { initializeShopPanel, handleCreateTicket, handlePackageSelect, handleCloseTicket, cleanupStaleTickets } from './winterStoreService.js';

let isInitialized = false;

export const initializeWinterStore = async (client) => {
  if (isInitialized) return;
  isInitialized = true;

  logger.info('[WinterStore] Initializing Winter Store module...');

  // Cleanup stale tickets on startup
  await cleanupStaleTickets(client);

  // Set up the shop panel
  await initializeShopPanel(client);

  // Listen for interaction events
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      if (interaction.customId === winterStoreConfig.buttons.createTicket) {
        await handleCreateTicket(interaction);
      } else if (interaction.customId === winterStoreConfig.buttons.closeTicket) {
        await handleCloseTicket(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === winterStoreConfig.menus.selectPackage) {
        await handlePackageSelect(interaction);
      }
    }
  });

  logger.info('[WinterStore] Module initialized.');
};
