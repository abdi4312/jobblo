const mongoose = require('mongoose');

/** Hourly resource reading for capacity forecasts — written by services/monitoring/capacity.js. */
const n = { type: Number, default: null };
const capacitySnapshotSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    host: { type: String, default: null },
    diskUsed: n,
    diskTotal: n,
    memUsed: n,
    memTotal: n,
    load1: n,
    cpus: n,
    mongoData: n,
    mongoStorage: n,
    mongoIndex: n,
    blobBytes: n,
  },
  { versionKey: false }
);

capacitySnapshotSchema.index({ at: -1 });
capacitySnapshotSchema.index({ at: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

module.exports = mongoose.model('CapacitySnapshot', capacitySnapshotSchema);
