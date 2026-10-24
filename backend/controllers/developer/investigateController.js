const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const ErrorLog = require('../../models/ErrorLog');
const SupportTicket = require('../../models/SupportTicket');
const AdminActivity = require('../../models/AdminActivity');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const StripeTransferRecord = require('../../models/StripeTransferRecord');
const net = require('net');
const Service = require('../../models/Service');
const Incident = require('../../models/Incident');
const IpBlock = require('../../models/IpBlock');
const StripeEvent = require('../../models/StripeEvent');
const SecurityEvent = require('../../models/SecurityEvent');
const ChangeRequest = require('../../models/ChangeRequest');
const { isId } = require('../../utils/devQuery');
const { orderIssues } = require('../../services/monitoring/orderHealth');
const { loadOrderBundle, buildTimeline } = require('./jobDiagnosticsController');

/** Developer console — paste any id, Stripe reference, email or IP and see everything linked to it. Read-only. */

// ── Global investigation search ─────────────────────────────────────────────
const STRIPE_REF = /^(pi|cs|ch|re|evt|sub|cus|tr|acct|in|py|po)_[A-Za-z0-9_]+$/;

/** What kind of identifier the developer pasted. Pure, so it is unit-tested. */
function classifyQuery(raw) {
  const q = String(raw || '').trim();
  if (!q) return null;
  if (isId(q)) return 'objectId';
  if (STRIPE_REF.test(q)) return 'stripe';
  if (net.isIP(q)) return 'ip';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return 'email';
  return 'reference'; // ERR-… reference ids, request ids, correlation ids
}

const userMatch = (u) => ({ type: 'user', id: String(u._id), label: u.name || u.email, detail: `${u.role} · ${u.email}`, status: u.isDeleted ? 'deleted' : u.accountStatus, at: u.createdAt });
const errorMatch = (e) => ({ type: 'error', id: e.referenceId || String(e._id), label: `${e.errorCode}: ${e.message}`.slice(0, 160), detail: e.route, status: e.status, at: e.lastSeen || e.createdAt });
const webhookMatch = (e) => ({ type: 'webhook', id: e.eventId, label: e.type, detail: e.objectId, status: e.status, at: e.createdAt });
const ERR_FIELDS = 'referenceId requestId errorCode message route status lastSeen createdAt userId metadata.orderId';
const USER_FIELDS = 'name email role accountStatus isDeleted createdAt';
const EVENT_FIELDS = 'eventId type status objectId createdAt';

/**
 * One box for any id: ObjectId, Stripe reference, error reference / request id, email or IP.
 * Returns every record it resolves to plus, when an order is involved, its health issues
 * and merged lifecycle timeline (same rules as Job Diagnostics). Read-only.
 */
