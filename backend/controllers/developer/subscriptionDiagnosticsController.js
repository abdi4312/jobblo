const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const SubscriptionWebhookEventV2 = require('../../models/SubscriptionWebhookEventV2');
const { DAY, isId, pageParams, pagination } = require('../../utils/devQuery');
const { groupCount } = require('../../utils/devQuery');

/** Developer console — subscription diagnostics. Read-only. */

// ── 12. Subscriptions ───────────────────────────────────────────────────────
const getSubscriptions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const match = {};
  if (req.query.status) match.status = req.query.status;
  if (req.query.recovery) match.paymentRecoveryStatus = req.query.recovery;
  if (req.query.mode) match.stripeMode = req.query.mode;
  if (req.query.pendingChange === 'true') match['pendingPlanChange.operationId'] = { $exists: true };
  const q = String(req.query.q || '').trim();
  if (q) match.$or = isId(q) ? [{ _id: q }, { userId: q }] : [{ stripeSubscriptionId: q }, { stripeCustomerId: q }];

  const soon = new Date(Date.now() + 7 * DAY);
  const [rows, total, byStatus, byRecovery, byPlan, pendingChanges, autoRenewOff, renewingSoon, opsByStatus, opsByType, problemOps, webhookByStatus, failedWebhooks] = await Promise.all([
    SubscriptionV2.find(match)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('planId', 'name type price')
      .select('-withdrawalEvidence')
      .lean(),
    SubscriptionV2.countDocuments(match),
    groupCount(SubscriptionV2, 'status'),
    groupCount(SubscriptionV2, 'paymentRecoveryStatus'),
    SubscriptionV2.aggregate([
      { $match: { status: { $in: ['active', 'past_due', 'canceling'] } } },
      { $group: { _id: '$planId', n: { $sum: 1 } } },
      { $lookup: { from: SubscriptionPlan.collection.name, localField: '_id', foreignField: '_id', as: 'plan' } },
      { $project: { n: 1, name: { $first: '$plan.name' }, type: { $first: '$plan.type' }, price: { $first: '$plan.price' } } },
      { $sort: { n: -1 } },
    ]),
    SubscriptionV2.countDocuments({ 'pendingPlanChange.operationId': { $exists: true } }),
    SubscriptionV2.countDocuments({ autoRenew: false, status: { $in: ['active', 'canceling'] } }),
    SubscriptionV2.countDocuments({ status: 'active', nextRenewalAt: { $lte: soon, $gte: new Date() } }),
    groupCount(SubscriptionBillingOperationV2, 'status'),
    groupCount(SubscriptionBillingOperationV2, 'operationType'),
    SubscriptionBillingOperationV2.find({ status: { $in: ['failed', 'reconciliation_required'] } })
      .sort({ updatedAt: -1 })
      .limit(30)
      .populate('userId', 'name')
      .select('operationId operationType status stripeMode userId lastErrorCode lastErrorMessage lastFailureStage attempts updatedAt stripeSubscriptionId stripeInvoiceId')
      .lean(),
    groupCount(SubscriptionWebhookEventV2, 'status'),
    SubscriptionWebhookEventV2.find({ status: 'failed' }).sort({ lastFailureAt: -1 }).limit(20).lean(),
  ]);

  return sendSuccess(
    res,
    {
      summary: { byStatus, byRecovery, byPlan, pendingChanges, autoRenewOff, renewingSoon },
      operations: { byStatus: opsByStatus, byType: opsByType, problems: problemOps },
      webhooks: { byStatus: webhookByStatus, failed: failedWebhooks },
      subscriptions: rows,
    },
    'Subscriptions retrieved.',
    pagination(page, limit, total)
  );
});

const getSubscription = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const sub = await SubscriptionV2.findById(req.params.id)
    .populate('userId', 'name email role')
    .populate('planId pendingPlanChange.targetPlanId', 'name type price')
    .select('-withdrawalEvidence')
    .lean();
  if (!sub) return sendError(res, 'Subscription not found.', 404);
  const operations = await SubscriptionBillingOperationV2.find({ $or: [{ subscriptionId: sub._id }, { userId: sub.userId?._id }] })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('targetPlanId', 'name')
    .lean();
  // Duplicate-operation check: more than one non-failed op of the same type+invoice.
  const seen = {};
  for (const op of operations) {
    const key = `${op.operationType}:${op.stripeInvoiceId || op.stripeCheckoutSessionId || ''}`;
    if (op.status !== 'failed' && (op.stripeInvoiceId || op.stripeCheckoutSessionId)) seen[key] = (seen[key] || 0) + 1;
  }
  return sendSuccess(res, {
    subscription: sub,
    operations,
    duplicates: Object.entries(seen).filter(([, n]) => n > 1).map(([key, n]) => ({ key, count: n })),
  });
});

module.exports = { getSubscriptions, getSubscription };
