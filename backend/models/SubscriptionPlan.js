// models/SubscriptionPlan.js
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    freeViews: {
      type: Number,
      required: true,
      min: 0,
    },

    pricePerExtraView: {
      type: Number,
      required: true,
      min: 0,
    },

    features: {
      type: [String],
      default: [],
    },
    numberOfCustomers: {
      type: Number,
      default: 0,
    },

    type: {
      type: String,
      enum: ["business", "private"],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SubscriptionPlan", planSchema);
