const mongoose = require('mongoose');

/**
 * Business transaction tracing: one job's whole life —
 *   posted → first bid → accepted → paid → started → delivered → completed → paid out → reviewed
 * — rebuilt from Service, JobRequest, Order, Payment, Payout and Review, plus the branches
 * (cancelled, refunded, disputed). The journey view aggregates the same stages over many
 * jobs: how far they get, how long each step takes, and which ones are stuck right now.
 * Read-only.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const model = (name) => require(`../../models/${name}`);
const isId = (v) => mongoose.isValidObjectId(v) && String(v).length === 24;

const STAGES = [
  { key: 'posted', label: 'Job posted' },
  { key: 'first_bid', label: 'First bid', optional: true },
  { key: 'accepted', label: 'Provider accepted / contract' },
  { key: 'paid', label: 'Customer paid (SafePay)' },
  { key: 'started', label: 'Work started' },
  { key: 'delivered', label: 'Delivered for review' },
  { key: 'completed', label: 'Approved / completed' },
  { key: 'paid_out', label: 'Provider paid out' },
  { key: 'reviewed', label: 'Review left', optional: true, from: 'completed' },
];
// How long a job may sit at a stage before it counts as stuck (waiting for the next stage).
const STUCK_AFTER = { posted: 3 * DAY, first_bid: 7 * DAY, accepted: 2 * DAY, paid: 3 * DAY, started: 7 * DAY, delivered: 7 * DAY, completed: DAY };

/** Pure: stage timestamps for one job from its records. Unit-tested. */
function stagesOf({ service, firstBidAt, order, payment, payout, review }) {
  return {
    posted: service?.createdAt || null,
    first_bid: firstBidAt || null,
    accepted: order?.createdAt || null,
    paid: order?.paymentConfirmedAt || payment?.createdAt || null,
    started: order?.startedAt || null,
    delivered: order?.readyForReviewAt || null,
    completed: order?.status === 'completed' ? order.completedAt || order.updatedAt : null,
    paid_out: payout && ['released_internal', 'processing', 'transferred'].includes(payout.status) ? payout.transferCompletedAt || payout.createdAt : null,
    reviewed: review?.createdAt || null,
  };
}

