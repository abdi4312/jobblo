/**
 * Financial ledger inspector. Rebuilds a per-order ledger in øre and checks it balances:
 *
 *     charged  =  refunded  +  paid out to provider  +  kept by platform  +  held in escrow
 *
 *   charged     Payment.capturedAmountMinor (what Stripe captured), else Order.checkoutAmountMinor
 *   refunded    succeeded refund operations (StripeFinancialOperation), cross-checked
 *               against Payment.refundedAmountMinor
 *   paid out    Stripe transfers (StripeTransferRecord amount − amountReversed), cross-checked
 *               against Payout.netProviderAmount
 *   kept        customer fee (charged − agreed price) + provider fee (Payout.platformFee)
 *   held        what is left: must be 0 once an order is completed or cancelled
 *
 * Read-only. Amounts on Order/Payment/Payout are NOK (major units), everything else øre.
 */

const DAY = 24 * 60 * 60 * 1000;
const model = (name) => require(`../../models/${name}`);
const TERMINAL = ['completed', 'cancelled', 'declined'];
const ore = (nok) => (nok === null || nok === undefined ? null : Math.round(Number(nok) * 100));
const TOLERANCE = 1; // øre — rounding

/** Pure: one order's ledger and its discrepancies. Unit-tested. */
function buildLedger({ order, payment, payout, transfers = [], refundOps = [] }) {
  const agreed = ore(order.agreedPrice) ?? 0;
  const charged = payment?.capturedAmountMinor ?? (['paid', 'partially_refunded', 'refunded'].includes(order.paymentStatus) ? order.checkoutAmountMinor ?? ore(payment?.amount) : 0) ?? 0;
  const refundOpsTotal = refundOps.filter((o) => o.type === 'refund' && o.status === 'succeeded').reduce((a, o) => a + o.amount, 0);
  const refundedField = payment?.refundedAmountMinor ?? 0;
  const refunded = Math.max(refundOpsTotal, refundedField);
  const transferred = transfers.reduce((a, t) => a + (t.amount || 0) - (t.amountReversed || 0), 0);
  const payoutSettled = payout && ['released_internal', 'processing', 'transferred'].includes(payout.status);
  const paidOut = transfers.length ? transferred : payoutSettled ? ore(payout.netProviderAmount) : 0;
  const customerFee = charged ? Math.max(0, charged - agreed) : 0;
  const providerFee = payoutSettled ? ore(payout.platformFee) : 0;
  const fullyRefunded = refunded >= charged && charged > 0;
  // Fees become revenue only when the order is settled (completed/cancelled) and not fully
  // refunded; until then the whole charge is escrow — a cancellation would refund the fee too.
  const settled = TERMINAL.includes(order.status);
  const earns = settled && !fullyRefunded;
  const kept = earns ? Math.max(0, Math.min(charged - refunded - paidOut, customerFee + providerFee)) : 0;
  const held = charged - refunded - paidOut - kept;

  const issues = [];
  const add = (code, severity, detail) => issues.push({ code, severity, detail });
  const kr = (v) => `${(v / 100).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

  if (refunded + paidOut > charged + TOLERANCE) add('overdisbursed', 'critical', `Refunded ${kr(refunded)} + paid out ${kr(paidOut)} exceeds the ${kr(charged)} charged`);
  if (TERMINAL.includes(order.status) && held > TOLERANCE) add('held_on_closed_order', 'critical', `${kr(held)} still held although the order is ${order.status}`);
  if (refundOps.length && Math.abs(refundOpsTotal - refundedField) > TOLERANCE) add('refund_records_disagree', 'high', `Refund operations total ${kr(refundOpsTotal)} but Payment says ${kr(refundedField)}`);
  if (payout && transfers.length && Math.abs(transferred - ore(payout.netProviderAmount)) > TOLERANCE) add('transfer_amount_mismatch', 'high', `Stripe transferred ${kr(transferred)} but the payout record says ${kr(ore(payout.netProviderAmount))}`);
  if (payout?.status === 'transferred' && !transfers.length) add('transfer_not_recorded', 'medium', 'Payout marked transferred but no Stripe transfer record is synced');
  if (payout && Math.abs(ore(payout.grossAmount) - ore(payout.platformFee) - ore(payout.taxAmount || 0) - ore(payout.netProviderAmount)) > TOLERANCE) add('payout_arithmetic', 'high', `Payout gross − fee − tax ≠ net (${payout.grossAmount} − ${payout.platformFee} − ${payout.taxAmount || 0} ≠ ${payout.netProviderAmount})`);
  if (payout && Math.abs(ore(payout.grossAmount) - agreed) > TOLERANCE) add('payout_gross_mismatch', 'medium', `Payout gross ${kr(ore(payout.grossAmount))} ≠ agreed price ${kr(agreed)}`);
  if (payment?.capturedAmountMinor && order.checkoutAmountMinor && Math.abs(payment.capturedAmountMinor - order.checkoutAmountMinor) > TOLERANCE) add('capture_mismatch', 'high', `Captured ${kr(payment.capturedAmountMinor)} but checkout was ${kr(order.checkoutAmountMinor)}`);
  if (charged && charged < agreed) add('charged_below_price', 'high', `Charged ${kr(charged)} is less than the agreed price ${kr(agreed)}`);

  return {
    orderId: String(order._id),
    status: order.status,
    paymentStatus: order.paymentStatus,
    agreed,
    charged,
    refunded,
    paidOut,
    customerFee: earns ? customerFee : 0,
    providerFee: earns ? providerFee : 0,
    kept,
    held,
    issues,
  };
}

const byOrder = (rows, key = 'orderId') => {
  const m = new Map();
  for (const r of rows) {
    const k = String(r[key]);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};

async function loadLedgers(match) {
  const orders = await model('Order').find(match).select('status paymentStatus agreedPrice checkoutAmountMinor createdAt completedAt serviceId customerId providerId').populate('serviceId', 'title').lean();
  const ids = orders.map((o) => o._id);
  const [payments, payouts, transfers, ops] = await Promise.all([
    model('Payment').find({ orderId: { $in: ids } }).select('orderId amount capturedAmountMinor refundedAmountMinor status refundStatus').lean(),
    model('Payout').find({ orderId: { $in: ids } }).select('orderId status grossAmount platformFee taxAmount netProviderAmount').lean(),
    model('StripeTransferRecord').find({ orderId: { $in: ids } }).select('orderId amount amountReversed normalizedStatus currency').lean(),
    model('StripeFinancialOperation').find({ orderId: { $in: ids } }).select('orderId type status amount').lean(),
  ]);
  const P = byOrder(payments);
  const PO = byOrder(payouts);
  const T = byOrder(transfers);
  const O = byOrder(ops);
  return orders.map((order) => {
    const k = String(order._id);
    // Duplicate Payment rows exist on some orders (Data Integrity); the ledger uses the first and says so.
    const pays = P.get(k) || [];
    const l = buildLedger({ order, payment: pays[0], payout: (PO.get(k) || [])[0], transfers: T.get(k) || [], refundOps: O.get(k) || [] });
    if (pays.length > 1) l.issues.push({ code: 'duplicate_payment_rows', severity: 'high', detail: `${pays.length} Payment records for one order` });
    return { ...l, title: order.serviceId?.title || null, createdAt: order.createdAt };
  });
}

/** Month (or all-time) totals, escrow liability and every discrepancy. */
async function inspect({ month } = {}) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || '');
  const range = m ? { $gte: new Date(Date.UTC(+m[1], +m[2] - 1, 1)), $lt: new Date(Date.UTC(+m[1], +m[2], 1)) } : null;
  const paid = { paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } };
  const [ledgers, liability] = await Promise.all([
    loadLedgers({ ...paid, ...(range ? { createdAt: range } : {}) }),
    // Escrow liability is a balance: all open orders regardless of month.
    loadLedgers({ ...paid, status: { $nin: TERMINAL } }),
  ]);
  const sum = (k) => ledgers.reduce((a, l) => a + l[k], 0);
  const issues = ledgers.flatMap((l) => l.issues.map((i) => ({ ...i, orderId: l.orderId, title: l.title, status: l.status, at: l.createdAt })));
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity] || new Date(b.at) - new Date(a.at));
  const totals = { charged: sum('charged'), refunded: sum('refunded'), paidOut: sum('paidOut'), customerFees: sum('customerFee'), providerFees: sum('providerFee'), kept: sum('kept'), held: sum('held') };
  return {
    generatedAt: new Date(),
    period: month || 'all',
    orders: ledgers.length,
    totals,
    balanced: Math.abs(totals.charged - totals.refunded - totals.paidOut - totals.kept - totals.held) <= ledgers.length * TOLERANCE,
    escrow: { orders: liability.length, held: liability.reduce((a, l) => a + l.held, 0), oldestDays: liability.length ? Math.round((Date.now() - Math.min(...liability.map((l) => new Date(l.createdAt).getTime()))) / DAY) : 0 },
    issues: issues.slice(0, 300),
    issueCounts: issues.reduce((a, i) => ({ ...a, [i.code]: (a[i.code] || 0) + 1 }), {}),
    ledgers: ledgers.sort((a, b) => b.issues.length - a.issues.length || new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200),
  };
}

/** One order as journal entries with a running escrow balance. */
async function orderJournal(orderId) {
  const [l] = await loadLedgers({ _id: orderId });
  if (!l) return null;
  const [payment, payout, transfers, ops] = await Promise.all([
    model('Payment').findOne({ orderId }).select('createdAt capturedAmountMinor amount stripePaymentIntentId').lean(),
    model('Payout').findOne({ orderId }).select('createdAt transferCompletedAt platformFee netProviderAmount status').lean(),
    model('StripeTransferRecord').find({ orderId }).select('stripeObjectId amount amountReversed stripeCreatedAt createdAt').lean(),
    model('StripeFinancialOperation').find({ orderId, status: 'succeeded' }).select('type amount completedAt createdAt stripeObjectId').lean(),
  ]);
  const entries = [];
  const push = (at, label, amount, ref) => entries.push({ at, label, amount, ref: ref || null });
  if (l.charged) push(payment?.createdAt || null, 'Customer charged', l.charged, payment?.stripePaymentIntentId);
  for (const o of ops.filter((x) => x.type === 'refund')) push(o.completedAt || o.createdAt, 'Refund to customer', -o.amount, o.stripeObjectId);
  if (!ops.some((x) => x.type === 'refund') && l.refunded) push(null, 'Refund to customer (from Payment record)', -l.refunded);
  for (const t of transfers) {
    push(t.stripeCreatedAt || t.createdAt, 'Transfer to provider', -t.amount, t.stripeObjectId);
    if (t.amountReversed) push(null, 'Transfer reversed', t.amountReversed, t.stripeObjectId);
  }
  if (!transfers.length && l.paidOut) push(payout?.transferCompletedAt || payout?.createdAt, 'Payout to provider (no Stripe record)', -l.paidOut);
  if (l.kept) push(payout?.createdAt || null, `Platform fees kept (customer ${l.customerFee / 100} + provider ${l.providerFee / 100} kr)`, -l.kept);
  entries.sort((a, b) => (a.at ? new Date(a.at) : Infinity) - (b.at ? new Date(b.at) : Infinity));
  let balance = 0;
  for (const e of entries) e.balance = balance += e.amount;
  return { ...l, entries };
}

module.exports = { buildLedger, inspect, orderJournal };
