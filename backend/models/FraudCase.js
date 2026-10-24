const mongoose = require('mongoose');

/**
 * Review state for a user flagged by the fraud & abuse rules (services/monitoring/fraud.js).
 * The flags themselves are recomputed from live data; this only stores what a developer
 * decided, so a dismissed case stays quiet until new evidence raises the score.
 */
const fraudCaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: { type: String, enum: ['open', 'investigating', 'confirmed', 'dismissed'], default: 'open', index: true },
    note: { type: String, default: null, maxlength: 1000 },
    scoreAtReview: { type: Number, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    history: { type: [{ _id: false, at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: String, note: String, score: Number }], default: [] },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('FraudCase', fraudCaseSchema);
