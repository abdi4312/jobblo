const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { redactSensitive } = require('../../utils/sanitizer');
const { logActivity } = require('../../services/admin/activityService');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const ErrorLog = require('../../models/ErrorLog');
const Notification = require('../../models/Notification');
const AdminActivity = require('../../models/AdminActivity');
const SafePayHistory = require('../../models/SafePayHistory');
const StripeFinancialOperation = require('../../models/StripeFinancialOperation');
const StripePaymentIncident = require('../../models/StripePaymentIncident');
const StripeTransferRecord = require('../../models/StripeTransferRecord');
const { escapeRegex, isId } = require('../../utils/devQuery');
const { TIMEOUT_REVIEW, orderIssues, scanOrders } = require('../../services/monitoring/orderHealth');

/** Developer console — one job's full lifecycle, job search and its Stripe state. Read-only. */

// ── 16 / 11. Job (order) diagnostics: full lifecycle ────────────────────────
async function loadOrderBundle(orderId) {
  if (!isId(orderId)) return null;
  const order = await Order.findById(orderId)
    .populate('customerId providerId', 'name email phone avatarUrl role stripeConnectAccountId payoutEnabled')
    .populate('serviceId', 'title status')
    .select('-location -beforeImages -afterImages -attachments -checkoutSuccessUrl -checkoutCancelUrl')
    .lean();
  if (!order) return null;
  // Metadata may hold the id as a string or an ObjectId.
  const idForms = [String(orderId), new mongoose.Types.ObjectId(String(orderId))];
  const [payment, payout, sphs, disputes, operations, incidents, transfers, notifications, audit, errors] = await Promise.all([
    Payment.findOne({ orderId }).lean(),
    Payout.findOne({ orderId }).lean(),
    SafePayHistory.find({ orderId }).sort({ createdAt: 1 }).select('-ratings -reviewComment -paymentMethodLast4').lean(),
    Dispute.find({ orderId }).sort({ createdAt: -1 }).select('status priority reasonCategory title openedAt closedAt resolution timeline assignedAdminId payoutFrozen').lean(),
    StripeFinancialOperation.find({ orderId }).sort({ createdAt: 1 }).lean(),
    StripePaymentIncident.find({ orderId }).sort({ createdAt: 1 }).lean(),
    StripeTransferRecord.find({ orderId }).sort({ stripeCreatedAt: 1 }).select('-audit').lean(),
    Notification.find({ orderId }).sort({ createdAt: -1 }).limit(30).select('type content read createdAt userId').lean(),
    AdminActivity.find({ targetId: orderId }).sort({ createdAt: -1 }).limit(30).populate('adminId', 'name role').select('action description createdAt adminId').lean(),
    ErrorLog.find({ $or: [{ route: { $regex: escapeRegex(String(orderId)) } }, { 'metadata.orderId': { $in: idForms } }, { 'metadata.orders.orderId': { $in: idForms } }] })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('referenceId errorCode message route statusCode severity status createdAt')
      .lean(),
  ]);
  const sph = sphs[sphs.length - 1] || null;
  const dispute = disputes[0] || null;
  return { order, payment, payout, sphs, sph, disputes, dispute, operations, incidents, transfers, notifications, audit, errors };
}