const investigate = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  const kind = classifyQuery(q);
  if (!kind) return sendError(res, 'q is required.', 400);
  const matches = [];
  const orderIds = new Set();
  const userIds = new Set();
  const addOrder = (id) => id && orderIds.add(String(id));
  const addUser = (id) => id && userIds.add(String(id));

  if (kind === 'objectId') {
    const [user, order, service, payment, payout, dispute, incident, ticket, error, change] = await Promise.all([
      User.findById(q).select(USER_FIELDS).lean(),
      Order.findById(q).select('_id').lean(),
      Service.findById(q).select('title status createdAt').lean(),
      Payment.findById(q).select('orderId status amount createdAt').lean(),
      Payout.findById(q).select('orderId status createdAt').lean(),
      Dispute.findById(q).select('orderId status title openedAt').lean(),
      Incident.findById(q).select('title status severity startedAt').lean(),
      SupportTicket.findById(q).select('subject status orderId userId createdAt').lean(),
      ErrorLog.findById(q).select(ERR_FIELDS).lean(),
      ChangeRequest.findById(q).select('summary status createdAt').lean(),
    ]);
    if (user) matches.push(userMatch(user));
    if (order) addOrder(order._id);
    if (service) {
      matches.push({ type: 'service', id: q, label: service.title, status: service.status, at: service.createdAt });
      (await Order.find({ serviceId: q }).sort({ updatedAt: -1 }).limit(5).select('_id').lean()).forEach((o) => addOrder(o._id));
    }
    if (payment) {
      matches.push({ type: 'payment', id: q, label: `Payment ${payment.amount} NOK`, status: payment.status, at: payment.createdAt, orderId: payment.orderId });
      addOrder(payment.orderId);
    }
    if (payout) {
      matches.push({ type: 'payout', id: q, label: 'Payout', status: payout.status, at: payout.createdAt, orderId: payout.orderId });
      addOrder(payout.orderId);
    }
    if (dispute) {
      matches.push({ type: 'dispute', id: q, label: dispute.title, status: dispute.status, at: dispute.openedAt, orderId: dispute.orderId });
      addOrder(dispute.orderId);
    }
    if (incident) matches.push({ type: 'incident', id: q, label: incident.title, detail: incident.severity, status: incident.status, at: incident.startedAt });
    if (ticket) {
      matches.push({ type: 'ticket', id: q, label: ticket.subject, status: ticket.status, at: ticket.createdAt, orderId: ticket.orderId });
      addOrder(ticket.orderId);
      addUser(ticket.userId);
    }
    if (error) {
      matches.push(errorMatch(error));
      addOrder(error.metadata?.orderId);
      addUser(error.userId);
    }
    if (change) matches.push({ type: 'approval', id: q, label: change.summary, status: change.status, at: change.createdAt });
  } else if (kind === 'stripe') {
    const [payments, orders, payouts, subs, users, events, ops] = await Promise.all([
      Payment.find({ $or: [{ stripePaymentIntentId: q }, { stripeSessionId: q }, { stripeRefundId: q }, { stripeEventId: q }] }).limit(10).select('orderId status amount createdAt').lean(),
      Order.find({ $or: [{ checkoutSessionId: q }, { paymentIntentId: q }] }).limit(10).select('_id').lean(),
      Payout.find({ $or: [{ stripeTransferId: q }, { stripePaymentIntentId: q }, { stripeCheckoutSessionId: q }, { stripeConnectAccountId: q }] }).limit(10).select('orderId status createdAt').lean(),
      SubscriptionV2.find({ $or: [{ stripeSubscriptionId: q }, { stripeCustomerId: q }] }).limit(10).select('userId status planType createdAt').lean(),
      User.find({ $or: [{ stripeCustomerId: q }, { stripeCustomerIdTest: q }, { stripeConnectAccountId: q }] }).limit(10).select(USER_FIELDS).lean(),
      StripeEvent.find({ $or: [{ eventId: q }, { objectId: q }] }).sort({ createdAt: -1 }).limit(20).select(EVENT_FIELDS).lean(),
      StripeTransferRecord.find({ stripeObjectId: q }).limit(10).select('orderId').lean(),
    ]);
    for (const p of payments) {
      matches.push({ type: 'payment', id: String(p._id), label: `Payment ${p.amount} NOK`, status: p.status, at: p.createdAt, orderId: p.orderId });
      addOrder(p.orderId);
    }
    for (const p of payouts) {
      matches.push({ type: 'payout', id: String(p._id), label: 'Payout', status: p.status, at: p.createdAt, orderId: p.orderId });
      addOrder(p.orderId);
    }
    for (const s of subs) {
      matches.push({ type: 'subscription', id: String(s._id), label: `Subscription ${s.planType || ''}`.trim(), status: s.status, at: s.createdAt, userId: s.userId });
      addUser(s.userId);
    }
    users.forEach((u) => matches.push(userMatch(u)));
    events.forEach((e) => matches.push(webhookMatch(e)));
    [...orders, ...ops].forEach((o) => addOrder(o.orderId || o._id));
  } else if (kind === 'email') {
    const user = await User.findOne({ email: q.toLowerCase() }).select(USER_FIELDS).lean();
    if (user) matches.push(userMatch(user));
  } else if (kind === 'ip') {
    const [events, block] = await Promise.all([
      SecurityEvent.aggregate([{ $match: { ip: q } }, { $group: { _id: '$type', n: { $sum: 1 }, last: { $max: '$at' }, users: { $addToSet: '$userId' } } }]),
      IpBlock.findOne({ target: q }).select('reason expiresAt').lean(),
    ]);
    matches.push({
      type: 'ip',
      id: q,
      label: q,
      detail: events.length ? events.map((e) => `${e.n} ${e._id.replace(/_/g, ' ')}`).join(' · ') : 'No security events recorded',
      status: block ? 'blocked' : 'not blocked',
      at: events.reduce((a, e) => (!a || e.last > a ? e.last : a), null),
    });
    events.flatMap((e) => e.users).slice(0, 10).forEach(addUser);
  } else {
    const [errors, activity, events] = await Promise.all([
      ErrorLog.find({ $or: [{ referenceId: q }, { requestId: q }] }).sort({ createdAt: -1 }).limit(20).select(ERR_FIELDS).lean(),
      AdminActivity.find({ 'metadata.correlationId': q }).sort({ createdAt: -1 }).limit(20).populate('adminId', 'name').select('action description createdAt adminId').lean(),
      StripeEvent.find({ eventId: q }).limit(5).select(EVENT_FIELDS).lean(),
    ]);
    for (const e of errors) {
      matches.push(errorMatch(e));
      addOrder(e.metadata?.orderId);
      addUser(e.userId);
    }
    activity.forEach((a) => matches.push({ type: 'audit', id: String(a._id), label: a.description, detail: a.adminId?.name ? `by ${a.adminId.name}` : a.action, at: a.createdAt }));
    events.forEach((e) => matches.push(webhookMatch(e)));
  }

  const known = new Set(matches.filter((m) => m.type === 'user').map((m) => m.id));
  const extraUsers = [...userIds].filter((id) => isId(id) && !known.has(id));
  if (extraUsers.length) (await User.find({ _id: { $in: extraUsers } }).select(USER_FIELDS).lean()).forEach((u) => matches.push(userMatch(u)));

  // ponytail: full bundle for at most 3 orders; a query resolving to more only reports the count.
  const ids = [...orderIds].filter(isId);
  const bundles = (await Promise.all(ids.slice(0, 3).map(loadOrderBundle))).filter(Boolean);
  const orders = bundles.map((b) => ({
    _id: String(b.order._id),
    title: b.order.serviceId?.title || 'Order',
    status: b.order.status,
    paymentStatus: b.order.paymentStatus,
    agreedPrice: b.order.agreedPrice,
    customer: b.order.customerId ? { _id: String(b.order.customerId._id), name: b.order.customerId.name } : null,
    provider: b.order.providerId ? { _id: String(b.order.providerId._id), name: b.order.providerId.name } : null,
    safePay: b.sph?.status || null,
    payout: b.payout?.status || null,
    issues: orderIssues(b.order, b),
    timeline: buildTimeline(b),
  }));

  matches.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  return sendSuccess(res, { q, kind, matches, orders, moreOrders: Math.max(ids.length - 3, 0) });
});

module.exports = { STRIPE_REF, classifyQuery, userMatch, errorMatch, webhookMatch, ERR_FIELDS, USER_FIELDS, EVENT_FIELDS, investigate };
