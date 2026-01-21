const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    price: { type: Number, required: true, min: 0 },

    type: {
      type: String,
      enum: ["business", "private"],
      required: true,
    },

    // 🔑 LOGIC (middleware uses this)
    entitlements: {
      freeContact: { type: Number, required: true },
      radius: { type: Number, required: true },
      numberOfCustomers: { type: Number, default: 1 },
      maxJobsValue: { type: Number },
      perContactPrice: { type: Number, default: 0 },
      ContactUnlock: { type: Number, default: 0 },
      maxContact: { type: Number, default: 0 },
    },

    // 🖼️ UI ONLY
    featuresText: {
      type: [String],
      default: [],
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SubscriptionPlan", planSchema);
