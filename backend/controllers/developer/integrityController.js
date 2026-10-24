const mongoose = require('mongoose');
const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Service = require('../../models/Service');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const Review = require('../../models/Review');
const SupportTicket = require('../../models/SupportTicket');
const SafePayHistory = require('../../models/SafePayHistory');
const SubscriptionV2 = require('../../models/SubscriptionV2');

/**
 * Developer dashboard — Data Integrity Center. Read-only structural checks the
 * money reconciliation does not cover: duplicates, dangling references, broken
 * invariants, and indexes the schema declares but the database does not have
 * (Mongoose logs a failed index build and carries on, so a missing unique index
 * is otherwise invisible). Nothing here modifies data; fixes go through scripts
 * with a dry-run and a backup (see docs/runbooks).
 *
 * Aggregations use only operators supported by self-hosted MongoDB ≥ 5 and Atlas.
 */

const SAMPLES = 20;
const MAX_MS = 20000;
// ponytail: orphan checks scan the newest SCAN_LIMIT documents per collection; raise it or
// move the run to a scheduled job when collections outgrow it.
const SCAN_LIMIT = 50000;
const RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const facet = (project) => [{ $facet: { count: [{ $count: 'n' }], samples: [{ $limit: SAMPLES }, { $project: project }] } }];
const unpack = ([r]) => ({ count: r?.count[0]?.n || 0, samples: r?.samples || [] });

/** Groups sharing the same key (n > 1). */
const duplicates = (Model, key, match = {}) => async () =>
  unpack(
    await Model.aggregate([{ $match: match }, { $group: { _id: key, n: { $sum: 1 }, ids: { $push: '$_id' } } }, { $match: { n: { $gt: 1 } } }, { $sort: { n: -1 } }, ...facet({ key: '$_id', n: 1, ids: { $slice: ['$ids', 10] }, _id: 0 })])
      .option({ maxTimeMS: MAX_MS, allowDiskUse: true })
  );

/** Documents whose `field` points at a document that does not exist. */
const orphans = (Model, field, Target) => async () =>
  unpack(
    await Model.aggregate([
      { $match: { [field]: { $type: 'objectId' } } },
      { $sort: { _id: -1 } },
      { $limit: SCAN_LIMIT },
      { $lookup: { from: Target.collection.collectionName, localField: field, foreignField: '_id', pipeline: [{ $project: { _id: 1 } }], as: 't' } },
      { $match: { t: { $size: 0 } } },
      ...facet({ [field]: 1, createdAt: 1 }),
    ]).option({ maxTimeMS: MAX_MS, allowDiskUse: true })
  );

/** Documents matching a condition that must never hold. */
const violations = (Model, match, project) => async () => unpack(await Model.aggregate([{ $match: match }, { $sort: { _id: -1 } }, ...facet(project)]).option({ maxTimeMS: MAX_MS }));

