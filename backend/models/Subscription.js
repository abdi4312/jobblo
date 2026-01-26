const mongoose = require("mongoose");

const planHistorySchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
    },
    plan: {
      type: String,
      enum: ["Free", "Start", "Pro", "Premium", "Fleksibel", "Job Plus", "Jobblo Pluss"],
      required: true,
    },
    planType: {
      type: String,
      enum: ["business", "private"],
      required: true,
    },
    startDate: Date,
    endDate: Date,
    stripeSubscriptionId: String,
    status: {
      type: String,
      enum: ["active", "cancelled", "expired"],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🔹 CURRENT PLAN
    currentPlan: {
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubscriptionPlan",
      },
      plan: {
        type: String,
        enum: ["Free", "Start", "Pro", "Premium", "Fleksibel", "Job Plus", "Jobblo Pluss"],
        required: true,
      },
      planType: {
        type: String,
        enum: ["business", "private"],
        required: true,
      },
      stripeSubscriptionId: String,
      startDate: Date,
      endDate: Date,
      renewalDate: Date,
      autoRenew: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "expired"],
        default: "active",
      },
    },

    // 🔹 PLAN HISTORY
    planHistory: [planHistorySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
