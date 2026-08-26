import crypto from 'node:crypto';

export const createQuestContentHash = (quest) => {
  const hashObject = {
    questId: quest.questId,
    configId: quest.configId,
    title: quest.title,
    gameTitle: quest.gameTitle,
    application: quest.application,
    publisher: quest.publisher,
    timing: quest.timing,
    assets: quest.assets,
    tasks: quest.tasks,
    rewards: quest.rewards,
    regions: quest.regions
  };

  const stableStringify = (obj) => {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      return `[${obj.map(item => stableStringify(item)).join(',')}]`;
    }
    const sortedKeys = Object.keys(obj).sort();
    return `{${sortedKeys.map(k => `"${k}":${stableStringify(obj[k])}`).join(',')}}`;
  };

  const serialized = stableStringify(hashObject);
  return crypto.createHash('sha256').update(serialized).digest('hex');
};
