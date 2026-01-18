const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    plan: {
      type: String,
      enum: ["free", "Start", "Pro", "Premium", "Fleksibel", "Job Plus"],
      required: true,
    },
    planType: {
      type: String,
      enum: ["business", "private"],
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    renewalDate: { type: Date },
    autoRenew: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "cancelled", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
