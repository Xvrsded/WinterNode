import { buildQuestNotification } from '../src/quest/questNotificationBuilder.js';

const runTests = () => {
  console.log('========================================');
  console.log('TEST 1: COMPLETE QUEST');
  console.log('========================================');
  const questComplete = {
    questId: "12345",
    title: "Awesome Quest Event",
    gameTitle: "Minecraft",
    publisher: "Discord",
    timing: {
      startsAt: "2024-01-01T00:00:00.000Z",
      expiresAt: "2030-01-01T00:00:00.000Z"
    },
    tasks: [
      { type: "STREAM_ON_DESKTOP", target: 600 },
      { type: "PLAY_GAME", target: null }
    ],
    rewards: [
      { name: "Orange Jetpack", redemptionLink: "https://discord.com" },
      { name: "Diamond Sword" }
    ],
    regions: {
      isGlobal: true,
      include: [],
      exclude: []
    },
    assets: {
      hero: "https://cdn.discordapp.com/assets/hero.png",
      gameTile: "https://cdn.discordapp.com/assets/tile.png"
    }
  };
  printNotification(buildQuestNotification(questComplete));

  console.log('========================================');
  console.log('TEST 2: MISSING REWARDS');
  console.log('========================================');
  const questNoRewards = { ...questComplete, rewards: [] };
  printNotification(buildQuestNotification(questNoRewards));

  console.log('========================================');
  console.log('TEST 3: MISSING TASKS');
  console.log('========================================');
  const questNoTasks = { ...questComplete, tasks: [] };
  printNotification(buildQuestNotification(questNoTasks));

  console.log('========================================');
  console.log('TEST 4: MISSING REGIONS (isGlobal null)');
  console.log('========================================');
  const questNoRegions = { ...questComplete, regions: { isGlobal: null } };
  printNotification(buildQuestNotification(questNoRegions));

  console.log('========================================');
  console.log('TEST 5: MISSING HERO & INVALID URL');
  console.log('========================================');
  const questNoHero = { ...questComplete, assets: { hero: "hero.png", gameTile: "https://valid.com/tile.png" } };
  printNotification(buildQuestNotification(questNoHero));
  
  console.log('========================================');
  console.log('TEST 6: MISSING TITLE');
  console.log('========================================');
  const questNoTitle = { ...questComplete, title: null };
  printNotification(buildQuestNotification(questNoTitle));
};

const printNotification = (notification) => {
  console.log(`Content: ${notification.content}`);
  console.log(`Embed JSON:`);
  console.log(JSON.stringify(notification.embeds[0].toJSON(), null, 2));
  console.log('\n');
};

runTests();
