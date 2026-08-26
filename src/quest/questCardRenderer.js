import sharp from 'sharp';
import https from 'https';
import { resolveQuestAsset, resolveRewardAsset } from './questAssetResolver.js';

// Helper to fetch image buffer
const fetchImageBuffer = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 400) {
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
    }).on('error', () => resolve(null));
  });
};

// Simple text wrapper
const wrapText = (text, maxChars) => {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length > maxChars) {
      if (currentLine.length > 0) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }
  return lines;
};

const escapeXml = (unsafe) => {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
};

const formatDateRange = (startsAt, expiresAt) => {
  const formatIsoDate = (isoString) => {
    if (!isoString) return 'Unknown';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Unknown';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return 'Unknown';
    }
  };
  return `${formatIsoDate(startsAt)} - ${formatIsoDate(expiresAt)}`;
};

const formatTaskName = (taskType) => {
  if (!taskType) return 'Unknown task';
  return taskType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export const renderQuestCard = async (quest) => {
  const CARD_WIDTH = 900;
  const PADDING_X = 40;
  let currentY = 40;
  
  let svgContent = '';
  
  // 1. Title
  const titleText = `New Quest - ${quest.title || 'Unknown Quest'}`;
  const titleLines = wrapText(titleText, 50);
  
  titleLines.forEach(line => {
    svgContent += `<text x="${PADDING_X}" y="${currentY}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1e1e1e">${escapeXml(line)}</text>\n`;
    currentY += 34;
  });
  currentY += 20;

  // 2. Hero Image
  const heroUrl = await resolveQuestAsset(quest.assets?.hero, 'hero') || await resolveQuestAsset(quest.assets?.gameTile, 'gameTile');
  let heroHeight = 250;
  const heroWidth = CARD_WIDTH - (PADDING_X * 2);
  
  if (heroUrl) {
    const imgData = await fetchImageBuffer(heroUrl);
    if (imgData) {
      const base64 = imgData.buffer.toString('base64');
      svgContent += `<image x="${PADDING_X}" y="${currentY}" width="${heroWidth}" height="${heroHeight}" preserveAspectRatio="xMidYMid slice" href="data:${imgData.contentType};base64,${base64}" clip-path="url(#heroClip)" />\n`;
    } else {
      svgContent += `<rect x="${PADDING_X}" y="${currentY}" width="${heroWidth}" height="${heroHeight}" rx="12" fill="#f0f0f0" />\n`;
      svgContent += `<text x="${CARD_WIDTH/2}" y="${currentY + heroHeight/2}" font-family="Arial, sans-serif" font-size="20" fill="#888" text-anchor="middle">QUEST IMAGE UNAVAILABLE</text>\n`;
    }
  } else {
    svgContent += `<rect x="${PADDING_X}" y="${currentY}" width="${heroWidth}" height="${heroHeight}" rx="12" fill="#f0f0f0" />\n`;
    svgContent += `<text x="${CARD_WIDTH/2}" y="${currentY + heroHeight/2}" font-family="Arial, sans-serif" font-size="20" fill="#888" text-anchor="middle">QUEST IMAGE UNAVAILABLE</text>\n`;
  }
  
  currentY += heroHeight + 30;
  
  // Separator
  svgContent += `<line x1="${PADDING_X}" y1="${currentY}" x2="${CARD_WIDTH - PADDING_X}" y2="${currentY}" stroke="#e0e0e0" stroke-width="2" />\n`;
  currentY += 40;

  // 3. Quest Info
  svgContent += `<text x="${PADDING_X}" y="${currentY}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1e1e1e">Quest Info</text>\n`;
  currentY += 35;
  
  const drawInfoLine = (label, value) => {
    if (!value) return;
    const valueLines = wrapText(value, 70);
    svgContent += `<text x="${PADDING_X}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#444">${escapeXml(label)}</text>`;
    svgContent += `<text x="${PADDING_X + 230}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#333">${escapeXml(valueLines[0])}</text>\n`;
    currentY += 26;
    for (let i = 1; i < valueLines.length; i++) {
      svgContent += `<text x="${PADDING_X + 230}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#333">${escapeXml(valueLines[i])}</text>\n`;
      currentY += 26;
    }
  };

  const durationStr = formatDateRange(quest.timing?.startsAt, quest.timing?.expiresAt);
  drawInfoLine('Duration:', durationStr);
  
  let platformsStr = 'Cross Platform';
  if (quest.platforms && quest.platforms.length > 0) {
    platformsStr = quest.platforms.map(p => {
      switch (p) {
        case 0: return 'Cross Platform';
        case 1: return 'Xbox';
        case 2: return 'PlayStation';
        case 3: return 'Switch';
        case 4: return 'PC';
        default: return `Platform ${p}`;
      }
    }).join(', ');
  }
  drawInfoLine('Redeemable Platforms:', platformsStr);
  
  if (quest.gameTitle) {
    drawInfoLine('Game:', `${quest.gameTitle}${quest.publisher ? ` (${quest.publisher})` : ''}`);
  }
  
  if (quest.application?.name) {
    drawInfoLine('Application:', `${quest.application.name}${quest.application.id ? ` (${quest.application.id})` : ''}`);
  }
  
  if (quest.features && quest.features.length > 0) {
    drawInfoLine('Features:', quest.features.join(', '));
  }
  
  currentY += 20;
  
  // Separator
  svgContent += `<line x1="${PADDING_X}" y1="${currentY}" x2="${CARD_WIDTH - PADDING_X}" y2="${currentY}" stroke="#e0e0e0" stroke-width="2" />\n`;
  currentY += 40;

  // 4. Tasks
  svgContent += `<text x="${PADDING_X}" y="${currentY}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1e1e1e">Tasks</text>\n`;
  currentY += 35;
  svgContent += `<text x="${PADDING_X}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#555">User must complete any of the following tasks</text>\n`;
  currentY += 30;

  if (quest.tasks && quest.tasks.length > 0) {
    quest.tasks.forEach(task => {
      let taskDesc = `${formatTaskName(task.type)}`;
      if (task.target) {
        if (task.type.includes('STREAM') || task.type.includes('WATCH') || task.type.includes('PLAY')) {
          taskDesc += ` (${task.target} seconds)`;
        } else {
          taskDesc += ` (${task.target})`;
        }
      }
      const wrappedTask = wrapText(taskDesc, 75);
      svgContent += `<circle cx="${PADDING_X + 10}" cy="${currentY - 6}" r="4" fill="#333" />\n`;
      wrappedTask.forEach((line, i) => {
        svgContent += `<text x="${PADDING_X + 25}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#333">${escapeXml(line)}</text>\n`;
        currentY += 26;
      });
      currentY += 4;
    });
  } else {
    svgContent += `<text x="${PADDING_X + 25}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#333">No tasks specified</text>\n`;
    currentY += 26;
  }
  
  currentY += 20;

  // Separator
  svgContent += `<line x1="${PADDING_X}" y1="${currentY}" x2="${CARD_WIDTH - PADDING_X}" y2="${currentY}" stroke="#e0e0e0" stroke-width="2" />\n`;
  currentY += 40;

  // 5. Rewards
  svgContent += `<text x="${PADDING_X}" y="${currentY}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1e1e1e">Rewards</text>\n`;
  currentY += 35;
  
  let firstValidRewardImage = null;
  let rewardImageBase64 = null;
  let rewardImageContentType = null;

  // We need to fetch the image BEFORE doing layout if we want to know it's valid
  for (const reward of (quest.rewards || [])) {
    if (reward.asset && !firstValidRewardImage) {
      const resolvedUrl = await resolveRewardAsset(reward.asset);
      if (resolvedUrl) {
        const imgData = await fetchImageBuffer(resolvedUrl);
        if (imgData) {
          firstValidRewardImage = resolvedUrl;
          rewardImageBase64 = imgData.buffer.toString('base64');
          rewardImageContentType = imgData.contentType;
        }
      }
    }
  }

  const rewardContentStartX = PADDING_X;
  const rewardContentWidth = firstValidRewardImage ? 600 : CARD_WIDTH - (PADDING_X * 2);

  if (quest.rewards && quest.rewards.length > 0) {
    quest.rewards.forEach(reward => {
      let rType = 'Unknown';
      if (reward.type === 1) rType = 'In-Game Item';
      else if (reward.type === 2) rType = 'Avatar Decoration';
      else if (reward.type === 3) rType = 'Avatar Frame';
      else if (reward.type === 4) rType = 'Profile Item';
      else if (reward.type === 5) rType = 'Virtual Currency';
      else if (reward.type != null) rType = `Type ${reward.type}`;

      const printRewardLine = (label, val) => {
        if (!val) return;
        const vLines = wrapText(val, firstValidRewardImage ? 45 : 70);
        svgContent += `<text x="${rewardContentStartX}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#444">${escapeXml(label)}</text>`;
        svgContent += `<text x="${rewardContentStartX + 150}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#333">${escapeXml(vLines[0])}</text>\n`;
        currentY += 26;
        for (let i = 1; i < vLines.length; i++) {
          svgContent += `<text x="${rewardContentStartX + 150}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#333">${escapeXml(vLines[i])}</text>\n`;
          currentY += 26;
        }
      };

      printRewardLine('Reward Type:', rType);
      if (reward.skuId) printRewardLine('SKU ID:', reward.skuId);
      if (reward.name) printRewardLine('Name:', reward.name);
      
      if (reward.name && (reward.name.toLowerCase().includes('orb') || reward.name.toLowerCase().includes('orbs'))) {
        const amountMatch = reward.name.match(/\d+/);
        if (amountMatch) {
          printRewardLine('Orbs Amount:', amountMatch[0]);
        }
      }
      
      if (reward.redemptionLink) {
        printRewardLine('Info:', 'Redeem Reward');
      }
      currentY += 15;
    });
  } else {
    svgContent += `<text x="${rewardContentStartX}" y="${currentY}" font-family="Arial, sans-serif" font-size="18" fill="#333">No rewards specified</text>\n`;
    currentY += 26;
  }

  // Draw Reward Image
  if (firstValidRewardImage && rewardImageBase64) {
    const rewardImgSize = 140;
    // Align image slightly above the current Y, centered in its space on the right
    const imgY = currentY - 140 > 0 ? currentY - 160 : currentY - 80;
    const actualImgY = Math.max(imgY, currentY - (quest.rewards.length * 100)); // Ensure it's not going up too far
    svgContent += `<image x="${CARD_WIDTH - PADDING_X - rewardImgSize}" y="${actualImgY}" width="${rewardImgSize}" height="${rewardImgSize}" preserveAspectRatio="xMidYMid meet" href="data:${rewardImageContentType};base64,${rewardImageBase64}" />\n`;
  }
  
  currentY += 10;
  
  // Separator
  svgContent += `<line x1="${PADDING_X}" y1="${currentY}" x2="${CARD_WIDTH - PADDING_X}" y2="${currentY}" stroke="#e0e0e0" stroke-width="2" />\n`;
  currentY += 40;

  // 6. Quest ID (Footer)
  svgContent += `<text x="${PADDING_X}" y="${currentY}" font-family="Arial, sans-serif" font-size="14" fill="#888">Quest ID: ${quest.questId}</text>\n`;
  currentY += 40;

  const CARD_HEIGHT = currentY;

  // Wrap in SVG
  const svg = `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="heroClip">
          <rect x="${PADDING_X}" y="0" width="${heroWidth}" height="1000" rx="12" />
        </clipPath>
      </defs>
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="16" fill="#ffffff" stroke="#e0e0e0" stroke-width="2" />
      ${svgContent}
    </svg>
  `;

  // Convert SVG to PNG buffer
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return {
    buffer,
    filename: `quest-${quest.questId}.png`,
    mimeType: 'image/png'
  };
};
