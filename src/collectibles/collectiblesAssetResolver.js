export const resolveAsset = (item, rawProductData = null) => {
  // Layered asset resolution strategy
  
  // 1. Avatar Decoration: explicit asset identifier for CDN
  if (item.type === 0 && item.asset) {
    return `https://cdn.discordapp.com/avatar-decoration-presets/${item.asset}.png`;
  }
  
  // Profile Effects or other items
  // 1. thumbnailPreviewSrc
  if (item.thumbnailPreviewSrc) {
    return item.thumbnailPreviewSrc;
  }
  
  // 2. asset-based CDN resolution if valid asset identifier exists for profile effects? 
  // Profile effects usually don't have .png on avatar-decoration-presets, but if it exists, let's use standard assets.
  // Actually, for profile effects, if there's an asset string, maybe it's in a different CDN? 
  // Let's just return unavailable if it's type 1 without thumbnailPreviewSrc for now, but the user said:
  // "2. explicit asset identifier 3. other valid asset fields 4. unavailable"
  
  if (item.asset) {
    // If it's not type 0, we can try to return the raw asset as a URL if it looks like one
    if (item.asset.startsWith('http')) {
      return item.asset;
    }
    // Or maybe fallback to standard CDN (might be a generic asset)
    if (item.type === 1) {
       // Profile effects usually have a different CDN structure, but if asset is provided, we can try
       return `https://cdn.discordapp.com/assets/profile_effects/${item.asset}.png`; 
       // Wait, the user said "asset -> Discord CDN avatar-decoration-presets" for Avatar Decoration. 
       // For Profile Effect: 2. asset-based CDN resolution if a valid asset identifier exists.
       // Actually I will just check if item.asset exists and use it.
    }
  }

  // 3. Inspect other available fields (from raw product data if passed)
  if (rawProductData) {
    if (rawProductData.mobile_banner_url) return rawProductData.mobile_banner_url;
    if (rawProductData.catalog_banner_url) return rawProductData.catalog_banner_url;
  }

  return null;
};
