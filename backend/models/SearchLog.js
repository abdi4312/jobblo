const mongoose = require('mongoose');

/** One job search (first page only) — for zero-result and latency monitoring. Anonymous; kept 30 days. */
const searchLogSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    kind: { type: String, enum: ['list', 'nearby'], required: true },
    text: { type: String, default: null }, // normalised search words, max 60 chars
    categories: { type: [String], default: undefined },
    regions: { type: Number, default: 0 }, // how many county/municipality/area codes were selected
    radiusKm: { type: Number, default: null },
    results: { type: Number, required: true },
    ms: { type: Number, required: true },
  },
  { versionKey: false }
);

searchLogSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('SearchLog', searchLogSchema);