/** Pure: where the job is, whether it ended in a branch, and whether it is stuck. */
function position(stages, { order, now = Date.now() } = {}) {
  // The journey stops at the first REQUIRED step that never happened, even if later steps
  // exist (a review written at approval must not hide a payout that never came).
  let current = null;
  const skipped = [];
  let furthest = -1;
  STAGES.forEach((s, i) => { if (stages[s.key]) furthest = i; });
  for (let i = 0; i <= furthest; i++) {
    const s = STAGES[i];
    if (stages[s.key]) { if (!skipped.length) current = s.key; }
    else if (!s.optional) skipped.push(s.key);
  }
  const branch = order?.status === 'cancelled' ? (order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded' ? 'refunded' : 'cancelled') : order?.status === 'disputed' ? 'disputed' : order?.status === 'declined' ? 'declined' : null;
  const done = current === 'reviewed' || (current === 'paid_out' && !STUCK_AFTER.paid_out) || branch === 'refunded' || branch === 'cancelled' || branch === 'declined';
  const since = current ? new Date(stages[current]).getTime() : null;
  const waiting = current && !done && !branch ? now - since : null;
  const limit = current ? STUCK_AFTER[current] : null;
  return { current, branch, skipped, waitingMs: waiting, stuck: Boolean(waiting && limit && waiting > limit) };
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null);

/** Resolve any id (job, order, payment, payout, job request) to the job. */
async function resolveServiceId(id) {
  if (!isId(id)) return null;
  if (await model('Service').exists({ _id: id })) return String(id);
  const order = await model('Order').findById(id).select('serviceId').lean();
  if (order) return String(order.serviceId);
  for (const [m, field] of [['Payment', 'orderId'], ['Payout', 'orderId']]) {
    const r = await model(m).findById(id).select(field).lean();
    if (r) return resolveServiceId(String(r[field]));
  }
  const jr = await model('JobRequest').findById(id).select('serviceId').lean();
  return jr ? String(jr.serviceId) : null;
}

async function traceJob(anyId) {
  const serviceId = await resolveServiceId(anyId);
  if (!serviceId) return null;
  const [service, bids, orders, chats] = await Promise.all([
    model('Service').findById(serviceId).populate('userId', 'name').select('title status price createdAt userId categories').lean(),
    model('JobRequest').find({ serviceId }).sort({ createdAt: 1 }).populate('providerId', 'name').select('providerId status createdAt withdrawnAt').lean(),
    model('Order').find({ serviceId }).sort({ createdAt: 1 }).populate('customerId providerId', 'name').select('status paymentStatus agreedPrice createdAt updatedAt paymentConfirmedAt startedAt readyForReviewAt completedAt customerId providerId chatId cancellationReason').lean(),
    model('ChatMessage').countDocuments({ serviceId }),
  ]);
  // The transaction is the latest order that got furthest; earlier cancelled attempts are listed as history.
  const order = [...orders].reverse().find((o) => o.status !== 'cancelled') || orders[orders.length - 1] || null;
  const [payment, payout, review, disputes] = order
    ? await Promise.all([
        model('Payment').findOne({ orderId: order._id }).select('status amount capturedAmountMinor refundedAmountMinor createdAt stripePaymentIntentId').lean(),
        model('Payout').findOne({ orderId: order._id }).select('status netProviderAmount createdAt transferCompletedAt stripeTransferId').lean(),
        model('Review').findOne({ orderId: order._id }).select('rating createdAt').lean(),
        model('Dispute').find({ orderId: order._id }).select('status title openedAt resolution').lean(),
      ])
    : [null, null, null, []];
  const firstBid = bids[0];
  const stages = stagesOf({ service, firstBidAt: firstBid?.createdAt, order, payment, payout, review });
  const pos = position(stages, { order });
  let prev = null;
  const steps = STAGES.map((s) => {
    const at = stages[s.key];
    const base = s.from ? stages[s.from] : prev;
    const step = { key: s.key, label: s.label, optional: Boolean(s.optional), at, afterMs: at && base ? new Date(at) - new Date(base) : null, skipped: pos.skipped.includes(s.key) };
    if (at && !s.from) prev = at;
    return step;
  });
  const detail = {
    posted: service ? `${service.title} · by ${service.userId?.name || '—'}${service.price ? ` · ${service.price} kr` : ''}` : null,
    first_bid: firstBid ? `${bids.length} bid(s) · first from ${firstBid.providerId?.name || '—'} · ${chats} chat(s)` : `no bids yet · ${chats} chat(s)`,
    accepted: order ? `${order.providerId?.name || '—'} for ${order.agreedPrice ?? '—'} kr` : null,
    paid: payment ? `${(payment.capturedAmountMinor ?? payment.amount * 100) / 100} kr captured · ${payment.status}` : null,
    paid_out: payout ? `${payout.netProviderAmount} kr · ${payout.status}${payout.stripeTransferId ? ` · ${payout.stripeTransferId}` : ''}` : null,
    reviewed: review ? `${review.rating}★` : null,
  };
  for (const s of steps) s.detail = detail[s.key] || null;
  return {
    serviceId,
    title: service?.title || null,
    serviceStatus: service?.status || null,
    orderId: order ? String(order._id) : null,
    chatId: order?.chatId ? String(order.chatId) : null,
    steps,
    ...pos,
    totalMs: stages.posted ? new Date(prev) - new Date(stages.posted) : null,
    bids: bids.map((b) => ({ provider: b.providerId?.name || '—', status: b.withdrawnAt ? 'withdrawn' : b.status, at: b.createdAt })),
    attempts: orders.filter((o) => order && String(o._id) !== String(order._id)).map((o) => ({ orderId: String(o._id), status: o.status, paymentStatus: o.paymentStatus, at: o.createdAt, reason: o.cancellationReason || null })),
    disputes: disputes.map((d) => ({ id: String(d._id), status: d.status, title: d.title, at: d.openedAt, outcome: d.resolution?.outcome || null })),
    refund: payment?.refundedAmountMinor ? payment.refundedAmountMinor / 100 : null,
  };
}

/** Funnel, step durations and stuck jobs for jobs posted in the last `days`. */
async function journeys(days = 90) {
  const since = new Date(Date.now() - days * DAY);
  const services = await model('Service').find({ createdAt: { $gte: since } }).select('title createdAt status').lean();
  const ids = services.map((s) => s._id);
  const [firstBids, orders] = await Promise.all([
    model('JobRequest').aggregate([{ $match: { serviceId: { $in: ids } } }, { $group: { _id: '$serviceId', at: { $min: '$createdAt' }, n: { $sum: 1 } } }]),
    model('Order').find({ serviceId: { $in: ids } }).sort({ createdAt: 1 }).select('serviceId status paymentStatus createdAt updatedAt paymentConfirmedAt startedAt readyForReviewAt completedAt').lean(),
  ]);
  const orderIds = orders.map((o) => o._id);
  const [payouts, reviews] = await Promise.all([
    model('Payout').find({ orderId: { $in: orderIds } }).select('orderId status createdAt transferCompletedAt').lean(),
    model('Review').find({ orderId: { $in: orderIds } }).select('orderId createdAt').lean(),
  ]);
  const FB = new Map(firstBids.map((b) => [String(b._id), b]));
  const OB = new Map();
  for (const o of orders) {
    const k = String(o.serviceId);
    const cur = OB.get(k);
    if (!cur || cur.status === 'cancelled' || o.status !== 'cancelled') OB.set(k, o);
  }
  const PO = new Map(payouts.map((p) => [String(p.orderId), p]));
  const RV = new Map(reviews.map((r) => [String(r.orderId), r]));

  const reached = Object.fromEntries(STAGES.map((s) => [s.key, 0]));
  const durations = Object.fromEntries(STAGES.slice(1).map((s) => [s.key, []]));
  const branches = { cancelled: 0, refunded: 0, disputed: 0, declined: 0 };
  const stuck = [];
  for (const s of services) {
    const order = OB.get(String(s._id));
    const st = stagesOf({ service: s, firstBidAt: FB.get(String(s._id))?.at, order, payout: order && PO.get(String(order._id)), review: order && RV.get(String(order._id)) });
    let prev = null;
    for (const stage of STAGES) {
      const at = st[stage.key];
      if (!at) continue;
      reached[stage.key] += 1;
      const base = stage.from ? st[stage.from] : prev;
      if (base && durations[stage.key]) durations[stage.key].push(new Date(at) - new Date(base));
      if (!stage.from) prev = at;
    }
    const pos = position(st, { order });
    if (pos.branch) branches[pos.branch] = (branches[pos.branch] || 0) + 1;
    if (pos.stuck) stuck.push({ serviceId: String(s._id), title: s.title, stage: pos.current, waitingMs: pos.waitingMs, orderId: order ? String(order._id) : null });
  }
  stuck.sort((a, b) => b.waitingMs - a.waitingMs);
  return {
    days,
    jobs: services.length,
    funnel: STAGES.map((s) => ({ key: s.key, label: s.label, reached: reached[s.key], share: services.length ? Math.round((reached[s.key] / services.length) * 1000) / 10 : null })),
    steps: STAGES.slice(1).map((s, i) => {
      const d = durations[s.key].sort((a, b) => a - b);
      const from = STAGES.find((x) => x.key === s.from) || STAGES[i];
      return { from: from.key, to: s.key, label: `${from.label} → ${s.label}`, count: d.length, p50: pct(d, 50), p90: pct(d, 90) };
    }),
    branches,
    stuck: stuck.slice(0, 100),
    stuckAfter: STUCK_AFTER,
  };
}

module.exports = { STAGES, STUCK_AFTER, stagesOf, position, resolveServiceId, traceJob, journeys };
