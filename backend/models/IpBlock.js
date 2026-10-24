const mongoose = require('mongoose');

/**
 * An IP (or small CIDR range) refused by services/monitoring/ipBlocks.js.
 * Expired blocks are removed by the TTL index; the audit log keeps the history.
 */
const ipBlockSchema = new mongoose.Schema(
  {
    target: { type: String, required: true, unique: true }, // "203.0.113.7" or "203.0.113.0/24"
    reason: { type: String, required: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null }, // null = until removed
  },
  { timestamps: true }
);

ipBlockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IpBlock', ipBlockSchema);
