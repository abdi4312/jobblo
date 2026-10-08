const crypto = require('crypto');
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    enabled: { type: Boolean, default: false, required: true },
    deletedAt: { type: Date, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    bannerText: { type: String, required: true, maxlength: 1000 },
    bannerCtaLabel: { type: String, required: true, maxlength: 80 },
    bannerCtaUrl: { type: String, required: true, maxlength: 300 },
    popupVersionA: { type: String, required: true, maxlength: 500 },
    popupVersionB: { type: String, required: true, maxlength: 500 },
    popupCtaLabel: { type: String, required: true, maxlength: 80 },
    popupCtaUrl: { type: String, required: true, maxlength: 300 },
    popupDelayMs: { type: Number, required: true, min: 0, max: 30000 },
    popupCooldownMs: { type: Number, required: true, min: 60000, max: 31536000000 },
    termsLabel: { type: String, required: true, maxlength: 80 },
    termsUrl: { type: String, required: true, maxlength: 300 },
    disclaimer: { type: String, required: true, maxlength: 10000 },
    assignmentSecret: {
      type: String,
      required: true,
      select: false,
      default: () => crypto.randomBytes(32).toString('hex'),
    },
  },
  { timestamps: true }
);

campaignSchema.index({ enabled: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