/** Merge every dated thing that happened to an order into one ordered timeline. */
function buildTimeline(b) {
  const ev = [];
  const push = (at, source, title, detail, tone = 'neutral') => at && ev.push({ at: new Date(at), source, title, detail: detail || null, tone });
  const o = b.order;
  push(o.createdAt, 'order', 'Order created', `status ${o.status}`);
  for (const h of o.history || []) push(h.timestamp, 'order', h.action.replace(/_/g, ' '), h.data ? JSON.stringify(redactSensitive(h.data)).slice(0, 200) : null);
  push(o.checkoutSessionCreatedAt, 'stripe', 'Checkout session created', o.checkoutMode);
  push(o.paymentConfirmedAt, 'stripe', 'Payment confirmed', null, 'success');
  push(o.startedAt, 'order', 'Work started', null, 'info');
  push(o.readyForReviewAt, 'order', 'Ready for review', null, 'info');
  push(o.completedAt, 'order', 'Completed', null, 'success');
  const t = o.providerConnectTimeout;
  if (t?.status) push(t.lastAttemptAt || t.autoCancelledAt, 'safepay', `Connect timeout: ${t.status}`, t.lastErrorCode || t.manualReviewReason || null, TIMEOUT_REVIEW.includes(t.status) ? 'danger' : 'warning');
  if (b.payment) {
    push(b.payment.createdAt, 'payment', `Payment recorded (${b.payment.status})`, b.payment.stripePaymentIntentId);
    push(b.payment.refundStartedAt, 'payment', 'Refund started', null, 'warning');
    push(b.payment.refundCompletedAt, 'payment', 'Refund completed', b.payment.stripeRefundId, 'success');
    push(b.payment.refundFailedAt, 'payment', 'Refund failed', null, 'danger');
  }
  for (const s of b.sphs) push(s.updatedAt, 'safepay', `SafePay ${s.status}`, s.refundStatus !== 'none' ? `refund ${s.refundStatus}` : null);
  if (b.payout) {
    push(b.payout.createdAt, 'payout', `Payout created (${b.payout.releaseSource})`);
    push(b.payout.transferInitiatedAt, 'payout', 'Transfer initiated');
    push(b.payout.transferCompletedAt, 'payout', 'Transfer completed', b.payout.stripeTransferId, 'success');
    push(b.payout.transferFailedAt, 'payout', 'Transfer failed', b.payout.failureReason || b.payout.failureCode, 'danger');
  }
  for (const op of b.operations) push(op.attemptedAt || op.createdAt, 'stripe', `${op.type} ${op.status}`, `${op.amount} ${op.currency} øre · ${op.operationKey}`, op.status === 'succeeded' ? 'success' : op.status === 'pending' ? 'info' : 'danger');
  for (const i of b.incidents) push(i.receivedAt || i.createdAt, 'incident', `Incident: ${i.kind}`, i.reason, i.status === 'reconciled' ? 'neutral' : 'danger');
  for (const d of b.disputes) {
    push(d.openedAt, 'dispute', `Dispute opened: ${d.title}`, d.reasonCategory, 'warning');
    for (const tl of d.timeline || []) push(tl.createdAt, 'dispute', tl.action.replace(/_/g, ' '), tl.note);
    push(d.resolution?.resolvedAt, 'dispute', `Dispute resolved: ${d.resolution?.outcome}`, d.resolution?.moneyState ? `money ${d.resolution.moneyState}` : null, 'success');
  }
  for (const a of b.audit) push(a.createdAt, 'audit', a.description, a.adminId?.name ? `by ${a.adminId.name}` : null, 'info');
  for (const e of b.errors) push(e.createdAt, 'error', e.errorCode, e.message, 'danger');
  return ev.sort((a, b2) => a.at - b2.at);
}

const getJob = asyncHandler(async (req, res) => {
  const b = await loadOrderBundle(req.params.id);
  if (!b) return sendError(res, 'Order not found.', 404);
  const issues = orderIssues(b.order, b);
  const o = b.order;
  return sendSuccess(res, {
    order: {
      ...o,
      history: undefined,
      customer: o.customerId ? { _id: o.customerId._id, name: o.customerId.name, email: o.customerId.email, phone: o.customerId.phone, avatarUrl: o.customerId.avatarUrl, role: o.customerId.role } : null,
      provider: o.providerId
        ? { _id: o.providerId._id, name: o.providerId.name, email: o.providerId.email, phone: o.providerId.phone, avatarUrl: o.providerId.avatarUrl, connectAccount: Boolean(o.providerId.stripeConnectAccountId), payoutEnabled: o.providerId.payoutEnabled }
        : null,
      service: o.serviceId || null,
      customerId: undefined,
      providerId: undefined,
      serviceId: undefined,
    },
    issues,
    payment: b.payment,
    payout: b.payout,
    safePay: b.sph,
    disputes: b.disputes.map((d) => ({ ...d, timeline: undefined })),
    operations: b.operations,
    incidents: b.incidents,
    transfers: b.transfers,
    notifications: b.notifications,
    errors: b.errors,
    timeline: buildTimeline(b),
  });
});

