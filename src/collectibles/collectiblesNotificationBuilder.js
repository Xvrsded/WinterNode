import { ContainerBuilder, SectionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, ThumbnailBuilder, MessageFlags } from 'discord.js';

export const buildCollectiblesNotifications = (release) => {
  const payloads = [];
  const MAX_COMPONENTS_PER_MESSAGE = 38; // Safety margin below 40

  let currentChunkItems = [];
  let currentChunkIndex = 0;
  
  // Base logic to create a payload
  const createPayload = (chunkItems, chunkIndex, isTotalCalculated, totalChunksEst) => {
    const container = new ContainerBuilder().setAccentColor(0x5865F2);
    
    // Title
    const titleText = isTotalCalculated && totalChunksEst > 1
      ? `## ${release.name || 'New Collectible Release'} • Part ${chunkIndex + 1}/${totalChunksEst}`
      : `## ${release.name || 'New Collectible Release'}`;
      
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(titleText));
    
    if (chunkIndex === 0 && release.bannerUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(release.bannerUrl))
      );
    }
    
    for (const item of chunkItems) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      
      let content = `**[${item.name}](${item.shopUrl})**\n\n**Price:**\n`;
      content += `$${item.regularPrice != null ? item.regularPrice.toFixed(2) : 'Not available'} Regular\n`;
      content += `$${item.nitroPrice != null ? item.nitroPrice.toFixed(2) : 'Not available'} Nitro\n`;
      if (item.orbPrice != null) {
        content += `${Math.min(item.orbPrice, 4100).toLocaleString()} Orbs`;
      } else {
        content += `🔷 Not available`;
      }
      
      const textBuilder = new TextDisplayBuilder().setContent(content);
      
      if (item.resolvedAssetUrl) {
        const section = new SectionBuilder();
        section.addTextDisplayComponents(textBuilder);
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL(item.resolvedAssetUrl));
        container.addSectionComponents(section);
      } else {
        container.addTextDisplayComponents(textBuilder);
      }
    }
    
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    
    // Add deterministic identity marker via zero-width space link
    const marker = `collectible-release:${release.categorySkuId}:part:${chunkIndex}`;
    const footerText = `*Find these items in the Discord Shop*\n[\u200B](https://discord.com/shop#${marker})`;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerText));
    
    return {
      components: [container],
      flags: [MessageFlags.IsComponentsV2]
    };
  };

  // We chunk by simulating how many components each item adds
  const chunkedItemSets = [];
  let tempChunk = [];
  
  for (let i = 0; i < release.items.length; i++) {
    tempChunk.push(release.items[i]);
    
    // Calculate size of current tempChunk
    // 1 container + 1 title + 2 footer = 4 base components
    // First chunk has +1 banner = 5 base components
    const baseComponents = (chunkedItemSets.length === 0 && release.bannerUrl) ? 5 : 4;
    
    let itemsComponents = 0;
    for (const item of tempChunk) {
      itemsComponents += 1; // Separator
      if (item.resolvedAssetUrl) {
         itemsComponents += 3; // Section + TextDisplay + Thumbnail
      } else {
         itemsComponents += 1; // TextDisplay
      }
    }
    
    const totalComponents = baseComponents + itemsComponents;
    
    if (totalComponents > MAX_COMPONENTS_PER_MESSAGE) {
      // Revert adding this item and push current chunk
      tempChunk.pop();
      if (tempChunk.length > 0) {
        chunkedItemSets.push([...tempChunk]);
      }
      // Start new chunk with this item
      tempChunk = [release.items[i]];
    }
  }
  
  if (tempChunk.length > 0) {
    chunkedItemSets.push([...tempChunk]);
  }

  // Now build the actual payloads with the correct total parts count
  for (let i = 0; i < chunkedItemSets.length; i++) {
    payloads.push(createPayload(chunkedItemSets[i], i, true, chunkedItemSets.length));
  }
  
  return payloads;
};

export const getPayloadDiagnostics = (payloads, release) => {
  let totalComponents = 0;
  let textDisplays = 0;
  let sections = 0;
  let thumbnails = 0;
  let separators = 0;
  let galleries = 0;
  let containers = payloads.length;
  let itemsRendered = 0;
  let chars = 0;
  
  for (const payload of payloads) {
    const container = payload.components[0];
    const str = JSON.stringify(payload);
    chars += str.length;
    
    totalComponents += 1; // The container itself
    
    for (const comp of container.components) {
      totalComponents += 1;
      
      let type = comp.data?.type ?? comp.type;
      
      if (type === 12) galleries++; 
      else if (type === 10) {
        textDisplays++;
        if (comp.data?.content?.includes('**Price:**') || comp.content?.includes('**Price:**')) itemsRendered++;
      }
      else if (type === 14) separators++;
      else if (type === 9) {
        sections++;
        itemsRendered++; // Each section is an item
        totalComponents += 1;
        if (comp.data?.accessory || comp.thumbnail || comp.accessory) {
          totalComponents += 1;
          thumbnails++;
        }
      }
    }
  }
  
  return {
    totalItems: release.items.length,
    itemsRendered,
    itemsOmitted: release.items.length - itemsRendered,
    totalComponents,
    containers,
    textDisplays,
    sections,
    thumbnails,
    separators,
    galleries,
    estimatedPayloadSize: chars
  };
};
