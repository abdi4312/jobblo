const mongoose = require('mongoose');

/**
 * User impact analyzer: for an error group, an incident, an API release or a time window,
 * work out which users, jobs and payments were hit and how much money sits on those jobs.
 * Attribution is only as good as the error logs: a request without a signed-in user or an
 * order id in its metadata is counted as "unattributed", never guessed.
 */

const DAY = 86_400_000;
const MAX_LOGS = 5000;
const isId = (v) => v && mongoose.isValidObjectId(v) && String(v).length === 24;

/** Pure: pull user ids, order ids and Stripe object ids out of error log rows. Unit-tested. */
function collectRefs(logs) {
  const users = new Set();
  const orders = new Set();
  const stripe = new Set();
  let unattributed = 0;
  for (const l of logs) {
    const m = l.metadata && typeof l.metadata === 'object' ? l.metadata : {};
    let hit = false;
    for (const u of [l.userId, m.userId]) if (isId(u)) (users.add(String(u)), (hit = true));
    for (const o of [m.orderId, ...(Array.isArray(m.orders) ? m.orders.map((x) => x?.orderId) : []), ...(Array.isArray(m.disputes) ? m.disputes.map((x) => x?.orderId) : [])]) if (isId(o)) (orders.add(String(o)), (hit = true));
    for (const s of [m.objectId, m.paymentIntentId]) if (typeof s === 'string' && /^(pi|sub|in|ch)_[A-Za-z0-9]+$/.test(s)) (stripe.add(s), (hit = true));
    if (!hit) unattributed += 1;
  }
  return { users: [...users], orders: [...orders], stripe: [...stripe], unattributed };
}

/** Error log filter + window for a scope. Returns null when the target does not exist. */
async function resolveScope({ kind, id, hours = 6, from, to }) {
  const ErrorLog = require('../../models/ErrorLog');
  if (kind === 'error') {
    if (!isId(id)) return null;
    const doc = await ErrorLog.findById(id).select('errorCode route message createdAt').lean();
    if (!doc) return null;
    return { label: `${doc.errorCode} · ${doc.route || 'no route'}`, filter: { errorCode: doc.errorCode, route: doc.route, message: doc.message }, from: new Date(Date.now() - 30 * DAY), to: new Date() };
  }
  if (kind === 'incident') {
    if (!isId(id)) return null;
    const inc = await require('../../models/Incident').findById(id).lean();
    if (!inc) return null;
    const end = inc.resolvedAt || inc.recoveredAt || new Date();
    // ponytail: an incident without related error codes counts every error in its window.
    return { label: inc.title, filter: inc.relatedErrorCodes?.length ? { errorCode: { $in: inc.relatedErrorCodes } } : {}, from: inc.startedAt, to: end, extraOrders: (inc.relatedOrderIds || []).map(String) };
  }
  if (kind === 'release') {
    if (!isId(id)) return null;
    const Deployment = require('../../models/Deployment');
    const d = await Deployment.findById(id).lean();
    if (!d) return null;
    const next = await Deployment.findOne({ deployedAt: { $gt: d.deployedAt } }).sort({ deployedAt: 1 }).select('deployedAt').lean();
    const w = require('./deployments').windows(d.deployedAt, next?.deployedAt, hours);
    // Only error groups the release introduced: existing errors are not its fault.
    const groups = await require('./deployments').newErrorGroups(...w.after);
    return { label: `Release ${d.version}`, filter: groups.length ? { $or: groups.map((g) => ({ errorCode: g.errorCode, route: g.route, message: g.message })) } : { _id: null }, from: w.after[0], to: w.after[1] };
  }
  if (kind === 'window') {
    const f = new Date(from);
    const t = to ? new Date(to) : new Date();
    if (!Number.isFinite(+f) || !Number.isFinite(+t) || t <= f || t - f > 31 * DAY) return null;
    return { label: 'Time window', filter: {}, from: f, to: t };
  }
  return null;
}

