const mongoose = require('mongoose');

const jobRequestSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    message: {
      type: String,
    },
    favorite: {
      type: Boolean,
      default: false,
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/**
 * One OPEN application per applicant per job.
 *
 * The controller's duplicate guard is a findOne followed by a create, so two
 * concurrent POSTs both passed it and both created an application — and both
 * incremented monthlyContactUsage, spending the user's quota twice for one job.
 *
 * Partial, so re-applying after a decline or a withdrawal still works: only rows
 * still in `pending` participate in the constraint. That is the behaviour the
 * applications UI already assumes.
 *
 * Run scripts/dedupe-payment-records.js before this index builds on an existing
 * database — a duplicate pending pair would otherwise fail the build, and Mongoose
 * fails index builds soft, so the app would keep serving with no index at all.
 */
jobRequestSchema.index(
  { serviceId: 1, customerId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// The applicants list and "my applications" both filter on these.
jobRequestSchema.index({ serviceId: 1, status: 1 });
jobRequestSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('JobRequest', jobRequestSchema);
