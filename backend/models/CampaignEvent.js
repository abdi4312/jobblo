const mongoose = require('mongoose');

const campaignEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    variant: { type: String, enum: ['A', 'B'], required: true },
    eventType: { type: String, enum: ['impression', 'click', 'close'], required: true },
    closeMethod: { type: String, enum: ['button', 'backdrop', 'escape'], default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

campaignEventSchema.index({ eventId: 1 }, { unique: true });
campaignEventSchema.index({ campaignId: 1, variant: 1, eventType: 1, createdAt: -1 });

module.exports = mongoose.model('CampaignEvent', campaignEventSchema);
