import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import { runQuestMonitorCycle, startQuestMonitor, stopQuestMonitor, getQuestMonitorStatus } from '../src/quest/questMonitor.js';

// We override the default interval for testing purposes
process.env.QUEST_POLL_INTERVAL_MS = '1000';

const run = async () => {
  try {
    await connectDatabase();
    
    console.log('\n--- MANUAL CYCLE TEST ---');
    const result = await runQuestMonitorCycle();
    console.log('Result:', result ? result.stats : 'Failed');
    
    console.log('\n--- START MONITOR TEST ---');
    await startQuestMonitor();
    
    console.log('Status after start:', getQuestMonitorStatus());
    
    // Duplicate start test
    await startQuestMonitor();
    
    // Wait for at least one interval to trigger overlapping check or normal run
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    console.log('\n--- STOP MONITOR TEST ---');
    stopQuestMonitor();
    console.log('Status after stop:', getQuestMonitorStatus());
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await disconnectDatabase();
  }
};

run();
