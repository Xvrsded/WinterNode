import fs from 'fs';

const APP_ID = process.env.COLLECTIBLES_APP_ID || '106342118330761216'; // Fallback to a placeholder

const resolveCollectibleShopUrl = (itemSkuId) => {
  return {
    url: `https://discord.com/application-directory/${APP_ID}/store/${itemSkuId}`,
    type: "ITEM",
    applicationId: APP_ID,
    skuId: itemSkuId
  };
};

const run = () => {
  const data = JSON.parse(fs.readFileSync('collectibles_debug.json', 'utf8'));
  
  // Find "Underworld" category or fallback to the first one
  const category = data.find(c => c.name.toLowerCase().includes('underworld')) || data[0];
  
  // Find "Eternal Damnation (Blue)" or fallback
  const product = category.products.find(p => p.name === 'Eternal Damnation (Blue)') || category.products[0];
  
  const shopResult = resolveCollectibleShopUrl(product.sku_id);
  
  console.log('==================================================');
  console.log('COLLECTIBLE ITEM RESOLUTION TEST');
  console.log('==================================================');
  console.log(`Name:\n${product.name}\n`);
  console.log(`Category SKU:\n${category.sku_id}\n`);
  console.log(`Item SKU:\n${product.sku_id}\n`);
  console.log(`Application ID:\n${shopResult.applicationId}\n`);
  console.log(`Generated Shop URL:\n${shopResult.url}\n`);
  console.log(`Shop URL Type:\n${shopResult.type}\n`);
  console.log('==================================================');
};

run();
