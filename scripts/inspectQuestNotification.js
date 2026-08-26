import { fetchQuests } from '../src/quest/questFetcher.js';
import { parseQuest } from '../src/quest/questParser.js';
import { buildQuestNotification } from '../src/quest/questNotificationBuilder.js';
import { createQuestContentHash } from '../src/utils/hash.js'; // to simulate DB hydration

const runAudit = async () => {
  try {
    const { data: rawQuests } = await fetchQuests();
    
    // We only need regionMap if we fetch regions, for this audit we'll mock an empty map
    // or just pass a new Map() since region mapping isn't strictly required to not crash
    const regionMap = new Map();
    
    console.log(`Fetched ${rawQuests.length} quests. Auditing 10 variations...\n`);
    
    const auditedQuests = rawQuests.slice(0, 10);
    
    for (const raw of auditedQuests) {
      const q = parseQuest(raw, regionMap);
      
      console.log('========================================');
      console.log('QUEST NOTIFICATION PAYLOAD AUDIT');
      console.log('========================================');
      console.log(`Quest ID: ${q.questId}`);
      console.log(`Title: ${q.title}`);
      console.log(`Game: ${q.gameTitle}`);
      console.log(`Hero: ${q.assets?.hero || 'none'}`);
      console.log(`Game Tile: ${q.assets?.gameTile || 'none'}`);
      console.log(`Logotype: ${q.assets?.logotype || 'none'}`);
      
      console.log(`Resolved Hero: ASSET_URL_UNRESOLVED`);
      console.log(`Resolved Game Tile: ASSET_URL_UNRESOLVED`);
      console.log(`Resolved Logotype: ASSET_URL_UNRESOLVED`);
      
      const payload = buildQuestNotification(q);
      const embed = payload.embeds[0].toJSON();
      
      console.log('\n========================================');
      console.log('EMBED');
      console.log('========================================');
      console.log(`Title: ${embed.title}`);
      console.log(`Description: ${embed.description || 'none'}`);
      
      console.log(`Fields: ${embed.fields?.length || 0}`);
      if (embed.fields) {
        embed.fields.forEach(f => {
          console.log(`  - [${f.name}] ${f.value.substring(0, 50).replace(/\n/g, '\\n')}...`);
        });
      }
      
      console.log(`Image: ${embed.image?.url || 'none'}`);
      console.log(`Thumbnail: ${embed.thumbnail?.url || 'none'}`);
      console.log(`Footer: ${embed.footer?.text || 'none'}`);
      
      console.log('\n========================================');
      console.log('Discord Send: NO');
      console.log('========================================\n');
    }
  } catch (error) {
    console.error('Audit failed:', error);
  }
};

runAudit();
