const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    amount: { type: Number, required: true },
    usageLimit: { type: Number, default: 0 }, // 0 means unlimited
    targetPlanType: {
      type: String,
      enum: ['all', 'private', 'business'],
      default: 'all',
    },
    active: { type: Boolean, default: true },
    activeDate: { type: Date, default: Date.now },
    expiresDate: { type: Date, required: true },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