/** Affected users / jobs / payments for a resolved scope. */
async function measure(scope, { detail = true } = {}) {
  const ErrorLog = require('../../models/ErrorLog');
  const Order = require('../../models/Order');
  const Payment = require('../../models/Payment');
  const match = { ...scope.filter, createdAt: { $gte: scope.from, $lt: scope.to } };
  const [logs, occurrences] = await Promise.all([ErrorLog.find(match).sort({ createdAt: -1 }).limit(MAX_LOGS).select('userId metadata').lean(), ErrorLog.countDocuments(match)]);
  const refs = collectRefs(logs);
  const orderIds = new Set([...refs.orders, ...(scope.extraOrders || [])]);

  // Stripe ids → jobs (payment intents) and users (subscriptions).
  const pis = refs.stripe.filter((s) => s.startsWith('pi_'));
  const subs = refs.stripe.filter((s) => s.startsWith('sub_'));
  const [piOrders, piPayments, subUsers] = await Promise.all([
    pis.length ? Order.find({ paymentIntentId: { $in: pis } }).select('_id').lean() : [],
    pis.length ? Payment.find({ stripePaymentIntentId: { $in: pis } }).select('orderId').lean() : [],
    subs.length ? require('../../models/SubscriptionV2').find({ stripeSubscriptionId: { $in: subs } }).select('userId').lean() : [],
  ]);
  for (const o of [...piOrders.map((x) => x._id), ...piPayments.map((x) => x.orderId)]) if (o) orderIds.add(String(o));
  const direct = new Set(refs.users);
  for (const s of subUsers) if (s.userId) direct.add(String(s.userId));

  const orders = orderIds.size ? await Order.find({ _id: { $in: [...orderIds] } }).select('status paymentStatus agreedPrice price customerId providerId createdAt').lean() : [];
  const viaJob = new Set();
  for (const o of orders) for (const u of [o.customerId, o.providerId]) if (u && !direct.has(String(u))) viaJob.add(String(u));
  const payments = orders.length ? await Payment.find({ orderId: { $in: orders.map((o) => o._id) } }).select('orderId status amount refundStatus createdAt').lean() : [];
  const nok = (o) => Number(o.agreedPrice ?? o.price ?? 0) || 0;

  const result = {
    label: scope.label,
    from: scope.from,
    to: scope.to,
    occurrences,
    sampled: occurrences > MAX_LOGS,
    unattributed: refs.unattributed,
    users: direct.size + viaJob.size,
    usersDirect: direct.size,
    usersViaJob: viaJob.size,
    jobs: orders.length,
    payments: payments.length,
    // Order prices are NOK major units.
    jobValueNok: orders.reduce((a, o) => a + nok(o), 0),
    // Money actually taken from customers (refunded payments excluded).
    capturedNok: payments.filter((p) => ['completed', 'released', 'disputed', 'partially_refunded'].includes(p.status)).reduce((a, p) => a + (Number(p.amount) || 0), 0),
  };
  if (!detail) return result;

  const User = require('../../models/User');
  const ids = [...direct, ...viaJob].slice(0, 200);
  const people = ids.length ? await User.find({ _id: { $in: ids } }).select('name role email').lean() : [];
  const maskEmail = require('./securityEvents').maskEmail;
  const hits = {};
  for (const l of logs) for (const u of [l.userId, l.metadata?.userId]) if (isId(u)) hits[String(u)] = (hits[String(u)] || 0) + 1;
  return {
    ...result,
    people: people
      .map((u) => ({ id: String(u._id), name: u.name || '—', role: u.role, email: maskEmail(u.email), how: direct.has(String(u._id)) ? 'direct' : 'via job', hits: hits[String(u._id)] || 0 }))
      .sort((a, b) => b.hits - a.hits),
    jobRows: orders.map((o) => ({ id: String(o._id), status: o.status, paymentStatus: o.paymentStatus, valueNok: nok(o), createdAt: o.createdAt })),
    paymentRows: payments.map((p) => ({ id: String(p._id), orderId: String(p.orderId), status: p.status, refundStatus: p.refundStatus, amountNok: p.amount, createdAt: p.createdAt })),
  };
}

/** Error groups ranked by people affected in the last `days`. */
async function rankErrors(days = 7) {
  const from = new Date(Date.now() - days * DAY);
  const rows = await require('../../models/ErrorLog').aggregate([
    { $match: { createdAt: { $gte: from } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { errorCode: '$errorCode', route: '$route', message: '$message' },
        id: { $first: '$_id' },
        severity: { $first: '$severity' },
        n: { $sum: 1 },
        last: { $first: '$createdAt' },
        users: { $addToSet: { $ifNull: ['$userId', '$metadata.userId'] } },
        orders: { $addToSet: '$metadata.orderId' },
        listed: { $push: '$metadata.orders.orderId' },
      },
    },
    { $limit: 500 },
  ]);
  return rows
    .map((r) => {
      const orders = new Set([...r.orders, ...r.listed.flat()].filter(isId).map(String));
      return { id: String(r.id), errorCode: r._id.errorCode, route: r._id.route, message: r._id.message, severity: r.severity, occurrences: r.n, last: r.last, users: r.users.filter(isId).length, jobs: orders.size };
    })
    .sort((a, b) => b.users - a.users || b.jobs - a.jobs || b.occurrences - a.occurrences)
    .slice(0, 30);
}

/** Overview: ranked errors, and headline numbers for recent incidents and releases. */
async function overview({ days = 7 } = {}) {
  const [errors, incidents, releases] = await Promise.all([
    rankErrors(days),
    require('../../models/Incident').find().sort({ startedAt: -1 }).limit(10).select('title severity status startedAt').lean(),
    require('../../models/Deployment').find().sort({ deployedAt: -1 }).limit(10).select('version commit deployedAt').lean(),
  ]);
  // ponytail: one measure() per row (≈ 6 queries each, 20 rows); fine at this volume, cache if it grows.
  const withNumbers = (kind, list) =>
    Promise.all(
      list.map(async (x) => {
        const scope = await resolveScope({ kind, id: String(x._id) });
        return { ...x, id: String(x._id), _id: undefined, impact: scope ? await measure(scope, { detail: false }) : null };
      })
    );
  const [inc, rel] = await Promise.all([withNumbers('incident', incidents), withNumbers('release', releases)]);
  return { days, errors, incidents: inc, releases: rel };
}

module.exports = { collectRefs, resolveScope, measure, rankErrors, overview };
