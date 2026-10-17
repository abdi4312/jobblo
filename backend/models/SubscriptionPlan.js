const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['business', 'private'], required: true },
    entitlements: {
      freeContact: { type: Number, required: true, min: 0 },
      radius: { type: Number, required: true, min: 0 },
      numberOfCustomers: { type: Number, default: 1, min: 0 },
      maxJobsValue: { type: Number, min: 0 },
      perContactPrice: { type: Number, default: 0, min: 0 },
      ContactUnlock: { type: Number, default: 0, min: 0 },
      maxContact: { type: Number, default: 0, min: 0 },
      visibilityLevel: { type: Number, default: 0, min: 0 },
      locationPrecision: {
        type: String,
        enum: ['exact', 'approximate'],
        default: 'approximate',
      },
      hasBadge: { type: Boolean, default: false },
      hasAnalytics: { type: Boolean, default: false },
    },
    featuresText: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    stripeProductId: String,
    stripeProductIdTest: String,
    stripePriceId: String,
    stripePriceIdTest: String,
  },
  { timestamps: true, collection: 'subscriptionplans' }
);

planSchema.index({ type: 1, isActive: 1 });
planSchema.index({ name: 1, type: 1 });

module.exports = mongoose.model('SubscriptionPlan', planSchema);
