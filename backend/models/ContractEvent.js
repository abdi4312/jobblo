const mongoose = require('mongoose');

/** A response-contract change on an endpoint (breaking or additive). Kept 180 days. */
const contractEventSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    method: { type: String, required: true },
    route: { type: String, required: true },
    status: { type: String, required: true },
    kind: { type: String, enum: ['removed', 'type_changed', 'added'], required: true },
    breaking: { type: Boolean, required: true },
    path: { type: String, required: true },
    detail: { type: String, default: null },
    version: { type: String, default: null },
    commit: { type: String, default: null },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acknowledgedAt: { type: Date, default: null },
    note: { type: String, default: null, maxlength: 300 },
  },
  { versionKey: false }
);

contractEventSchema.index({ at: -1 });
contractEventSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('ContractEvent', contractEventSchema);
