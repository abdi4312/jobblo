const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { ORDER_TRANSITIONS, TERMINAL_STATUSES } = require('../../services/order/orderState');
const { orderIssues, loadOrderBundle, buildTimeline } = require('./diagnosticsController');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const SafePayHistory = require('../../models/SafePayHistory');

/**
 * Developer dashboard — SafePay state machine inspector. Read-only.
 *
 * The order state machine is ORDER_TRANSITIONS (services/order/orderState.js), the one
 * table the code enforces. This view checks what actually happened against it:
 *   - each order's path, rebuilt from order.history, step by step
 *   - status changes with no history entry (written by a path that skipped transitionOrder)
 *   - whether Payment / SafePayHistory / Payout agree with the order's status
 */

/** History action → the order status it leaves the order in (when data.to is absent). */
const ACTION_TO = {
  payment_confirmed: 'paid',
  job_started: 'in_progress',
  ready_for_review: 'ready_for_review',
  work_approved: 'completed',
  auto_released: 'completed',
  auto_cancelled: 'cancelled',
  admin_cancelled: 'cancelled',
  provider_connect_timeout_refund_started: 'cancelled',
  provider_connect_timeout_refunded: 'cancelled',
  provider_no_start_refunded: 'cancelled',
  dispute_opened: 'disputed',
  safepay_dispute_opened: 'disputed',
};

const ANY = undefined; // the model may be in any state
/**
 * What the companion records may look like for each order status. `null` = no record yet;
 * a missing paid record is reported by orderIssues, so it is tolerated here. Derived from
 * the writers (SafePayCheckoutController, providerWorkController, releasePayoutToProvider,
 * providerConnectTimeout, safePayStateService) and the states observed in the data.
 */
const PRE_PAYMENT = { payment: [null, 'pending'], safePay: [null, 'pending'], payout: [null] };
const OPEN_PAYOUT = [null, 'pending', 'failed', 'reconciliation_required'];
const COMPANIONS = {
  pending: PRE_PAYMENT,
  accepted: PRE_PAYMENT,
  declined: PRE_PAYMENT,
  awaiting_payment: PRE_PAYMENT,
  paid: { payment: [null, 'completed'], safePay: [null, 'pending', 'payment_received', 'waiting_connect'], payout: [null] },
  in_progress: { payment: [null, 'completed'], safePay: [null, 'payment_received', 'in_progress'], payout: [null] },
  ready_for_review: { payment: [null, 'completed'], safePay: [null, 'payment_received', 'in_progress'], payout: OPEN_PAYOUT },
  completed: { payment: [null, 'completed', 'released'], safePay: [null, 'completed'], payout: [...OPEN_PAYOUT, 'released_internal', 'processing', 'transferred'] },
  disputed: { payment: [null, 'completed', 'disputed'], safePay: [null, 'disputed'], payout: ANY },
  cancelled: { payment: [null, 'pending', 'refunded', 'partially_refunded'], safePay: [null, 'cancelled', 'automatically_cancelled', 'refunded', 'refund_pending', 'refund_failed'], payout: [null, 'cancelled'] },
};

/** Pure: rebuild the order's status path from its history. Unit-tested. */
function reconstructPath(order) {
  const steps = [];
  let prev = null;
  for (const h of order.history || []) {
    const to = h.data?.to || ACTION_TO[h.action];
    if (!to) continue;
    const from = h.data?.from || prev;
    if (from === to) continue; // idempotent re-write
    const legal = from ? (ORDER_TRANSITIONS[from] || []).includes(to) : null;
    steps.push({ at: h.timestamp || null, action: h.action, from, to, legal });
    prev = to;
  }
  return { steps, recordedStatus: prev };
}

/** Pure: state-machine findings for one order. Unit-tested. */
function machineIssues(order, { payment, sph, payout } = {}, path = reconstructPath(order)) {
  const issues = [];
  const add = (code, severity, detail) => issues.push({ code, severity, detail });
  if (!ORDER_TRANSITIONS[order.status]) add('unknown_status', 'critical', `Order status "${order.status}" is not in the state machine`);
  for (const s of path.steps.filter((x) => x.legal === false)) add('illegal_transition', 'high', `${s.from} → ${s.to} (${s.action}) is not an allowed transition`);
  if (path.recordedStatus && path.recordedStatus !== order.status) {
    add('unrecorded_transition', 'medium', `Status is ${order.status} but history ends at ${path.recordedStatus} — changed without a history entry`);
  }
  const expect = COMPANIONS[order.status];
  if (expect) {
    const check = (model, actual, allowed) => {
      if (allowed === ANY || allowed.includes(actual ?? null)) return;
      add(`${model}_state_mismatch`, model === 'payment' ? 'high' : 'medium', `${model === 'safePay' ? 'SafePay history' : model[0].toUpperCase() + model.slice(1)} is ${actual} while the order is ${order.status} (expected ${allowed.map((a) => a ?? 'none').join(' / ')})`);
    };
    check('payment', payment?.status, expect.payment);
    check('safePay', sph?.status, expect.safePay);
    check('payout', payout?.status, expect.payout);
  }
  return issues;
}

