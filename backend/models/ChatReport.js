const mongoose = require('mongoose');

const VALID_REPORT_TYPES = [
  'harassment', 'abusive_language', 'threats', 'spam', 'scam_or_fraud',
  'payment_issue', 'safepay_issue', 'work_not_completed', 'poor_quality',
  'different_from_agreement', 'inappropriate_content', 'fake_profile',
  'identity_issue', 'suspicious_link', 'privacy_violation',
  'off_platform_payment_request', 'other',
];

const VALID_STATUSES = [
  'open', 'under_review', 'waiting_for_reporter', 'waiting_for_reported_user',
  'action_required', 'resolved', 'dismissed', 'closed',
];

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const evidenceSchema = new mongoose.Schema(
  { fileUrl: String, fileType: String, description: String, uploadedAt: { type: Date, default: Date.now } },
  { _id: true }
);

const officialMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, maxlength: 2000 },
    attachments: [String],
  },
  { timestamps: true, _id: true }
);

const internalNoteSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 2000 },
  },
  { timestamps: true, _id: true }
);

const timelineSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, _id: true }
);

const chatReportSchema = new mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
    safePayOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute', default: null },

    // When scope = 'message', the subdocument _id as a string
    messageId: { type: String, default: null },
    scope: { type: String, enum: ['chat', 'message'], required: true },

    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    reportType: { type: String, required: true, enum: VALID_REPORT_TYPES, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },

    evidence: [evidenceSchema],

    status: { type: String, enum: VALID_STATUSES, default: 'open', index: true },
    priority: { type: String, enum: VALID_PRIORITIES, default: 'medium' },

    assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    internalNotes: [internalNoteSchema],
    officialMessages: [officialMessageSchema],
    timeline: [timelineSchema],

    resolution: {
      outcome: { type: String },
      reason: { type: String, maxlength: 1000 },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      resolvedAt: { type: Date },
    },
  },
  { timestamps: true }
);

chatReportSchema.index({ status: 1, createdAt: -1 });
chatReportSchema.index({ reportType: 1, status: 1 });
chatReportSchema.index({ assignedAdminId: 1, status: 1 });
// For duplicate prevention: one report per user per chat within a window
chatReportSchema.index({ chatId: 1, reportedBy: 1, reportType: 1 });

chatReportSchema.statics.VALID_REPORT_TYPES = VALID_REPORT_TYPES;
chatReportSchema.statics.VALID_STATUSES = VALID_STATUSES;
chatReportSchema.statics.VALID_PRIORITIES = VALID_PRIORITIES;

module.exports = mongoose.model('ChatReport', chatReportSchema);
