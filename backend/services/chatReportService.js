/**
 * Chat Report Service
 * Shared logic for status transitions, timeline building, and dispute creation from reports.
 */

'use strict';

/**
 * Valid status transitions for ChatReport lifecycle.
 * Key = current status → Value = allowed next statuses.
 */
const STATUS_TRANSITIONS = {
  open: ['under_review', 'dismissed', 'closed'],
  under_review: [
    'waiting_for_reporter',
    'waiting_for_reported_user',
    'action_required',
    'resolved',
    'dismissed',
    'closed',
  ],
  waiting_for_reporter: ['under_review', 'action_required', 'resolved', 'dismissed', 'closed'],
  waiting_for_reported_user: ['under_review', 'action_required', 'resolved', 'dismissed', 'closed'],
  action_required: ['under_review', 'resolved', 'dismissed', 'closed'],
  resolved: ['closed', 'under_review'],
  dismissed: ['closed', 'under_review'],
  closed: [],
};

/**
 * Validate a status transition for a ChatReport.
 * Throws a descriptive Error if the transition is not permitted.
 *
 * @param {string} currentStatus
 * @param {string} newStatus
 */
const validateStatusTransition = (currentStatus, newStatus) => {
  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed) throw new Error(`Ukjent gjeldende status: ${currentStatus}`);
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Ugyldig statusovergang: ${currentStatus} → ${newStatus}. Tillatte: ${allowed.join(', ') || 'ingen'}.`
    );
  }
};

/**
 * Build a timeline entry object compatible with the ChatReport.timeline array.
 *
 * @param {string} action
 * @param {object} actorId - Mongoose ObjectId or null
 * @param {string} description
 * @param {object} metadata
 * @returns {object}
 */
const buildReportTimeline = (action, actorId, description = '', metadata = {}) => ({
  action,
  actorId: actorId || null,
  description: String(description).substring(0, 500),
  metadata,
  createdAt: new Date(),
});

/**
 * Map a ChatReport reportType to the closest Dispute reasonCategory.
 * @param {string} reportType
 * @returns {string}
 */
const mapReportTypeToDisputeCategory = (reportType) => {
  const map = {
    harassment: 'other',
    abusive_language: 'other',
    threats: 'other',
    spam: 'other',
    scam_or_fraud: 'fraud_or_scam',
    payment_issue: 'payment_issue',
    safepay_issue: 'payment_issue',
    work_not_completed: 'work_not_completed',
    poor_quality: 'poor_quality',
    different_from_agreement: 'different_from_agreement',
    inappropriate_content: 'other',
    fake_profile: 'fraud_or_scam',
    identity_issue: 'fraud_or_scam',
    suspicious_link: 'other',
    privacy_violation: 'other',
    off_platform_payment_request: 'unauthorized_payment',
    other: 'other',
  };
  return map[reportType] ?? 'other';
};

/**
 * Create a Dispute linked to a ChatReport, inside a MongoDB session.
 * Call this inside session.withTransaction() — caller manages the session lifecycle.
 *
 * @param {object} report  - ChatReport mongoose document (not lean)
 * @param {object} session - Active mongoose.ClientSession
 * @param {object} adminId - ObjectId of the acting admin
 * @returns {object} The newly created (or existing active) Dispute document
 */
const createDisputeFromReport = async (report, session, adminId) => {
  const Dispute = require('../models/Dispute');
  const Order = require('../models/Order');

  if (!report.orderId) {
    throw new Error('Rapporten har ingen tilknyttet ordre. Tvist kan ikke opprettes automatisk.');
  }

  const order = await Order.findById(report.orderId).session(session).lean();
  if (!order) throw new Error('Ordre ikke funnet for denne rapporten.');

  // Prevent duplicate active disputes
  const existing = await Dispute.findOne({
    orderId: report.orderId,
    status: {
      $in: ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'],
    },
  })
    .session(session)
    .lean();

  if (existing) return existing;

  const [dispute] = await Dispute.create(
    [
      {
        orderId: report.orderId,
        chatId: report.chatId,
        serviceId: report.serviceId,
        openedBy: report.reportedBy,
        openedAgainst: report.reportedUser,
        openedByRole: 'customer',
        reasonCategory: mapReportTypeToDisputeCategory(report.reportType),
        title: String(report.title).substring(0, 200),
        description: String(report.description).substring(0, 2000),
        status: 'open',
        priority: report.priority === 'urgent' ? 'critical' : (report.priority ?? 'medium'),
        assignedAdminId: adminId || null,
        payoutFrozen: true,
        timeline: [
          {
            action: 'dispute_opened_from_chat_report',
            actorId: adminId,
            note: `Tvist åpnet av admin fra chatrapport ${report._id}`,
          },
        ],
      },
    ],
    { session }
  );

  return dispute;
};

module.exports = {
  validateStatusTransition,
  buildReportTimeline,
  createDisputeFromReport,
  mapReportTypeToDisputeCategory,
  STATUS_TRANSITIONS,
};
