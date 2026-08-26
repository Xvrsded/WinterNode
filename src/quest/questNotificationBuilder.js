import { ContainerBuilder, SectionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { DISCORD_CONFIG } from '../config/discord.js';
import { resolveQuestHero, resolveRewardAsset } from './questAssetResolver.js';
import { logger } from '../utils/logger.js';

const truncateText = (text, maxLength = 2000) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

const formatDateRange = (startsAt, expiresAt) => {
  try {
    const fmt = (iso) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yy = d.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    };
    const s = fmt(startsAt);
    const e = fmt(expiresAt);
    if (s && e) return `${s} - ${e}`;
    if (s) return s;
    if (e) return `Until ${e}`;
    return null;
  } catch {
    return null;
  }
};

const formatTaskType = (taskType) => {
  if (!taskType) return 'Unknown task';
  
  const typeMap = {
    'PLAY_ON_DESKTOP': 'Play on desktop',
    'PLAY_ON_XBOX': 'Play on Xbox',
    'PLAY_ON_PLAYSTATION': 'Play on PlayStation',
    'PLAY_ON_SWITCH': 'Play on Switch',
    'PLAY_ON_MOBILE': 'Play on mobile',
    'PLAY_ACTIVITY': 'Play Activity',
    'STREAM_ON_DESKTOP': 'Stream on desktop',
    'WATCH_VIDEO': 'Watch the video',
    'WATCH_VIDEO_ON_MOBILE': 'Watch the video on mobile',
    'ACHIEVEMENT_IN_ACTIVITY': 'Complete achievement in Activity',
  };
  
  if (typeMap[taskType]) return typeMap[taskType];
  
  // Fallback: convert SNAKE_CASE to Title Case
  return taskType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const formatSeconds = (seconds) => {
  if (!seconds || isNaN(seconds)) return `${seconds}`;
  const num = Number(seconds);
  if (num >= 60) {
    const mins = Math.floor(num / 60);
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  return `${num} second${num !== 1 ? 's' : ''}`;
};

export const buildQuestNotification = async (quest) => {
  if (!quest) {
    throw new Error('Quest object is required to build notification');
  }

  const container = new ContainerBuilder().setAccentColor(0x5865F2);

  // ── 1. TITLE ──
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## New Quest - ${quest.title || 'Unknown Quest'}`)
  );

  // ── 2. HERO IMAGE ──
  let heroUrl = null;
  const heroResult = await resolveQuestHero(quest.assets?.hero);
  if (heroResult.valid) {
    heroUrl = heroResult.url;
  } else {
    const gameTileResult = await resolveQuestHero(quest.assets?.gameTile);
    if (gameTileResult.valid) {
      heroUrl = gameTileResult.url;
    }
  }

  if (!heroUrl) {
    throw new Error('Quest missing valid hero asset (Required)');
  }

  const gallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(heroUrl)
  );
  container.addMediaGalleryComponents(gallery);
  logger.info(`[QUEST] Hero asset resolved for ${quest.questId}`);

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // ── 3. QUEST INFO ──
  let infoLines = ['**Quest Info**', ''];

  const duration = formatDateRange(quest.timing?.startsAt, quest.timing?.expiresAt);
  if (duration) infoLines.push(`**Duration:** ${duration}`);

  if (quest.platforms && quest.platforms.length > 0) {
    infoLines.push(`**Redeemable Platforms:** ${quest.platforms.join(', ')}`);
  }

  if (quest.gameTitle) infoLines.push(`**Game:** ${quest.gameTitle}`);

  if (quest.application?.name && quest.application.name !== 'PLACEHOLDER') {
    let appStr = `**Application:** ${quest.application.name}`;
    if (quest.application.id) appStr += ` (${quest.application.id})`;
    infoLines.push(appStr);
  }

  if (quest.publisher) infoLines.push(`**Publisher:** ${quest.publisher}`);

  if (quest.features && quest.features.length > 0) {
    infoLines.push(`**Features:** ${quest.features.join(', ')}`);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(truncateText(infoLines.join('\n')))
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // ── 4. TASKS ──
  const joinOp = quest.joinOperator || 'or';
  const joinText = joinOp === 'and' 
    ? 'User must complete all of the following tasks:' 
    : 'User must complete any of the following tasks:';
  
  let taskLines = ['**Tasks**', '', joinText, ''];

  if (quest.tasks && quest.tasks.length > 0) {
    for (let i = 0; i < quest.tasks.length && i < 10; i++) {
      const task = quest.tasks[i];
      let line = `• ${formatTaskType(task.type)}`;
      if (task.target) {
        line += ` (${formatSeconds(task.target)})`;
      }
      taskLines.push(line);
    }
    if (quest.tasks.length > 10) {
      taskLines.push(`• ... and ${quest.tasks.length - 10} more tasks`);
    }
  } else {
    taskLines = ['**Tasks**', '', 'No tasks specified'];
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(truncateText(taskLines.join('\n')))
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // ── 5. REWARDS ──
  let rewardLines = ['**Rewards** 💎', ''];
  let firstValidRewardImage = null;

  if (quest.rewards && quest.rewards.length > 0) {
    // Resolve reward image — only for assets that are actual image paths
    for (const reward of quest.rewards) {
      if (reward.asset && !firstValidRewardImage) {
        // Skip .mp4 assets — Discord thumbnails only support images
        if (reward.asset.toLowerCase().endsWith('.mp4')) {
          logger.info(`[QUEST] Skipping .mp4 reward asset: ${reward.asset}`);
          continue;
        }
        try {
          const resolved = await resolveRewardAsset(reward.asset);
          if (resolved) {
            firstValidRewardImage = resolved;
            logger.info(`[QUEST] Reward asset resolved: ${resolved}`);
          }
        } catch (err) {
          logger.warn(`[QUEST] Failed to resolve reward asset: ${err.message}`);
        }
      }
    }

    for (const reward of quest.rewards) {
      // Use typeName from parser (already handles Orb detection)
      rewardLines.push(`**Reward Type:** ${reward.typeName || 'Unknown'}`);
      if (reward.skuId) rewardLines.push(`**SKU ID:** ${reward.skuId}`);
      if (reward.name) rewardLines.push(`**Name:** ${reward.name}`);
      if (reward.isOrb && reward.orbAmount) {
        rewardLines.push(`**Orbs Amount:** ${reward.orbAmount}`);
      }
    }
  } else {
    rewardLines.push('No rewards specified');
  }

  if (firstValidRewardImage) {
    const section = new SectionBuilder();
    section.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(truncateText(rewardLines.join('\n')))
    );
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(firstValidRewardImage)
    );
    container.addSectionComponents(section);
  } else {
    // No reward image — plain text display
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(truncateText(rewardLines.join('\n')))
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // ── 6. QUEST ID ──
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`Quest ID: \`${quest.questId || 'N/A'}\``)
  );

  // ── 7. DONATION BUTTONS ──
  const buttonsRow = new ActionRowBuilder();
  buttonsRow.addComponents(
    new ButtonBuilder()
      .setLabel('💖 Donate')
      .setURL('https://sociabuzz.com/winterid')
      .setStyle(ButtonStyle.Link),
    new ButtonBuilder()
      .setLabel('🔗 Discord ID')
      .setURL('https://discord.com/quests')
      .setStyle(ButtonStyle.Link)
  );
  container.addActionRowComponents(buttonsRow);

  // ── PAYLOAD ──
  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2]
  };
};
