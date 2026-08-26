import { Quest } from '../database/models/Quest.js';

export const questService = {
  findByQuestId: async (questId) => {
    return Quest.findOne({ questId });
  },
  
  createQuest: async (questData) => {
    return Quest.create(questData);
  },
  
  updateQuest: async (questId, updateData, options = {}) => {
    return Quest.findOneAndUpdate(
      { questId },
      updateData,
      { returnDocument: 'after', ...options }
    );
  },
  
  getQuestCount: async () => {
    return Quest.countDocuments();
  },
  
  getAllQuestIds: async () => {
    const quests = await Quest.find({}, { questId: 1 }).lean();
    return quests.map(q => q.questId);
  },
  
  getAllQuests: async () => {
    return Quest.find({}).lean();
  },
  
  bulkInsertQuests: async (questsData) => {
    if (questsData.length === 0) return [];
    return Quest.insertMany(questsData, { ordered: false });
  }
};
