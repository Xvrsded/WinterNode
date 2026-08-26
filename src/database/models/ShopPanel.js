import mongoose from 'mongoose';

const shopPanelSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  type: { type: String, required: true, default: 'winter_store' },
  hash: { type: String, required: true }
}, { timestamps: true });

export const ShopPanel = mongoose.model('ShopPanel', shopPanelSchema);