const noValue = () => ({ $in: [null, ''] });
const CHECKS = [
  // Duplicates
  { key: 'payment_per_order', category: 'duplicate', severity: 'critical', entity: 'Payment', title: 'More than one Payment for an order', why: 'One order must have exactly one Payment. Extra rows double-count revenue and can trigger double notifications.', run: duplicates(Payment, '$orderId') },
  { key: 'payment_intent_reused', category: 'duplicate', severity: 'critical', entity: 'Payment', title: 'PaymentIntent recorded on several Payments', why: 'A Stripe PaymentIntent belongs to one payment.', run: duplicates(Payment, '$stripePaymentIntentId', { stripePaymentIntentId: { $nin: [null, ''] } }) },
  { key: 'payout_per_order', category: 'duplicate', severity: 'critical', entity: 'Payout', title: 'More than one Payout for an order', why: 'A provider must be paid once per order.', run: duplicates(Payout, '$orderId') },
  { key: 'checkout_session_reused', category: 'duplicate', severity: 'high', entity: 'Order', title: 'Checkout session shared by several orders', why: 'Each Checkout session is created for one order.', run: duplicates(Order, '$checkoutSessionId', { checkoutSessionId: { $nin: [null, ''] } }) },
  { key: 'user_email', category: 'duplicate', severity: 'high', entity: 'User', title: 'Users sharing an email (case-insensitive)', why: 'Login and password reset pick one of them arbitrarily.', run: duplicates(User, { $toLower: '$email' }, { email: { $type: 'string' } }) },
  { key: 'live_subscriptions', category: 'duplicate', severity: 'high', entity: 'SubscriptionV2', title: 'User with several live subscriptions', why: 'A user should have at most one pending/active/past-due/canceling subscription per Stripe mode.', run: duplicates(SubscriptionV2, { userId: '$userId', mode: '$stripeMode' }, { status: { $in: ['pending', 'active', 'past_due', 'canceling'] } }) },

  // Dangling references
  { key: 'payment_orphan', category: 'orphan', severity: 'critical', entity: 'Payment', title: 'Payment for an order that does not exist', why: 'Money recorded with nothing to settle it against.', run: orphans(Payment, 'orderId', Order) },
  { key: 'payout_orphan', category: 'orphan', severity: 'critical', entity: 'Payout', title: 'Payout for an order that does not exist', why: 'A transfer with no order cannot be audited.', run: orphans(Payout, 'orderId', Order) },
  { key: 'safepay_orphan', category: 'orphan', severity: 'high', entity: 'SafePayHistory', title: 'SafePay record for a missing order', why: 'Escrow history without its order.', run: orphans(SafePayHistory, 'orderId', Order) },
  { key: 'dispute_orphan', category: 'orphan', severity: 'high', entity: 'Dispute', title: 'Dispute for a missing order', why: 'The dispute cannot be resolved or paid out.', run: orphans(Dispute, 'orderId', Order) },
  { key: 'order_customer_orphan', category: 'orphan', severity: 'high', entity: 'Order', title: 'Order whose customer does not exist', why: 'Refunds and notifications have no recipient. Deleted users are soft-deleted, so a hard-missing user is a bug.', run: orphans(Order, 'customerId', User) },
  { key: 'order_provider_orphan', category: 'orphan', severity: 'high', entity: 'Order', title: 'Order whose provider does not exist', why: 'Payouts have no destination.', run: orphans(Order, 'providerId', User) },
  { key: 'order_service_orphan', category: 'orphan', severity: 'medium', entity: 'Order', title: 'Order whose job does not exist', why: 'Job details and history cannot be shown.', run: orphans(Order, 'serviceId', Service) },
  { key: 'subscription_user_orphan', category: 'orphan', severity: 'high', entity: 'SubscriptionV2', title: 'Subscription for a missing user', why: 'Stripe may keep billing a customer we cannot see.', run: orphans(SubscriptionV2, 'userId', User) },
  { key: 'service_user_orphan', category: 'orphan', severity: 'low', entity: 'Service', title: 'Job posted by a missing user', why: 'Shown without an owner.', run: orphans(Service, 'userId', User) },
  { key: 'review_order_orphan', category: 'orphan', severity: 'low', entity: 'Review', title: 'Review for a missing order', why: 'Counts toward ratings without a job behind it.', run: orphans(Review, 'orderId', Order) },
  { key: 'ticket_order_orphan', category: 'orphan', severity: 'low', entity: 'SupportTicket', title: 'Support ticket linked to a missing order', why: 'Support cannot open the job.', run: orphans(SupportTicket, 'orderId', Order) },

  // Invariants
  { key: 'payment_without_stripe_ref', category: 'invariant', severity: 'high', entity: 'Payment', title: 'Payment with no Stripe reference', why: 'Every Payment comes from Stripe; without pi_/cs_ it cannot be verified or refunded.', run: violations(Payment, { stripePaymentIntentId: noValue(), stripeSessionId: noValue() }, { orderId: 1, status: 1, amount: 1, createdAt: 1 }) },
  { key: 'paid_order_without_ref', category: 'invariant', severity: 'high', entity: 'Order', title: 'Paid order with no PaymentIntent or Checkout session', why: 'Paid status that Stripe cannot confirm.', run: violations(Order, { paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] }, paymentIntentId: noValue(), checkoutSessionId: noValue() }, { status: 1, paymentStatus: 1, agreedPrice: 1, createdAt: 1 }) },
  { key: 'transferred_without_transfer', category: 'invariant', severity: 'critical', entity: 'Payout', title: 'Payout marked transferred without a Stripe transfer', why: 'The provider may not actually have been paid.', run: violations(Payout, { status: 'transferred', stripeTransferId: noValue() }, { orderId: 1, status: 1, createdAt: 1 }) },
  { key: 'payment_amount', category: 'invariant', severity: 'high', entity: 'Payment', title: 'Payment amount missing, zero or negative', why: 'Totals, fees and refunds are computed from it.', run: violations(Payment, { amount: { $not: { $gt: 0 } } }, { orderId: 1, amount: 1, status: 1, createdAt: 1 }) },
  { key: 'order_price', category: 'invariant', severity: 'medium', entity: 'Order', title: 'Order with a negative price', why: 'Prices are never negative.', run: violations(Order, { agreedPrice: { $lt: 0 } }, { agreedPrice: 1, status: 1, createdAt: 1 }) },
];

