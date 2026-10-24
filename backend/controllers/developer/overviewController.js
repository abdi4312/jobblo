const os = require('os');
const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { liveSnapshot } = require('../../middleware/requestMetrics');
const { getStripeWebhookReadiness } = require('../../services/stripe/webhookReadiness');
const scheduler = require('../../services/scheduler');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Service = require('../../models/Service');
const Session = require('../../models/Session');
const ErrorLog = require('../../models/ErrorLog');
const AdminActivity = require('../../models/AdminActivity');
const StripeEvent = require('../../models/StripeEvent');
const SafePayHistory = require('../../models/SafePayHistory');
const ApiMetricMinute = require('../../models/ApiMetricMinute');
const { DAY, parseRange, bucketExpr } = require('../../utils/devQuery');
const { mongoPing, cpuPercent, diskUsage } = require('../../services/monitoring/system');
const { apiTotals, schedulerSummary } = require('../../services/monitoring/summaries');

/** Developer console — overview (health score, traffic, errors, integrations at a glance). Read-only unless noted; no exec, no arbitrary queries, no secrets. */

// ── 1. Overview ─────────────────────────────────────────────────────────────
const getOverview = asyncHandler(async (req, res) => {
  const { from, to, bucketMs } = parseRange(req.query);
  const dayAgo = new Date(Date.now() - DAY);

  const [
    totalUsers,
    newUsers,
    activeUsers,
    totalJobs,
    orderStatus,
    activeSessions,
    api,
    openCritical,
    errorsInRange,
    webhookFailed,
    webhookPending,
    safePayTotal,
    jobs,
    recentActivity,
    ping,
    webhook,
    trafficSeries,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }),
    User.countDocuments({ createdAt: { $gte: from, $lte: to } }),
    User.countDocuments({ lastLogin: { $gte: from } }),
    Service.countDocuments(),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Session.countDocuments({ lastUsed: { $gte: new Date(Date.now() - 15 * 60 * 1000) } }),
    apiTotals(from, to),
    ErrorLog.countDocuments({ severity: 'critical', status: { $in: ['open', 'investigating', 'reopened'] } }),
    ErrorLog.countDocuments({ createdAt: { $gte: from, $lte: to } }),
    StripeEvent.countDocuments({ lastError: { $ne: null }, status: 'processing' }),
    StripeEvent.countDocuments({ status: 'processing' }),
    SafePayHistory.countDocuments(),
    schedulerSummary(dayAgo),
    AdminActivity.find({ type: 'audit' })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('adminId', 'name role')
      .select('action description createdAt adminId')
      .lean(),
    mongoPing(),
    getStripeWebhookReadiness().catch(() => ({ status: 'configuration_unavailable' })),
    ApiMetricMinute.aggregate([
      { $match: { minute: { $gte: from, $lte: to } } },
      { $group: { _id: bucketExpr('$minute', bucketMs), requests: { $sum: '$count' }, errors: { $sum: '$failed' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const orders = Object.fromEntries(orderStatus.map((o) => [o._id || 'unknown', o.n]));
  const sumOf = (...keys) => keys.reduce((s, k) => s + (orders[k] || 0), 0);
  const failedJobs = jobs.filter((j) => j.status === 'failing' || j.status === 'missed').length;
  const mem = { total: os.totalmem(), free: os.freemem() };

  // Simple, explainable health score: start at 100 and subtract per problem.
  const deductions = [];
  if (!ping.ok) deductions.push({ reason: 'MongoDB unreachable', points: 40 });
  if (webhook.status !== 'healthy') deductions.push({ reason: `Stripe webhook: ${webhook.status}`, points: 15 });
  if (openCritical) deductions.push({ reason: `${openCritical} open critical errors`, points: Math.min(20, openCritical * 5) });
  if (api.successRate !== null && api.successRate < 99) deductions.push({ reason: `API success ${api.successRate}%`, points: Math.min(20, Math.round((99 - api.successRate) * 4)) });
  if (failedJobs) deductions.push({ reason: `${failedJobs} scheduler jobs failing/missed`, points: Math.min(10, failedJobs * 3) });
  if (api.p95 && api.p95 > 1500) deductions.push({ reason: `P95 latency ${api.p95}ms`, points: 10 });
  const healthScore = Math.max(0, 100 - deductions.reduce((s, d) => s + d.points, 0));

  return sendSuccess(res, {
    range: { from, to, bucketMs },
    healthScore,
    deductions,
    users: { total: totalUsers, new: newUsers, active: activeUsers, activeSessions },
    jobs: {
      listings: totalJobs,
      orders: Object.values(orders).reduce((a, b) => a + b, 0),
      active: sumOf('accepted', 'in_progress', 'paid', 'ready_for_review', 'awaiting_payment'),
      completed: sumOf('completed'),
      cancelled: sumOf('cancelled', 'declined'),
      disputed: sumOf('disputed'),
    },
    api: { ...api, live: liveSnapshot() },
    errors: { inRange: errorsInRange, openCritical },
    server: {
      cpuPercent: cpuPercent(),
      ramPercent: Math.round((1 - mem.free / mem.total) * 100),
      disk: diskUsage(),
      uptime: os.uptime(),
      processUptime: process.uptime(),
    },
    integrations: {
      mongo: ping,
      stripeWebhook: { status: webhook.status, mode: webhook.mode, lastDeliveryAt: webhook.lastDeliveryAt || null },
      webhookEvents: { pending: webhookPending, failed: webhookFailed },
      safePay: { total: safePayTotal },
    },
    scheduler: { enabled: scheduler.state.enabled, jobs: jobs.length, failing: failedJobs },
    recentActivity,
    trafficSeries: trafficSeries.map((p) => ({ t: p._id, requests: p.requests, errors: p.errors })),
  });
});

module.exports = { getOverview };