const byOrder = (rows) => Object.fromEntries(rows.map((r) => [String(r.orderId), r]));
// ponytail: inspects the newest SCAN orders; enough for current volume, page through by date when it is not.
const SCAN = 2000;

/** The machine, how orders move through it, and every order that broke it. */
const getMachine = asyncHandler(async (req, res) => {
  const [orders, counts] = await Promise.all([
    Order.find().sort({ updatedAt: -1 }).limit(SCAN).select('status paymentStatus history updatedAt serviceId agreedPrice').populate('serviceId', 'title').lean(),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const ids = orders.map((o) => o._id);
  const [payments, sphs, payouts] = await Promise.all([
    Payment.find({ orderId: { $in: ids } }).select('orderId status').lean(),
    SafePayHistory.find({ orderId: { $in: ids } }).sort({ createdAt: 1 }).select('orderId status').lean(), // newest wins in byOrder
    Payout.find({ orderId: { $in: ids } }).select('orderId status').lean(),
  ]);
  const P = byOrder(payments);
  const S = byOrder(sphs);
  const PO = byOrder(payouts);

  const edges = {};
  const violations = [];
  for (const o of orders) {
    const k = String(o._id);
    const path = reconstructPath(o);
    for (const s of path.steps) {
      if (!s.from) continue;
      const key = `${s.from}>${s.to}`;
      edges[key] ||= { from: s.from, to: s.to, n: 0, legal: s.legal };
      edges[key].n += 1;
    }
    for (const i of machineIssues(o, { payment: P[k], sph: S[k], payout: PO[k] }, path)) {
      violations.push({ ...i, orderId: k, title: o.serviceId?.title || null, status: o.status, at: o.updatedAt });
    }
  }
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  violations.sort((a, b) => rank[a.severity] - rank[b.severity] || new Date(b.at) - new Date(a.at));
  const byCode = {};
  for (const v of violations) byCode[v.code] = (byCode[v.code] || 0) + 1;

  return sendSuccess(res, {
    states: Object.keys(ORDER_TRANSITIONS).map((s) => ({ status: s, count: counts.find((c) => c._id === s)?.n || 0, terminal: TERMINAL_STATUSES.includes(s) || !ORDER_TRANSITIONS[s].length, next: ORDER_TRANSITIONS[s] })),
    unknownStates: counts.filter((c) => !ORDER_TRANSITIONS[c._id]).map((c) => ({ status: c._id, count: c.n })),
    edges: Object.values(edges),
    companions: COMPANIONS,
    scanned: orders.length,
    scanLimit: SCAN,
    affectedOrders: new Set(violations.map((v) => v.orderId)).size,
    byCode,
    violations: violations.slice(0, 500),
  });
});

/** One order walked through the machine. */
const getOrderMachine = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const [b, history] = await Promise.all([loadOrderBundle(req.params.id), Order.findById(req.params.id).select('history status').lean()]);
  if (!b) return sendError(res, 'Order not found.', 404);
  const order = { ...b.order, history: history.history };
  const path = reconstructPath(order);
  const expect = COMPANIONS[order.status] || null;
  return sendSuccess(res, {
    order: { _id: String(order._id), title: order.serviceId?.title || null, status: order.status, paymentStatus: order.paymentStatus, agreedPrice: order.agreedPrice, createdAt: order.createdAt, updatedAt: order.updatedAt },
    path: path.steps,
    next: ORDER_TRANSITIONS[order.status] || [],
    companions: [
      { model: 'Payment', actual: b.payment?.status ?? null, expected: expect?.payment ?? null },
      { model: 'SafePay history', actual: b.sph?.status ?? null, expected: expect?.safePay ?? null },
      { model: 'Payout', actual: b.payout?.status ?? null, expected: expect?.payout ?? null },
      { model: 'Dispute', actual: b.dispute?.status ?? null, expected: null },
    ],
    issues: [...machineIssues(order, b, path), ...orderIssues(b.order, b)],
    timeline: buildTimeline(b),
  });
});

module.exports = { ACTION_TO, COMPANIONS, reconstructPath, machineIssues, getMachine, getOrderMachine };