const searchJobs = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  let orders = [];
  if (isId(q)) {
    orders = await Order.find({ $or: [{ _id: q }, { serviceId: q }, { customerId: q }, { providerId: q }] })
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate('serviceId', 'title')
      .select('status paymentStatus agreedPrice createdAt updatedAt serviceId')
      .lean();
  } else if (q) {
    const p = await Payment.findOne({ $or: [{ stripePaymentIntentId: q }, { stripeSessionId: q }] }).select('orderId').lean();
    const byCheckout = p ? null : await Order.findOne({ $or: [{ checkoutSessionId: q }, { paymentIntentId: q }] }).select('_id').lean();
    const id = p?.orderId || byCheckout?._id;
    if (id) orders = await Order.find({ _id: id }).populate('serviceId', 'title').select('status paymentStatus agreedPrice createdAt updatedAt serviceId').lean();
  }
  const stuck = q ? [] : (await scanOrders()).slice(0, 50).map(({ order, issues }) => ({ ...order, issues }));
  return sendSuccess(res, { orders, stuck });
});

/** Live, read-only comparison of Stripe's PaymentIntent with what the database says. */
const getStripeState = asyncHandler(async (req, res) => {
  const b = await loadOrderBundle(req.params.id);
  if (!b) return sendError(res, 'Order not found.', 404);
  const piId = b.payment?.stripePaymentIntentId || b.order.paymentIntentId;
  if (!piId) return sendSuccess(res, { available: false, reason: 'No PaymentIntent on this order.' });

  const { getStripe, getStripeForMode } = require('../../config/stripe');
  // Use the mode the payment was made in; fall back to the configured mode when unknown.
  const live = b.payment?.stripeLivemode ?? (b.order.checkoutMode ? b.order.checkoutMode === 'live' : null);
  let pi;
  try {
    const stripe = live === null ? await getStripe() : await getStripeForMode(!live);
    pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
  } catch (err) {
    return sendSuccess(res, { available: false, reason: err.code || err.type || 'stripe_unavailable' });
  }
  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const stripe = {
    id: pi.id,
    status: pi.status,
    livemode: pi.livemode,
    amount: pi.amount,
    amountReceived: pi.amount_received,
    currency: pi.currency,
    chargeId: charge?.id || null,
    amountRefunded: charge?.amount_refunded ?? null,
    refunded: charge?.refunded ?? null,
    disputed: charge?.disputed ?? null,
    created: new Date(pi.created * 1000),
  };
  const db = {
    orderPaymentStatus: b.order.paymentStatus,
    paymentStatus: b.payment?.status || null,
    capturedAmountMinor: b.payment?.capturedAmountMinor ?? null,
    refundedAmountMinor: b.payment?.refundedAmountMinor ?? null,
    livemode: b.payment?.stripeLivemode ?? null,
  };
  const diffs = [];
  if (db.capturedAmountMinor != null && stripe.amountReceived !== db.capturedAmountMinor) diffs.push(`Captured ${db.capturedAmountMinor} in DB vs ${stripe.amountReceived} at Stripe`);
  if (stripe.amountRefunded != null && (db.refundedAmountMinor || 0) !== stripe.amountRefunded) diffs.push(`Refunded ${db.refundedAmountMinor || 0} in DB vs ${stripe.amountRefunded} at Stripe`);
  if (stripe.status === 'succeeded' && db.orderPaymentStatus === 'unpaid') diffs.push('Stripe succeeded but order is unpaid');
  if (stripe.status !== 'succeeded' && ['paid', 'partially_refunded'].includes(db.orderPaymentStatus)) diffs.push(`Order paid but Stripe status is ${stripe.status}`);
  if (stripe.refunded && db.paymentStatus !== 'refunded') diffs.push('Fully refunded at Stripe but not in DB');
  if (stripe.disputed && !b.dispute) diffs.push('Charge disputed at Stripe but no dispute in DB');
  if (db.livemode != null && db.livemode !== stripe.livemode) diffs.push('Live/test mode mismatch');

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'Order',
    targetId: b.order._id,
    description: 'Developer compared order with live Stripe state',
    metadata: { area: 'developer.safepay', diffs: diffs.length },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  return sendSuccess(res, { available: true, stripe, db, diffs, matches: diffs.length === 0 });
});

module.exports = { loadOrderBundle, buildTimeline, getJob, searchJobs, getStripeState };
