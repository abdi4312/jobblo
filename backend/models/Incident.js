const mongoose = require('mongoose');

/**
 * Operational incident. Opened automatically by services/monitoring/alerts.js
 * (deduplicated by `fingerprint` while unresolved) or manually by a developer.
 */
const incidentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    fingerprint: { type: String, default: null, index: true },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium', index: true },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open', index: true },
    source: { type: String, enum: ['alert', 'manual'], default: 'manual' },
    service: { type: String, default: null },
    detail: { type: String, default: null, maxlength: 1000 },
    startedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    occurrences: { type: Number, default: 1 },
    recoveredAt: { type: Date, default: null }, // alert condition cleared (awaiting human confirmation)
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNotes: { type: String, default: null, maxlength: 4000 },
    postmortem: { type: String, default: null, maxlength: 10000 },
    relatedErrorCodes: [{ type: String }],
    relatedOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    notifiedAt: { type: Date, default: null },
    timeline: [
      {
        _id: false,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        kind: { type: String, enum: ['opened', 'alert', 'status', 'note', 'assign', 'notify', 'recovered', 'escalate'] },
        text: { type: String, maxlength: 2000 },
      },
    ],
  },
  { timestamps: true }
);

incidentSchema.index({ status: 1, startedAt: -1 });

module.exports = mongoose.model('Incident', incidentSchema);
