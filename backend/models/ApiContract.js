const mongoose = require('mongoose');

/**
 * Observed response contract of one endpoint + status class: every distinct response
 * shape ("variant") seen, with how often. Field NAMES and TYPES only — never values.
 * Written by services/monitoring/contracts.js.
 */
const variantSchema = new mongoose.Schema(
  {
    sig: { type: String, required: true },
    count: { type: Number, default: 0 },
    firstSeen: Date,
    lastSeen: Date,
    version: String,
    commit: String,
    fields: { type: [[String]], default: [] }, // [path, type]
  },
  { _id: false }
);

const apiContractSchema = new mongoose.Schema(
  {
    method: { type: String, required: true },
    route: { type: String, required: true },
    status: { type: String, required: true }, // 2xx | 4xx
    samples: { type: Number, default: 0 },
    firstSeen: Date,
    lastSeen: Date,
    variants: { type: [variantSchema], default: [] },
  },
  { versionKey: false }
);

apiContractSchema.index({ method: 1, route: 1, status: 1 }, { unique: true });

module.exports = mongoose.model('ApiContract', apiContractSchema);
