const mongoose = require('mongoose');

/**
 * Configuration fingerprint — written on every boot that changes it, and when a developer
 * accepts the current configuration as the baseline. Values are NEVER stored: env vars and
 * GlobalConfig entries are kept as short SHA-256 fingerprints, only to tell "changed" apart
 * from "unchanged". Maps are [key, value] pairs (env keys and config keys may contain dots).
 */
const pairs = { type: [[String]], default: [] };
const configSnapshotSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    kind: { type: String, enum: ['boot', 'baseline'], required: true },
    host: { type: String, default: null },
    digest: { type: String, required: true },
    nodeVersion: { type: String, default: null },
    version: { type: String, default: null },
    commit: { type: String, default: null },
    env: pairs,
    packages: pairs,
    globalConfig: pairs,
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: null, maxlength: 300 },
  },
  { versionKey: false }
);

configSnapshotSchema.index({ kind: 1, at: -1 });

module.exports = mongoose.model('ConfigSnapshot', configSnapshotSchema);
