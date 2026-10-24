const jobs = require('../scheduler/jobs');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const SafePayHistory = require('../../models/SafePayHistory');
const { DAY, HOUR, MINUTE, countBy, groupCount } = require('../../utils/devQuery');

/** Order health rules and the per-order bundle/timeline shared by the payments, SafePay, job, reconciliation and SafePay-machine pages. */

const byOrder = (rows) => Object.fromEntries(rows.map((r) => [String(r.orderId), r]));

// Never send these to the browser, whatever the caller asks for.
const USER_SAFE_FIELDS =
  'name lastName email role accountStatus isDeleted deletedAt deactivatedAt verified isTrusted planType subscription lastLogin createdAt updatedAt avatarUrl companyName oauthProviders.provider identityVerification.provider identityVerification.verifiedAt identityVerification.assuranceLevel payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted acceptedTerms termsVersion termsAcceptedAt';

// ── Shared: order health rules ──────────────────────────────────────────────
const ACTIVE_PAYOUT = ['released_internal', 'processing', 'transferred'];
const TIMEOUT_REVIEW = ['failed', 'reconciliation_required', 'manual_review'];
const OPEN_DISPUTE = ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'];

/**
 * Pure: every rule an order + its money documents can break. Mirrors the scheduler's
 * own definitions (reconcileMoneyState, autoReleaseStaleReviews, cleanupAbandonedOrders,
 * providerConnectTimeout) so the dashboard and the jobs agree on what "stuck" means.
 */
function orderIssues(order, { payment, payout, sph, dispute } = {}, now = Date.now(), cfg = jobs.config()) {
  const issues = [];
  const add = (code, severity, detail) => issues.push({ code, severity, detail });
  const paid = ['paid', 'partially_refunded'].includes(order.paymentStatus);
  const t = (d) => (d ? new Date(d).getTime() : null);

  if (paid && !payment) add('paid_without_payment', 'critical', 'Order is paid but has no Payment record');
  if (paid && !sph) add('missing_safepay_history', 'medium', 'Paid order has no SafePayHistory row');
  if (
    ['completed', 'cancelled'].includes(order.status) &&
    order.paymentStatus === 'paid' &&
    payment &&
    !['refunded', 'released'].includes(payment.status) &&
    !(payout && ACTIVE_PAYOUT.includes(payout.status))
  ) {
    add('unsettled_money', 'critical', `Order ${order.status} but money neither refunded nor paid out`);
  }
  if (order.status === 'ready_for_review' && t(order.readyForReviewAt) && t(order.readyForReviewAt) <= now - cfg.autoReleaseDays * DAY) {
    add('review_overdue', 'high', `In review longer than the ${cfg.autoReleaseDays}-day auto-release window`);
  }
  if (order.status === 'awaiting_payment' && order.paymentStatus !== 'paid' && t(order.createdAt) && t(order.createdAt) <= now - cfg.abandonedOrderHours * HOUR) {
    add('abandoned_checkout', 'low', `Awaiting payment for over ${cfg.abandonedOrderHours}h`);
  }
  if (
    order.status === 'paid' &&
    order.paymentStatus === 'paid' &&
    !order.startedAt &&
    t(order.providerConnectDeadlineAt) &&
    t(order.providerConnectDeadlineAt) <= now &&
    !order.providerConnectTimeout?.status
  ) {
    add('connect_deadline_passed', 'high', 'Provider connect deadline passed; timeout job has not picked it up');
  }
  if (TIMEOUT_REVIEW.includes(order.providerConnectTimeout?.status)) {
    add('timeout_needs_review', 'high', `Connect-timeout refund is ${order.providerConnectTimeout.status}`);
  }
  if (order.payoutLockId && t(order.payoutLockedAt) && t(order.payoutLockedAt) < now - 5 * MINUTE) {
    add('stale_payout_lock', 'medium', 'Payout lock held longer than its 5-minute lease');
  }
  if (payment && ['failed', 'reconciliation_required'].includes(payment.refundStatus)) {
    add('refund_needs_reconciliation', 'critical', `Refund is ${payment.refundStatus}`);
  }
  if (payout && ['failed', 'reconciliation_required'].includes(payout.status)) {
    add('payout_failed', 'high', `Payout is ${payout.status}${payout.failureCode ? ` (${payout.failureCode})` : ''}`);
  }
  if (order.status === 'disputed' && !(dispute && OPEN_DISPUTE.includes(dispute.status))) {
    add('dispute_state_mismatch', 'medium', 'Order is disputed but has no open dispute');
  }
  if (payment?.capturedAmountMinor && order.checkoutAmountMinor && payment.capturedAmountMinor !== order.checkoutAmountMinor) {
    add('amount_mismatch', 'high', `Captured ${payment.capturedAmountMinor} øre vs checkout ${order.checkoutAmountMinor} øre`);
  }
  if (payment?.status === 'refunded' && order.paymentStatus === 'paid') {
    add('refund_state_mismatch', 'high', 'Payment refunded but order still marked paid');
  }
  return issues;
}

/** Orders that can break a rule, with their money documents and computed issues. */
async function scanOrders(limit = 300) {
  const now = Date.now();
  const cfg = jobs.config();
  const candidates = await Order.find({
    $or: [
      { status: { $in: ['completed', 'cancelled'] }, paymentStatus: 'paid' },
      { status: 'ready_for_review', readyForReviewAt: { $lte: new Date(now - cfg.autoReleaseDays * DAY) } },
      { status: 'awaiting_payment', paymentStatus: { $ne: 'paid' }, createdAt: { $lte: new Date(now - cfg.abandonedOrderHours * HOUR) } },
      { status: 'paid', paymentStatus: 'paid', startedAt: null, providerConnectDeadlineAt: { $lte: new Date(now) } },
      { 'providerConnectTimeout.status': { $in: TIMEOUT_REVIEW } },
      { payoutLockId: { $ne: null }, payoutLockedAt: { $lt: new Date(now - 5 * MINUTE) } },
      { status: 'disputed' },
      { paymentStatus: { $in: ['paid', 'partially_refunded'] }, updatedAt: { $gte: new Date(now - 30 * DAY) } },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('status paymentStatus customerId providerId serviceId agreedPrice checkoutAmountMinor createdAt updatedAt readyForReviewAt startedAt providerConnectDeadlineAt providerConnectTimeout payoutLockId payoutLockedAt')
    .lean();
  const ids = candidates.map((o) => o._id);
  const [payments, payouts, sphs, disputes] = await Promise.all([
    Payment.find({ orderId: { $in: ids } }).lean(),
    Payout.find({ orderId: { $in: ids } }).lean(),
    SafePayHistory.find({ orderId: { $in: ids } }).sort({ createdAt: -1 }).lean(),
    Dispute.find({ orderId: { $in: ids } }).sort({ createdAt: -1 }).select('orderId status').lean(),
  ]);
  const P = byOrder(payments);
  const PO = byOrder(payouts);
  const S = byOrder([...sphs].reverse()); // newest wins
  const D = byOrder([...disputes].reverse());
  return candidates
    .map((o) => {
      const k = String(o._id);
      return { order: o, issues: orderIssues(o, { payment: P[k], payout: PO[k], sph: S[k], dispute: D[k] }, now, cfg) };
    })
    .filter((r) => r.issues.length);
}

module.exports = { countBy, groupCount, byOrder, USER_SAFE_FIELDS, ACTIVE_PAYOUT, TIMEOUT_REVIEW, OPEN_DISPUTE, orderIssues, scanOrders };
