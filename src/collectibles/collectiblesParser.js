import { resolveAsset } from './collectiblesAssetResolver.js';
import { getSnowflakeDate, COLLECTIBLES_CUTOFF_DATE } from './collectiblesConfig.js';
import { logger } from '../utils/logger.js';

export const parseCollectibles = (categories) => {
  const releases = [];
  
  if (!Array.isArray(categories)) {
    return releases;
  }

  for (const cat of categories) {
    if (!cat.products || cat.products.length === 0) continue;
    
    const releaseDateProxy = getSnowflakeDate(cat.sku_id);
    let classification = "invalid";
    let eligible = false;
    
    if (releaseDateProxy) {
      if (releaseDateProxy.getTime() >= new Date(COLLECTIBLES_CUTOFF_DATE).getTime()) {
        classification = "recent";
        eligible = true;
      } else {
        classification = "historical";
      }
    }
    
    const release = {
      categorySkuId: cat.sku_id,
      name: cat.name,
      bannerUrl: cat.hero_banner_url || cat.catalog_banner_url || null,
      releaseDateProxy,
      classification,
      eligible,
      items: []
    };
    
    for (const prod of cat.products) {
      let regularPrice = null;
      let nitroPrice = null;
      let orbPrice = null;
      
      if (prod.prices) {
        // Try to get regular price ("0")
        if (prod.prices["0"] && prod.prices["0"].country_prices && prod.prices["0"].country_prices.prices) {
          for (const p of prod.prices["0"].country_prices.prices) {
            if (p.currency === 'usd') {
              regularPrice = p.amount / Math.pow(10, p.exponent !== undefined ? p.exponent : 2);
            }
            if (p.currency === 'discord_orb') {
              orbPrice = p.amount;
            }
          }
        }
        
        // Try to get nitro price ("4" or "1")
        const nitroPriceObj = prod.prices["4"] || prod.prices["1"];
        if (nitroPriceObj && nitroPriceObj.country_prices && nitroPriceObj.country_prices.prices) {
          for (const p of nitroPriceObj.country_prices.prices) {
            if (p.currency === 'usd') {
              nitroPrice = p.amount / Math.pow(10, p.exponent !== undefined ? p.exponent : 2);
            }
          }
        }
      }
      
      let rawAsset = null;
      if (prod.items && prod.items.length > 0) {
        rawAsset = prod.items[0].asset;
      }
      
      const itemData = {
        skuId: prod.sku_id,
        name: prod.name,
        type: prod.type,
        asset: rawAsset,
        thumbnailPreviewSrc: prod.thumbnailPreviewSrc, // for resolver
        regularPrice,
        nitroPrice,
        orbPrice,
        shopUrl: `https://discord.com/shop#itemSkuId=${prod.sku_id}`
      };
      
      itemData.resolvedAssetUrl = resolveAsset(itemData, prod);
      
      // Clean up properties not needed in DB (like thumbnailPreviewSrc)
      delete itemData.thumbnailPreviewSrc;
      
      release.items.push(itemData);
    }
    
    releases.push(release);
  }
  
  // Sort descending by releaseDateProxy (newest first)
  releases.sort((a, b) => {
    const timeA = a.releaseDateProxy ? a.releaseDateProxy.getTime() : 0;
    const timeB = b.releaseDateProxy ? b.releaseDateProxy.getTime() : 0;
    return timeB - timeA;
  });
  
  return releases;
};
