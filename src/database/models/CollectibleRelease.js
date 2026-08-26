import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  skuId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: Number, required: true },
  asset: { type: String },
  resolvedAssetUrl: { type: String },
  regularPrice: { type: Number },
  nitroPrice: { type: Number },
  orbPrice: { type: Number },
  shopUrl: { type: String, required: true }
}, { _id: false });

const collectibleReleaseSchema = new mongoose.Schema({
  categorySkuId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  bannerUrl: { type: String },
  items: [itemSchema],
  itemsHash: { type: String, required: true },
  messageIds: { type: [String], default: [] },
  chunkCount: { type: Number, default: 0 },
  channelId: { type: String },
  status: { type: String, enum: ['baseline', 'pending', 'publishing', 'published', 'failed'], default: 'pending' }
}, {
  timestamps: true
});

export const CollectibleRelease = mongoose.model('CollectibleRelease', collectibleReleaseSchema);
