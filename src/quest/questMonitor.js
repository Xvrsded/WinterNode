import { syncQuests } from './questSyncService.js';
import { questService } from './questService.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let monitorTimer = null;
let isRunning = false;
let isSyncRunning = false;

const state = {
  running: false,
  syncRunning: false,
  intervalMs: env.quest.pollInterval,
  lastRunAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastResult: null
};

export const getQuestMonitorStatus = () => {
  return { ...state };
};

export const runQuestMonitorCycle = async () => {
  if (isSyncRunning) {
    logger.warn('[QuestMonitor] Sync already running. Skipping overlapping cycle.');
    return null;
  }

  isSyncRunning = true;
  state.syncRunning = true;
  state.lastRunAt = new Date();
  logger.info('[QuestMonitor] Sync started');

  try {
    const currentDbCount = await questService.getQuestCount();
    
    // We run the actual sync process from Phase 3B
    const result = await syncQuests();
    
    if (result.total === 0 && currentDbCount > 0) {
      logger.warn('[QuestMonitor] API returned zero quests — skipping destructive actions');
    } else if (result.total < currentDbCount) {
      logger.info('[QuestMonitor] Quest count decreased; no destructive action performed');
    }
    
    state.lastSuccessAt = new Date();
    state.lastResult = result;
    
    const { created, updated, unchanged, recreated, deleted } = result.stats;
    
    if (created === 0 && updated === 0 && recreated === 0 && deleted === 0) {
      logger.info('[QuestMonitor] No changes detected');
    } else {
      logger.info(`[QuestMonitor] Sync completed\nTotal: ${result.total}\nCreated: ${created}\nUpdated: ${updated}\nRecreated: ${recreated}\nDeleted: ${deleted}\nUnchanged: ${unchanged}`);
    }

    return result;
  } catch (error) {
    state.lastErrorAt = new Date();
    logger.error(`[QuestMonitor] Sync failed: ${error.message}`);
    return null;
  } finally {
    isSyncRunning = false;
    state.syncRunning = false;
  }
};

export const startQuestMonitor = async () => {
  if (isRunning) {
    logger.warn('[QuestMonitor] Quest monitor already running');
    return;
  }
  
  isRunning = true;
  state.running = true;
  logger.info('[QuestMonitor] Starting');
  
  // Start the first cycle immediately
  await runQuestMonitorCycle();

  // Schedule the interval
  monitorTimer = setInterval(async () => {
    await runQuestMonitorCycle();
  }, state.intervalMs);
};

export const stopQuestMonitor = () => {
  if (!isRunning) {
    return;
  }
  
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  
  isRunning = false;
  state.running = false;
  logger.info('[QuestMonitor] Stopped');
};
