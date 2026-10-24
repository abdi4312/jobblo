const mongoose = require('mongoose');

/**
 * A sensitive developer-dashboard action awaiting Super Admin approval (four-eyes).
 * The approver can never be the requester; approving executes the action.
 */
const changeRequestSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ['ip_block', 'ip_unblock', 'flag_set', 'thresholds_set', 'slo_targets_set', 'developer_access', 'rate_limit_reset'] },
    summary: { type: String, required: true, maxlength: 300 },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'executed', 'rejected', 'failed', 'expired', 'cancelled'], default: 'pending', index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: null, maxlength: 500 },
    reviewedAt: { type: Date, default: null },
    executedAt: { type: Date, default: null },
    error: { type: String, default: null },
    environment: { type: String, default: () => process.env.NODE_ENV || 'development' },
    // Change Risk Analyzer score at submission: { score, level, factors[], mitigations[] }.
    risk: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

changeRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
