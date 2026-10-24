const Payout = require('../../models/Payout');
const StripeEvent = require('../../models/StripeEvent');
const SubscriptionWebhookEventV2 = require('../../models/SubscriptionWebhookEventV2');
const SubscriptionRecoveryEmailV2 = require('../../models/SubscriptionRecoveryEmailV2');
const { MINUTE, HOUR, DAY, countBy, groupCount } = require('../../utils/devQuery');

/** The database-backed work queues (webhooks, payouts, recovery emails, …): backlog, stuck and failed items. Read by the Queues page and the stuck-work alert. */

const STUCK_MS = 15 * MINUTE;

// ── 8. Queues: the de-facto work queues that already exist ──────────────────
async function queueStats() {
  const now = Date.now();
  const stale = new Date(now - STUCK_MS);
  const dayAgo = new Date(now - DAY);
  const hourly = (Model, timeField, match) =>
    Model.aggregate([
      { $match: { ...match, [timeField]: { $gte: dayAgo } } },
      { $group: { _id: { $toDate: { $subtract: [{ $toLong: `$${timeField}` }, { $mod: [{ $toLong: `$${timeField}` }, HOUR] }] } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).then((r) => r.map((x) => ({ t: x._id, done: x.n })));

  const [stripe, subWebhooks, recovery, payouts] = await Promise.all([
    Promise.all([
      groupCount(StripeEvent, 'status'),
      StripeEvent.countDocuments({ status: 'processing', lastError: { $ne: null } }),
      StripeEvent.countDocuments({ status: 'processing', lastError: null, updatedAt: { $lt: stale } }),
      StripeEvent.findOne({ status: 'processing' }).sort({ createdAt: 1 }).select('createdAt').lean(),
      StripeEvent.aggregate([{ $group: { _id: '$attempts', n: { $sum: 1 } } }]).then(countBy),
      hourly(StripeEvent, 'processedAt', { status: 'processed' }),
      StripeEvent.find({ lastError: { $ne: null }, status: 'processing' }).sort({ updatedAt: -1 }).limit(10).select('eventId type attempts lastError updatedAt').lean(),
    ]),
    Promise.all([
      groupCount(SubscriptionWebhookEventV2, 'status'),
      SubscriptionWebhookEventV2.countDocuments({ status: { $in: ['received', 'failed'] }, nextAttemptAt: { $lte: new Date(now) } }),
      SubscriptionWebhookEventV2.countDocuments({ status: 'processing', updatedAt: { $lt: stale } }),
      SubscriptionWebhookEventV2.findOne({ status: { $in: ['received', 'processing'] } }).sort({ receivedAt: 1 }).select('receivedAt').lean(),
      SubscriptionWebhookEventV2.aggregate([{ $group: { _id: '$attempts', n: { $sum: 1 } } }]).then(countBy),
      hourly(SubscriptionWebhookEventV2, 'processedAt', { status: 'processed' }),
      SubscriptionWebhookEventV2.find({ status: 'failed' }).sort({ lastFailureAt: -1 }).limit(10).select('stripeEventId eventType attempts lastErrorCode lastErrorMessage lastFailureAt').lean(),
    ]),
    Promise.all([
      groupCount(SubscriptionRecoveryEmailV2, 'status'),
      SubscriptionRecoveryEmailV2.countDocuments({ status: 'pending', scheduledAt: { $lte: new Date(now) } }),
      SubscriptionRecoveryEmailV2.countDocuments({ status: 'sending', claimedAt: { $lt: stale } }),
      SubscriptionRecoveryEmailV2.findOne({ status: 'pending', scheduledAt: { $lte: new Date(now) } }).sort({ scheduledAt: 1 }).select('scheduledAt').lean(),
      SubscriptionRecoveryEmailV2.aggregate([{ $group: { _id: '$attempts', n: { $sum: 1 } } }]).then(countBy),
      hourly(SubscriptionRecoveryEmailV2, 'sentAt', { status: 'sent' }),
      SubscriptionRecoveryEmailV2.find({ attempts: { $gt: 0 }, status: { $ne: 'sent' } }).sort({ updatedAt: -1 }).limit(10).select('kind status attempts nextAttemptAt invoiceId').lean(),
    ]),
    Promise.all([
      groupCount(Payout, 'status'),
      Payout.countDocuments({ status: 'failed' }),
      Payout.countDocuments({ status: 'processing', lastAttemptedAt: { $lt: stale } }),
      Payout.findOne({ status: { $in: ['pending', 'released_internal', 'failed'] } }).sort({ createdAt: 1 }).select('createdAt').lean(),
      Payout.aggregate([{ $group: { _id: '$retryCount', n: { $sum: 1 } } }]).then(countBy),
      hourly(Payout, 'transferCompletedAt', { status: 'transferred' }),
      Payout.find({ status: { $in: ['failed', 'reconciliation_required'] } }).sort({ updatedAt: -1 }).limit(10).select('orderId status retryCount failureCode failureReason updatedAt').lean(),
    ]),
  ]);

  // [counts, backlog, stuck, oldest, attempts, throughput, recentFailures] per queue.
  const shape = (meta, [counts, backlog, stuck, oldest, attempts, throughput, recentFailures], failed, deadLetter, oldestField) => ({
    ...meta,
    counts,
    backlog,
    stuck,
    failed,
    deadLetter,
    oldestPendingAt: oldest?.[oldestField] || null,
    attempts,
    throughput,
    recentFailures,
  });
  const [sCounts, sFailed] = stripe;

  return [
    shape(
      { key: 'stripe_webhooks', name: 'Stripe webhook events', worker: 'Webhook handler (inline)', retryPolicy: 'Stripe retries non-2xx deliveries for up to 3 days with backoff', duplicatePrevention: 'StripeEvent claim → process → mark processed; replays return early' },
      [sCounts, sCounts.processing || 0, ...stripe.slice(2)],
      sFailed,
      null,
      'createdAt'
    ),
    shape(
      { key: 'subscription_webhooks', name: 'Subscription webhook events', worker: 'v2 webhook processor', retryPolicy: 'nextAttemptAt backoff; failed events are retried by the processor', duplicatePrevention: 'Unique (stripeMode, stripeEventId)' },
      subWebhooks,
      subWebhooks[0].failed || 0,
      subWebhooks[0].failed || 0,
      'receivedAt'
    ),
    shape(
      { key: 'recovery_emails', name: 'Subscription recovery emails', worker: 'Scheduler: dispatchSubscriptionRecoveryEmails (5 min)', retryPolicy: 'attempts + nextAttemptAt; claim lease while sending', duplicatePrevention: 'Claim via status pending → sending' },
      recovery,
      0,
      null,
      'scheduledAt'
    ),
    shape(
      { key: 'payouts', name: 'Provider payouts', worker: 'Scheduler: retryFailedPayouts (2 h)', retryPolicy: 'Failed payouts retried, then reconciliation_required', duplicatePrevention: 'Unique orderId + idempotencyKey; payout lock lease' },
      payouts,
      payouts[0].failed || 0,
      payouts[0].reconciliation_required || 0,
      'createdAt'
    ),
  ];
}

/** Stuck work across all queues — used by alerting. */
const stuckCount = async () => (await queueStats()).reduce((a, q) => a + q.stuck, 0);

module.exports = { STUCK_MS, queueStats, stuckCount };
