const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    errorCode: { type: String, required: true, index: true },
    severity: { type: String, enum: ['info', 'warning', 'error', 'critical'], default: 'error', index: true },
    message: { type: String, default: '' },
    technicalMessage: { type: String, default: null },
    stack: { type: String, default: null },
    source: { type: String, default: null },
    controller: { type: String, default: null },
    service: { type: String, default: null },
    httpMethod: { type: String, default: null },
    route: { type: String, default: null, index: true },
    statusCode: { type: Number, default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    requestId: { type: String, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    environment: { type: String, default: process.env.NODE_ENV || 'development' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, default: null },
  },
  { timestamps: true }
);

errorLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