/** Normalised index key: "field:1,other:-1". */
const keyOf = (k) => Object.entries(k).map(([f, d]) => `${f}:${d}`).join(',');

/**
 * Compare what each Mongoose schema declares with what the database has. Pure over its
 * inputs so it is unit-tested. Unique/partial indexes missing from the DB are critical:
 * the code's idempotency guarantees silently stop holding.
 */
function indexDrift(declared, actual) {
  const out = [];
  const have = new Map(actual.filter((i) => i.name !== '_id_').map((i) => [keyOf(i.key), i]));
  for (const [key, opts = {}] of declared) {
    const k = keyOf(key);
    const db = have.get(k);
    if (!db) out.push({ key: k, problem: 'missing', unique: Boolean(opts.unique), severity: opts.unique ? 'critical' : 'medium' });
    else if (opts.unique && !db.unique) out.push({ key: k, problem: 'not_unique', unique: true, severity: 'critical' });
    have.delete(k);
  }
  for (const [k, i] of have) out.push({ key: k, problem: 'undeclared', unique: Boolean(i.unique), severity: 'info', name: i.name });
  return out;
}

async function indexCheck() {
  const rows = [];
  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    if (Model.schema.options.autoIndex === false) continue;
    let actual = [];
    try {
      actual = await Model.collection.indexes();
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') throw err; // collection never written: nothing to compare
      continue;
    }
    for (const d of indexDrift(Model.schema.indexes(), actual)) rows.push({ collection: Model.collection.collectionName, ...d });
  }
  return rows;
}

let last = null;
let running = null;

async function runAll() {
  const started = Date.now();
  const results = await Promise.all(
    CHECKS.map(async ({ run, ...c }) => {
      const t = Date.now();
      try {
        const r = await run();
        return { ...c, ...r, ok: r.count === 0, ms: Date.now() - t };
      } catch (err) {
        return { ...c, count: null, samples: [], ok: false, ms: Date.now() - t, error: err.message };
      }
    })
  );
  let indexes = [];
  let indexError = null;
  try {
    indexes = await indexCheck();
  } catch (err) {
    indexError = err.message;
  }
  indexes.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const failing = results.filter((r) => !r.ok);
  const indexProblems = indexes.filter((i) => i.severity !== 'info');
  const bySeverity = {};
  for (const r of failing) bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  for (const i of indexProblems) bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  results.sort((a, b) => Number(a.ok) - Number(b.ok) || RANK[a.severity] - RANK[b.severity]);
  return {
    generatedAt: new Date(),
    durationMs: Date.now() - started,
    scanLimit: SCAN_LIMIT,
    summary: { checks: results.length, passing: results.length - failing.length, failing: failing.length, affected: failing.reduce((a, r) => a + (r.count || 0), 0), indexProblems: indexProblems.length, bySeverity },
    checks: results,
    indexes,
    indexError,
  };
}

// ponytail: results are cached per process (lost on restart, not shared between instances);
// persist them if the dashboard ever runs behind several backends.
const refresh = () => (running ||= runAll().then((r) => (last = r)).finally(() => (running = null)));

const getIntegrity = asyncHandler(async (req, res) => {
  const data = last || (await refresh());
  return sendSuccess(res, { ...data, running: Boolean(running) });
});

const runIntegrity = asyncHandler(async (req, res) => {
  const data = await refresh();
  await logActivity({
    adminId: req.user._id,
    action: 'other',
    description: 'Developer ran data integrity checks',
    metadata: { area: 'developer.integrity', failing: data.checks.filter((c) => !c.ok).map((c) => c.key), indexProblems: data.summary.indexProblems },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  return sendSuccess(res, { ...data, running: false });
});

module.exports = { CHECKS, indexDrift, indexCheck, getIntegrity, runIntegrity };
