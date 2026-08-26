import { Client, GatewayIntentBits } from 'discord.js';
import { fetchQuests, fetchRegions } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { buildQuestNotification } from '../src/quest/questNotificationBuilder.js';
import { env } from '../src/config/env.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  console.log('Discord ready.\n');
  
  try {
    const [questsRes, regionsRes] = await Promise.all([
      fetchQuests().catch(() => null),
      fetchRegions().catch(() => null)
    ]);

    if (!questsRes || !questsRes.data) throw new Error('API fetch failed');

    const rawQuests = questsRes.data;
    const rawRegions = regionsRes?.data?.quests || [];
    const regionMap = new Map();
    for (const r of rawRegions) regionMap.set(r.id, r);

    const now = new Date();

    // Find 3 different types of active quests
    let orbQuest = null;     // Orb reward
    let nonOrbQuest = null;  // Non-orb reward with image asset
    let playQuest = null;    // Play task with duration

    for (const raw of rawQuests) {
      const c = raw.config || {};
      if (!c.expires_at || new Date(c.expires_at) <= now) continue;
      
      const parsed = parseQuest(raw, regionMap);

      // Orb quest
      if (!orbQuest && parsed.rewards.some(r => r.isOrb)) {
        orbQuest = { raw, parsed };
      }

      // Non-orb with image asset (png)
      if (!nonOrbQuest && parsed.rewards.some(r => !r.isOrb && r.asset && r.asset.endsWith('.png'))) {
        nonOrbQuest = { raw, parsed };
      }

      // Play quest with duration
      if (!playQuest && parsed.tasks.some(t => t.type.includes('PLAY') && t.target)) {
        playQuest = { raw, parsed };
      }

      if (orbQuest && nonOrbQuest && playQuest) break;
    }

    const testCases = [
      { label: 'ORB REWARD QUEST', data: orbQuest },
      { label: 'NON-ORB REWARD QUEST (with image)', data: nonOrbQuest },
      { label: 'PLAY QUEST (with duration)', data: playQuest },
    ];

    const channel = await client.channels.fetch('1537724125815242753');

    for (const tc of testCases) {
      console.log('='.repeat(60));
      console.log(`TEST: ${tc.label}`);
      
      if (!tc.data) {
        console.log('  ⚠️  No matching quest found, skipping.\n');
        continue;
      }

      const { parsed } = tc.data;
      
      console.log(`  QUEST: ${parsed.title} (${parsed.questId})`);
      console.log(`  TASKS (${parsed.tasks.length}):`);
      for (const t of parsed.tasks) {
        console.log(`    - type=${t.type} target=${t.target} platform=${t.platform || 'N/A'}`);
      }
      console.log(`  JOIN OPERATOR: ${parsed.joinOperator}`);
      console.log(`  REWARDS (${parsed.rewards.length}):`);
      for (const r of parsed.rewards) {
        console.log(`    - typeName="${r.typeName}" name="${r.name}" isOrb=${r.isOrb} orbAmount=${r.orbAmount} asset="${r.asset || 'NONE'}"`);
      }
      console.log(`  HERO: ${parsed.assets?.hero || 'NONE'}`);

      // Build and send
      try {
        const payload = await buildQuestNotification(parsed);
        const msg = await channel.send(payload);
        console.log(`  ✅ SENT! Message ID: ${msg.id}`);
      } catch (err) {
        console.log(`  ❌ FAILED: ${err.message}`);
      }
      console.log('');
    }

    console.log('Done. Check your Discord channel.');

  } catch (err) {
    console.error('❌ FATAL:', err.stack || err.message);
  }

  client.destroy();
  process.exit(0);
});

client.login(env.discord.token);
