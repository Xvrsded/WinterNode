import mongoose from 'mongoose';

const shopTicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true },
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  queueNumber: { type: Number, required: true },
  packageId: { type: String, required: true },
  packageName: { type: String, required: true },
  packagePrice: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  closedAt: { type: Date },
  closeReason: { type: String }
}, { timestamps: true });

export const ShopTicket = mongoose.model('ShopTicket', shopTicketSchema);
