import { fetchQuests, fetchRegions } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { syncActiveQuestsToChannel } from '../src/quest/questNotificationService.js';
import { env } from '../src/config/env.js';
import { createDiscordClient } from '../src/discord/client.js';

const client = createDiscordClient();

client.once('clientReady', async () => {
  console.log('Discord ready. Starting full snapshot sync test...\n');
  
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
    const allQuests = rawQuests.map(raw => parseQuest(raw, regionMap));
    
    const activeQuests = allQuests.filter(q => {
      if (!q.timing) return true;
      if (q.timing.startsAt && new Date(q.timing.startsAt) > now) {
        return false;
      }
      if (q.timing.expiresAt && new Date(q.timing.expiresAt) <= now) {
        return false;
      }
      return true;
    });
    
    // Deduplicate
    const uniqueQuests = [...new Map(activeQuests.map(q => [q.questId, q])).values()];
    
    // Sort by newest startsAt
    uniqueQuests.sort((a, b) => {
      const tA = a.timing?.startsAt ? new Date(a.timing.startsAt).getTime() : 0;
      const tB = b.timing?.startsAt ? new Date(b.timing.startsAt).getTime() : 0;
      return tB - tA; // descending
    });

    await syncActiveQuestsToChannel(uniqueQuests);

  } catch (err) {
    console.error('❌ FATAL:', err.stack || err.message);
  }

  client.destroy();
  process.exit(0);
});

client.login(env.discord.token);
