const mongoose = require('mongoose');

const VALID_REPORT_TYPES = [
  'fake_job',
  'scam_or_fraud',
  'spam',
  'duplicate',
  'inappropriate_content',
  'wrong_category',
  'misleading_info',
  'expired_job',
  'payment_issue',
  'other',
];

const VALID_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'];

const jobReportSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportType: {
      type: String,
      required: true,
      enum: VALID_REPORT_TYPES,
      index: true,
    },
    description: { type: String, required: true, maxlength: 2000 },

    status: { type: String, enum: VALID_STATUSES, default: 'open', index: true },
    assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    resolutionNote: { type: String, maxlength: 1000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

jobReportSchema.index({ status: 1, createdAt: -1 });
jobReportSchema.index({ serviceId: 1, reportedBy: 1, status: 1 });

jobReportSchema.statics.VALID_REPORT_TYPES = VALID_REPORT_TYPES;
jobReportSchema.statics.VALID_STATUSES = VALID_STATUSES;

module.exports = mongoose.model('JobReport', jobReportSchema);
