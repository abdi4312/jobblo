const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const jobs = require('../../services/scheduler/jobs');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const SafePayHistory = require('../../models/SafePayHistory');
const StripeFinancialOperation = require('../../models/StripeFinancialOperation');
const StripePaymentIncident = require('../../models/StripePaymentIncident');
const { parseRange, isId, pageParams, pagination } = require('../../utils/devQuery');
const { scanOrders } = require('../../services/monitoring/orderHealth');
const { groupCount } = require('../../utils/devQuery');

/** Developer console — Stripe payments and SafePay escrow diagnostics. Read-only. */

// ── 10. Stripe payments ─────────────────────────────────────────────────────
const getPayments = asyncHandler(async (req, res) => {
  const { from, to } = parseRange({ range: req.query.range || '30d', ...req.query });
  const { page, limit, skip } = pageParams(req.query);
  const match = { createdAt: { $gte: from, $lte: to } };
  if (req.query.status) match.status = req.query.status;
  if (req.query.refund) match.refundStatus = req.query.refund;
  if (req.query.mode === 'live') match.stripeLivemode = true;
  if (req.query.mode === 'test') match.stripeLivemode = false;

  const q = String(req.query.q || '').trim();
  if (q) {
    // Search by payment / order / user id, or a Stripe id.
    const or = [{ stripePaymentIntentId: q }, { stripeSessionId: q }, { stripeRefundId: q }];
    if (isId(q)) {
      const orders = await Order.find({ $or: [{ _id: q }, { customerId: q }, { providerId: q }] }).select('_id').limit(200).lean();
      or.push({ _id: q }, { orderId: { $in: orders.map((o) => o._id) } });
    }
    match.$or = or;
    delete match.createdAt;
  }

  const base = { createdAt: { $gte: from, $lte: to } };
  const [rows, total, byStatus, byRefund, byMode, amounts, incidents, failedOps] = await Promise.all([
    Payment.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'orderId', select: 'status paymentStatus customerId providerId agreedPrice', populate: { path: 'customerId providerId', select: 'name' } })
      .lean(),
    Payment.countDocuments(match),
    groupCount(Payment, 'status', base),
    groupCount(Payment, 'refundStatus', base),
    groupCount(Payment, 'stripeLivemode', base),
    Payment.aggregate([
      { $match: base },
      { $group: { _id: null, gross: { $sum: '$amount' }, refundedMinor: { $sum: '$refundedAmountMinor' }, n: { $sum: 1 } } },
    ]),
    StripePaymentIncident.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { kind: '$kind', status: '$status' }, n: { $sum: 1 } } },
    ]),
    StripeFinancialOperation.find({ status: { $in: ['failed', 'reconciliation_required'] } })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('operationKey type status orderId stripeMode amount currency lastErrorCode lastErrorMessage failedAt updatedAt')
      .lean(),
  ]);

  return sendSuccess(
    res,
    {
      range: { from, to },
      summary: {
        byStatus,
        byRefund,
        mode: { live: byMode.true || 0, test: byMode.false || 0, unknown: byMode.none || 0 },
        gross: amounts[0]?.gross || 0,
        refunded: (amounts[0]?.refundedMinor || 0) / 100,
        count: amounts[0]?.n || 0,
      },
      incidents: incidents.map((i) => ({ ...i._id, count: i.n })),
      failedOperations: failedOps,
      payments: rows,
    },
    'Payments retrieved.',
    pagination(page, limit, total)
  );
});

// ── 11. SafePay ─────────────────────────────────────────────────────────────
const getSafePay = asyncHandler(async (req, res) => {
  const { from, to } = parseRange({ range: req.query.range || '30d', ...req.query });
  const { page, limit, skip } = pageParams(req.query);
  const match = { createdAt: { $gte: from, $lte: to } };
  if (req.query.status) match.status = req.query.status;

  const [rows, total, byStatus, byRefund, amounts, stuck, timeoutStates] = await Promise.all([
    SafePayHistory.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customerId providerId', 'name')
      .select('-ratings -reviewComment -paymentMethodLast4')
      .lean(),
    SafePayHistory.countDocuments(match),
    groupCount(SafePayHistory, 'status', { createdAt: { $gte: from, $lte: to } }),
    groupCount(SafePayHistory, 'refundStatus', { createdAt: { $gte: from, $lte: to } }),
    SafePayHistory.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          customer: { $sum: '$amounts.totalCustomer' },
          provider: { $sum: '$amounts.netProvider' },
          fee: { $sum: '$amounts.fee' },
          tax: { $sum: '$amounts.tax' },
          refundedMinor: { $sum: '$refundedAmountMinor' },
        },
      },
    ]),
    scanOrders(),
    groupCount(Order, 'providerConnectTimeout.status', { 'providerConnectTimeout.status': { $ne: null } }),
  ]);

  return sendSuccess(
    res,
    {
      range: { from, to },
      summary: { byStatus, byRefund, timeoutStates, amounts: amounts[0] ? { ...amounts[0], _id: undefined, refunded: amounts[0].refundedMinor / 100 } : null },
      stuck: stuck.slice(0, 100).map(({ order, issues }) => ({
        orderId: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
        issues,
      })),
      rules: { autoReleaseDays: jobs.config().autoReleaseDays, abandonedOrderHours: jobs.config().abandonedOrderHours },
      records: rows,
    },
    'SafePay retrieved.',
    pagination(page, limit, total)
  );
});

module.exports = { getPayments, getSafePay };
