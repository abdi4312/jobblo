const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { redactSensitive } = require('../../utils/sanitizer');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const SubscriptionWebhookEventV2 = require('../../models/SubscriptionWebhookEventV2');
const StripeFinancialOperation = require('../../models/StripeFinancialOperation');
const StripeFinancialSyncState = require('../../models/StripeFinancialSyncState');
const StripePaymentIncident = require('../../models/StripePaymentIncident');
const StripeTransferRecord = require('../../models/StripeTransferRecord');
const { scanOrders } = require('../../services/monitoring/orderHealth');

/** Developer console — money reconciliation. Read-only. */

// ── 14. Reconciliation ──────────────────────────────────────────────────────
const getReconciliation = asyncHandler(async (req, res) => {
  const [orderIssueRows, payouts, ops, incidents, disputes, billingOps, subWebhooks, syncStates, reversedTransfers, lastRuns] = await Promise.all([
    scanOrders(500),
    Payout.find({ status: { $in: ['failed', 'reconciliation_required'] } }).sort({ updatedAt: -1 }).limit(100).lean(),
    StripeFinancialOperation.find({ status: { $in: ['failed', 'reconciliation_required'] } }).sort({ updatedAt: -1 }).limit(100).lean(),
    StripePaymentIncident.find({ status: 'manual_review' }).sort({ createdAt: -1 }).limit(100).lean(),
    Dispute.find({ 'resolution.moneyState': { $in: ['pending', 'failed', 'reconciliation_required'] } }).sort({ updatedAt: -1 }).limit(100).select('orderId resolution status updatedAt').lean(),
    SubscriptionBillingOperationV2.find({ status: { $in: ['failed', 'reconciliation_required'] } }).sort({ updatedAt: -1 }).limit(100).lean(),
    SubscriptionWebhookEventV2.find({ status: 'failed' }).sort({ updatedAt: -1 }).limit(100).lean(),
    StripeFinancialSyncState.find({ status: 'failed' }).lean(),
    StripeTransferRecord.find({ normalizedStatus: { $in: ['partially_reversed', 'fully_reversed'] } }).sort({ updatedAt: -1 }).limit(100).select('-audit').lean(),
    require('../../models/SchedulerRun')
      .find({ job: { $in: ['reconcileMoneyState', 'reconcileStripeFinancialHistory'] } })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const issues = [];
  const add = (category, severity, entity, id, orderId, detail, at) =>
    issues.push({ category, severity, entity, id: String(id), orderId: orderId ? String(orderId) : null, detail, at });

  for (const { order, issues: list } of orderIssueRows) {
    for (const i of list) add(i.code, i.severity, 'Order', order._id, order._id, i.detail, order.updatedAt);
  }
  for (const p of payouts) add('payout_failed', p.status === 'reconciliation_required' ? 'critical' : 'high', 'Payout', p._id, p.orderId, `${p.status}${p.failureCode ? ` · ${p.failureCode}` : ''}${p.failureReason ? ` · ${p.failureReason}` : ''}`, p.updatedAt);
  for (const o of ops) add(`${o.type}_${o.status}`, o.status === 'reconciliation_required' ? 'critical' : 'high', 'StripeFinancialOperation', o._id, o.orderId, `${o.amount} ${o.currency} øre · ${o.lastErrorCode || o.lastErrorMessage || o.operationKey}`, o.updatedAt);
  for (const i of incidents) add(`incident_${i.kind}`, i.kind === 'duplicate_payment' || i.kind === 'charge_dispute' ? 'critical' : 'high', 'StripePaymentIncident', i._id, i.orderId, i.reason || i.eventType, i.createdAt);
  for (const d of disputes) add('dispute_money_unsettled', 'high', 'Dispute', d._id, d.orderId, `${d.resolution?.outcome} · money ${d.resolution?.moneyState}${d.resolution?.moneyError ? ` · ${d.resolution.moneyError}` : ''}`, d.updatedAt);
  for (const o of billingOps) add(`subscription_${o.operationType}_${o.status}`, o.status === 'reconciliation_required' ? 'critical' : 'medium', 'SubscriptionBillingOperationV2', o._id, null, o.lastErrorCode || o.lastErrorMessage || o.lastFailureStage || o.operationId, o.updatedAt);
  for (const w of subWebhooks) add('subscription_webhook_failed', 'medium', 'SubscriptionWebhookEventV2', w._id, null, `${w.eventType} · ${w.lastErrorCode || w.lastErrorMessage || ''}`, w.lastFailureAt || w.updatedAt);
  for (const s of syncStates) add('financial_sync_failed', 'medium', 'StripeFinancialSyncState', s._id, null, `${s.objectType} · ${s.lastError || ''}`, s.updatedAt);
  for (const t of reversedTransfers) add('transfer_reversed', t.normalizedStatus === 'fully_reversed' ? 'high' : 'medium', 'StripeTransferRecord', t._id, t.orderId, `${t.normalizedStatus} · ${t.amountReversed}/${t.amount} ${t.currency} øre`, t.updatedAt);

  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity] || new Date(b.at) - new Date(a.at));
  const byCategory = {};
  const bySeverity = {};
  for (const i of issues) {
    byCategory[i.category] = (byCategory[i.category] || 0) + 1;
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  }
  return sendSuccess(res, {
    generatedAt: new Date(),
    total: issues.length,
    bySeverity,
    byCategory,
    issues: issues.slice(0, 500),
    lastRuns: lastRuns.map((r) => ({ job: r.job, startedAt: r.startedAt, ok: r.ok, durationMs: r.durationMs, error: r.error, result: redactSensitive(r.result) })),
  });
});

module.exports = { getReconciliation };
