const MAX_QUEST_DURATION_DAYS = Number(process.env.MAX_QUEST_DURATION_DAYS || 365);

export const validateQuestDuration = (startAt, endAt) => {
  if (!startAt) return { valid: false, reason: 'missing_startAt' };
  if (!endAt) return { valid: false, reason: 'missing_endAt' };

  const s = new Date(startAt);
  const e = new Date(endAt);

  if (isNaN(s.getTime())) return { valid: false, reason: 'invalid_startAt_date' };
  if (isNaN(e.getTime())) return { valid: false, reason: 'invalid_endAt_date' };
  
  if (e <= s) return { valid: false, reason: 'endAt_before_startAt' };

  const durationMs = e.getTime() - s.getTime();
  const durationDays = durationMs / (1000 * 60 * 60 * 24);

  if (durationDays > MAX_QUEST_DURATION_DAYS) {
    return { valid: false, reason: 'duration_exceeds_limit', durationDays };
  }

  return { valid: true, durationMs, durationDays };
};

export const parseQuest = (rawQuest, regionMap = new Map()) => {
  const { id, config } = rawQuest;

  const c = config || {};
  const msg = c.messages || {};
  const app = c.application || {};
  const assets = c.assets || {};
  const rewardsConfig = c.rewards_config || {};

  // ── TASKS ──
  // Prefer task_config_v2 (newer format), fallback to task_config (legacy)
  const tasks = [];
  let joinOperator = 'or'; // default

  const v2 = c.task_config_v2;
  const v1 = c.task_config;

  if (v2 && v2.tasks && Object.keys(v2.tasks).length > 0) {
    joinOperator = v2.join_operator || 'or';
    for (const [taskKey, taskData] of Object.entries(v2.tasks)) {
      const task = {
        id: taskKey,
        type: taskData.type || taskKey,
        target: taskData.target ?? null,
        applications: taskData.applications || [],
      };

      // Extract platform from task type
      if (taskKey.includes('DESKTOP')) task.platform = 'desktop';
      else if (taskKey.includes('MOBILE')) task.platform = 'mobile';
      else if (taskKey.includes('XBOX')) task.platform = 'xbox';
      else if (taskKey.includes('PLAYSTATION')) task.platform = 'playstation';
      else if (taskKey.includes('SWITCH')) task.platform = 'switch';

      // Attach video title if available
      if (taskData.messages?.video_title) {
        task.videoTitle = taskData.messages.video_title;
      }

      tasks.push(task);
    }
  } else if (v1 && v1.tasks && Object.keys(v1.tasks).length > 0) {
    joinOperator = v1.join_operator || 'or';
    for (const [taskKey, taskData] of Object.entries(v1.tasks)) {
      tasks.push({
        id: taskKey,
        type: taskData.event_name || taskKey,
        target: taskData.target ?? null,
        applications: [],
      });
    }
  }

  // ── REWARDS ──
  const rewards = [];
  if (Array.isArray(rewardsConfig.rewards)) {
    for (const r of rewardsConfig.rewards) {
      // Determine if asset is actually usable
      let asset = null;
      if (r.asset && typeof r.asset === 'string' && r.asset !== 'undefined' && r.asset !== 'reward.png') {
        asset = r.asset;
      }

      // Detect Orb rewards: type 4 with "Orbs" in name, or type 5
      const name = r.messages?.name ?? null;
      const isOrb = r.type === 5 || (name && name.toLowerCase().includes('orb'));

      // Extract numeric orb amount from name like "200 Orbs" or "700 Orbs"
      let orbAmount = null;
      if (isOrb && name) {
        const match = name.match(/(\d+)/);
        if (match) orbAmount = parseInt(match[1], 10);
      }

      // Map reward type
      let rewardTypeName = 'Unknown';
      if (r.type === 1) rewardTypeName = 'In-Game Item';
      else if (r.type === 2) rewardTypeName = 'Avatar Decoration';
      else if (r.type === 3) rewardTypeName = 'Avatar Decoration';
      else if (r.type === 4) rewardTypeName = isOrb ? 'Virtual Currency' : 'Profile Item';
      else if (r.type === 5) rewardTypeName = 'Virtual Currency';
      else if (r.type != null) rewardTypeName = `Type ${r.type}`;

      rewards.push({
        type: r.type ?? null,
        typeName: rewardTypeName,
        skuId: r.sku_id ?? null,
        name,
        asset,
        isOrb,
        orbAmount,
        redemptionLink: r.redemption_link ?? null
      });
    }
  }

  // ── REGIONS ──
  const regionRecord = regionMap.get(id);
  const regions = {
    isGlobal: regionRecord ? regionRecord.is_global : null,
    include: regionRecord?.regions?.include ?? [],
    exclude: regionRecord?.regions?.exclude ?? []
  };

  // ── PLATFORMS ──
  // Map numeric platform IDs to names
  const platformMap = { 0: 'Cross Platform', 1: 'Xbox', 2: 'PlayStation', 3: 'Switch', 4: 'PC' };
  const platformIds = rewardsConfig.platforms ?? [];
  let platforms = platformIds.map(p => platformMap[p] || `Platform ${p}`);
  // If only "Cross Platform" or empty, simplify
  if (platforms.length === 0 || (platforms.includes('Cross Platform') && platforms.length >= 4)) {
    platforms = ['Cross Platform'];
  }

  const title = msg.quest_name ?? null;
  const publisher = msg.game_publisher ?? null;

  let classification = 'production';
  let classificationReason = null;

  const now = new Date();
  const startsAt = c.starts_at ? new Date(c.starts_at) : null;
  const expiresAt = c.expires_at ? new Date(c.expires_at) : null;

  const durationValidation = validateQuestDuration(c.starts_at, c.expires_at);

  if (!durationValidation.valid) {
    classification = 'ignored';
    classificationReason = durationValidation.reason;
  } else if (expiresAt <= now) {
    classification = 'ignored';
    classificationReason = 'expired';
  } else if (startsAt > now) {
    classification = 'ignored';
    classificationReason = 'upcoming';
  } else if (title && title.includes('[TEST]')) {
    classification = 'test';
    classificationReason = 'title_contains_test';
  } else if (publisher === 'PLACEHOLDER') {
    classification = 'placeholder';
    classificationReason = 'placeholder_publisher';
  }

  return {
    questId: id,
    configId: c.id ?? null,
    
    title,
    gameTitle: msg.game_title ?? null,
    application: {
      id: app.id ?? null,
      name: app.name ?? null,
      link: app.link ?? null
    },
    
    publisher,
    classification,
    classificationReason,
    features: c.features ?? [],
    platforms,
    joinOperator,
    
    timing: {
      startsAt: c.starts_at ?? null,
      expiresAt: c.expires_at ?? null
    },
    
    assets: {
      hero: assets.hero ?? null,
      gameTile: assets.game_tile ?? null,
      logotype: assets.logotype ?? null
    },
    
    tasks,
    rewards,
    regions,
    
    rawSource: {
      source: "discordquest",
      endpoint: "/api/quests"
    }
  };
};

