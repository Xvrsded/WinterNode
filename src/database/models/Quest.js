import mongoose from 'mongoose';

const QuestSchema = new mongoose.Schema({
  questId: { type: String, required: true, unique: true },
  configId: { type: String },
  title: { type: String },
  gameTitle: { type: String },
  application: {
    id: { type: String },
    name: { type: String }
  },
  publisher: { type: String },
  platforms: [{ type: String }],
  joinOperator: { type: String },
  timing: {
    startsAt: { type: Date },
    expiresAt: { type: Date }
  },
  assets: {
    hero: { type: String },
    gameTile: { type: String },
    logotype: { type: String }
  },
  tasks: [{
    id: { type: String },
    type: { type: String },
    target: { type: Number },
    platform: { type: String },
    videoTitle: { type: String },
    applications: [{
      id: { type: String }
    }],
    metadata: { type: mongoose.Schema.Types.Mixed }
  }],
  rewards: [{
    type: { type: Number },
    typeName: { type: String },
    skuId: { type: String },
    name: { type: String },
    asset: { type: String },
    isOrb: { type: Boolean },
    orbAmount: { type: Number },
    redemptionLink: { type: String }
  }],
  regions: {
    isGlobal: { type: Boolean, default: null },
    include: [{ type: String }],
    exclude: [{ type: String }]
  },
  rawSource: {
    source: { type: String },
    endpoint: { type: String }
  },
  firstSeenAt: { type: Date },
  lastSeenAt: { type: Date },
  lastChangedAt: { type: Date },
  syncState: { type: String },
  contentHash: { type: String },
  
  messageId: { type: String },
  channelId: { type: String },
  hash: { type: String },
  classification: { type: String },
  classificationReason: { type: String },
  status: { type: String }
}, {
  timestamps: true,
  collection: 'quests'
});

QuestSchema.index({ 'timing.startsAt': 1 });
QuestSchema.index({ 'timing.expiresAt': 1 });
QuestSchema.index({ lastSeenAt: -1 });

export const Quest = mongoose.model('Quest', QuestSchema);
