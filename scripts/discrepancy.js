import { fetchCollectibles } from '../src/collectibles/collectiblesFetcher.js';
import { parseCollectibles } from '../src/collectibles/collectiblesParser.js';
import crypto from 'node:crypto';

(async () => {
    const rawData = await fetchCollectibles();
    const releases = parseCollectibles(rawData);
    
    console.log('Raw API releases:', rawData.length);
    console.log('Parsed releases:', releases.length);
    
    // Find what was dropped
    const rawIds = rawData.map(c => c.sku_id);
    const parsedIds = releases.map(r => r.categorySkuId);
    
    for (const cat of rawData) {
        if (!parsedIds.includes(cat.sku_id)) {
            console.log('Dropped category:', cat.sku_id, cat.name, 'Products length:', cat.products?.length);
        }
    }
    
    const recent = releases.filter(r => r.classification === 'recent');
    for (const r of recent) {
        console.log('\n--- RECENT RELEASE ---');
        console.log('Category name:', r.name);
        console.log('Category SKU ID:', r.categorySkuId);
        console.log('Release Date Proxy:', r.releaseDateProxy);
        console.log('Release Date ISO:', r.releaseDateProxy.toISOString());
        console.log('Classification:', r.classification);
        console.log('Eligible:', r.eligible);
        console.log('Item count:', r.items.length);
        
        // Items Hash
        const sortedItems = [...r.items].sort((a, b) => a.skuId.localeCompare(b.skuId));
        const hashObjects = sortedItems.map(item => ({
            skuId: item.skuId, name: item.name, type: item.type, asset: item.asset,
            regularPrice: item.regularPrice, nitroPrice: item.nitroPrice, orbPrice: item.orbPrice, shopUrl: item.shopUrl
        }));
        
        const stableStringify = (obj) => {
          if (obj === null || obj === undefined) return 'null';
          if (typeof obj !== 'object') return JSON.stringify(obj);
          if (Array.isArray(obj)) return `[${obj.map(item => stableStringify(item)).join(',')}]`;
          const sortedKeys = Object.keys(obj).sort();
          return `{${sortedKeys.map(k => `"${k}":${stableStringify(obj[k])}`).join(',')}}`;
        };
        const jsonString = stableStringify(hashObjects);
        console.log('Items Hash:', crypto.createHash('sha256').update(jsonString).digest('hex'));
        
        if (r.items.length > 0) {
            console.log('First item name:', r.items[0].name);
            console.log('First item SKU:', r.items[0].skuId);
            console.log('Shop URL:', r.items[0].shopUrl);
        }
    }
})();