import crypto from 'crypto';

export const createQuestHash = (quest) => {
  // Deterministic stringify
  const stringifyDeterministic = (obj) => {
    if (obj === null || obj === undefined) return 'null';
    if (Array.isArray(obj)) {
      return '[' + obj.map(stringifyDeterministic).join(',') + ']';
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj).sort();
      return '{' + keys.map(k => `"${k}":${stringifyDeterministic(obj[k])}`).join(',') + '}';
    }
    return JSON.stringify(obj);
  };

  const hashData = {
    questId: quest.questId,
    title: quest.title,
    gameTitle: quest.gameTitle,
    application: quest.application,
    publisher: quest.publisher,
    classification: quest.classification,
    features: [...quest.features].sort(),
    platforms: [...quest.platforms].sort(),
    joinOperator: quest.joinOperator,
    timing: quest.timing,
    assets: quest.assets,
    // Sort tasks and rewards for array order independence
    tasks: [...quest.tasks].sort((a, b) => a.id.localeCompare(b.id)),
    rewards: [...quest.rewards].sort((a, b) => (a.skuId || '').localeCompare(b.skuId || '')),
    regions: {
      isGlobal: quest.regions.isGlobal,
      include: [...quest.regions.include].sort(),
      exclude: [...quest.regions.exclude].sort()
    }
  };

  return crypto.createHash('sha256').update(stringifyDeterministic(hashData)).digest('hex');
};
