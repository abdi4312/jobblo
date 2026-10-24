const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const User = require('../../models/User');
const Payment = require('../../models/Payment');
const Session = require('../../models/Session');
const ErrorLog = require('../../models/ErrorLog');
const Incident = require('../../models/Incident');
const StripeEvent = require('../../models/StripeEvent');
const SchedulerRun = require('../../models/SchedulerRun');
const AdminActivity = require('../../models/AdminActivity');
const SecurityEvent = require('../../models/SecurityEvent');
const DeliveryLog = require('../../models/DeliveryLog');
const ApiMetricMinute = require('../../models/ApiMetricMinute');
const StripePaymentIncident = require('../../models/StripePaymentIncident');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const SubscriptionWebhookEventV2 = require('../../models/SubscriptionWebhookEventV2');
const { parseRange, countBy, groupCount, audit } = require('../../utils/devQuery');

/** Developer console — CSV/JSON reports. */

// ── 26. Reports ─────────────────────────────────────────────────────────────
const REPORTS = {
  health: 'System health',
  performance: 'API performance',
  api_errors: 'API errors',
  stripe: 'Stripe transactions',
  safepay: 'SafePay failures',
  subscriptions: 'Subscription failures',
  security: 'Security incidents',
  notifications: 'Notification delivery',
  developer_activity: 'Developer activity',
};

async function buildReport(type, from, to) {
  const range = { $gte: from, $lte: to };
  const api = () =>
    ApiMetricMinute.aggregate([{ $match: { minute: range } }, { $group: { _id: null, n: { $sum: '$count' }, failed: { $sum: '$failed' }, c5xx: { $sum: '$c5xx' }, dur: { $sum: '$durSum' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } } } }]).then((r) => r[0] || { n: 0 });
  const kv = (title, obj) => ({ title, kind: 'kv', rows: Object.entries(obj).map(([k, v]) => ({ metric: k, value: v ?? '—' })) });
  const table = (title, rows) => ({ title, kind: 'table', rows });

  switch (type) {
    case 'health': {
      const [a, errs, crit, incidents, runs, webhooks, sessions] = await Promise.all([
        api(),
        ErrorLog.countDocuments({ createdAt: range }),
        ErrorLog.countDocuments({ createdAt: range, severity: 'critical' }),
        Incident.find({ startedAt: range }).select('title severity status startedAt resolvedAt').lean(),
        SchedulerRun.aggregate([{ $match: { startedAt: range } }, { $group: { _id: '$ok', n: { $sum: 1 } } }]).then(countBy),
        groupCount(StripeEvent, 'status', { createdAt: range }),
        Session.countDocuments({ lastUsed: range }),
      ]);
      return [
        kv('Summary', {
          'API requests': a.n,
          'API 5xx rate %': a.n ? Math.round((a.c5xx / a.n) * 10000) / 100 : null,
          'Avg latency ms': a.n ? Math.round(a.dur / a.n) : null,
          'P95 latency ms': a.n ? Math.round(a.p95w / a.n) : null,
          'Errors logged': errs,
          'Critical errors': crit,
          'Scheduler runs ok / failed': `${runs.true || 0} / ${runs.false || 0}`,
          'Stripe events processed / pending': `${webhooks.processed || 0} / ${webhooks.processing || 0}`,
          'Active sessions': sessions,
          'Process uptime (h)': Math.round((process.uptime() / 3600) * 10) / 10,
          'Uptime %': 'Not measured — needs an external uptime probe',
        }),
        table('Incidents', incidents.map((i) => ({ title: i.title, severity: i.severity, status: i.status, started: i.startedAt, resolved: i.resolvedAt }))),
      ];
    }
    case 'performance': {
      const [a, endpoints, daily] = await Promise.all([
        api(),
        ApiMetricMinute.aggregate([
          { $match: { minute: range } },
          { $group: { _id: { m: '$method', r: '$route' }, n: { $sum: '$count' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } }, dur: { $sum: '$durSum' } } },
          { $project: { n: 1, p95: { $round: [{ $divide: ['$p95w', '$n'] }, 0] }, avg: { $round: [{ $divide: ['$dur', '$n'] }, 0] } } },
          { $sort: { p95: -1 } },
          { $limit: 25 },
        ]),
        ApiMetricMinute.aggregate([
          { $match: { minute: range } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$minute' } }, n: { $sum: '$count' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } }, c5xx: { $sum: '$c5xx' } } },
          { $sort: { _id: 1 } },
        ]),
      ]);
      return [
        kv('Totals', { Requests: a.n, 'Avg ms': a.n ? Math.round(a.dur / a.n) : null, 'P95 ms': a.n ? Math.round(a.p95w / a.n) : null }),
        table('Daily', daily.map((d) => ({ day: d._id, requests: d.n, p95Ms: d.n ? Math.round(d.p95w / d.n) : null, errors5xx: d.c5xx }))),
        table('Slowest endpoints (P95)', endpoints.map((e) => ({ method: e._id.m, route: e._id.r, requests: e.n, avgMs: e.avg, p95Ms: e.p95 }))),
      ];
    }
    case 'api_errors': {
      const [codes, groups] = await Promise.all([
        ApiMetricMinute.aggregate([{ $match: { minute: range } }, { $group: { _id: { m: '$method', r: '$route' }, c400: { $sum: '$c400' }, c401: { $sum: '$c401' }, c403: { $sum: '$c403' }, c404: { $sum: '$c404' }, c429: { $sum: '$c429' }, c5xx: { $sum: '$c5xx' }, failed: { $sum: '$failed' } } }, { $match: { failed: { $gt: 0 } } }, { $sort: { failed: -1 } }, { $limit: 30 }]),
        ErrorLog.aggregate([{ $match: { createdAt: range } }, { $group: { _id: { c: '$errorCode', r: '$route' }, n: { $sum: 1 }, sev: { $last: '$severity' }, last: { $max: '$createdAt' } } }, { $sort: { n: -1 } }, { $limit: 30 }]),
      ]);
      return [
        table('Failing endpoints by status', codes.map((c) => ({ method: c._id.m, route: c._id.r, failed: c.failed, '400': c.c400, '401': c.c401, '403': c.c403, '404': c.c404, '429': c.c429, '5xx': c.c5xx }))),
        table('Top error groups', groups.map((g) => ({ errorCode: g._id.c, route: g._id.r, count: g.n, severity: g.sev, lastSeen: g.last }))),
      ];
    }
    case 'stripe': {
      const [byStatus, byRefund, gross, incidents] = await Promise.all([
        groupCount(Payment, 'status', { createdAt: range }),
        groupCount(Payment, 'refundStatus', { createdAt: range }),
        Payment.aggregate([{ $match: { createdAt: range } }, { $group: { _id: null, gross: { $sum: '$amount' }, refundedMinor: { $sum: '$refundedAmountMinor' }, n: { $sum: 1 } } }]),
        StripePaymentIncident.aggregate([{ $match: { createdAt: range } }, { $group: { _id: { k: '$kind', s: '$status' }, n: { $sum: 1 } } }]),
      ]);
      return [
        kv('Volume', { Payments: gross[0]?.n || 0, 'Gross NOK': gross[0]?.gross || 0, 'Refunded NOK': (gross[0]?.refundedMinor || 0) / 100 }),
        kv('Payment status', byStatus),
        kv('Refund status', byRefund),
        table('Incidents', incidents.map((i) => ({ kind: i._id.k, status: i._id.s, count: i.n }))),
      ];
    }
    case 'safepay': {
      const rows = await require('./diagnosticsController').scanOrders(500);
      return [table('Stuck & inconsistent orders', rows.flatMap(({ order, issues }) => issues.map((i) => ({ orderId: String(order._id), status: order.status, paymentStatus: order.paymentStatus, issue: i.code, severity: i.severity, detail: i.detail }))))];
    }
    case 'subscriptions': {
      const [ops, byStatus, webhooks] = await Promise.all([
        SubscriptionBillingOperationV2.find({ updatedAt: range, status: { $in: ['failed', 'reconciliation_required'] } }).select('operationType status lastErrorCode lastFailureStage attempts updatedAt').lean(),
        groupCount(SubscriptionV2, 'status'),
        groupCount(SubscriptionWebhookEventV2, 'status', { createdAt: range }),
      ]);
      return [
        kv('Subscriptions now', byStatus),
        kv('Webhook events in range', webhooks),
        table('Failed operations', ops.map((o) => ({ operation: o.operationType, status: o.status, error: o.lastErrorCode, stage: o.lastFailureStage, attempts: o.attempts, at: o.updatedAt }))),
      ];
    }
    case 'security': {
      const [byType, ips, incidents] = await Promise.all([
        groupCount(SecurityEvent, 'type', { at: range }),
        SecurityEvent.aggregate([{ $match: { at: range } }, { $group: { _id: '$ip', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 15 }]),
        Incident.find({ service: 'security', startedAt: range }).select('title severity status startedAt').lean(),
      ]);
      return [kv('Events by type', byType), table('Top IPs', ips.map((i) => ({ ip: i._id, events: i.n }))), table('Security incidents', incidents.map((i) => ({ title: i.title, severity: i.severity, status: i.status, started: i.startedAt })))];
    }
    case 'notifications': {
      const rows = await DeliveryLog.aggregate([{ $match: { at: range } }, { $group: { _id: { c: '$channel', s: '$status' }, n: { $sum: 1 }, lat: { $avg: '$latencyMs' } } }]);
      return [table('Deliveries', rows.map((r) => ({ channel: r._id.c, status: r._id.s, count: r.n, avgLatencyMs: Math.round(r.lat || 0) })))];
    }
    case 'developer_activity': {
      const rows = await AdminActivity.aggregate([
        { $match: { createdAt: range, type: 'audit' } },
        { $lookup: { from: User.collection.name, localField: 'adminId', foreignField: '_id', as: 'actor' } },
        { $project: { action: 1, area: '$metadata.area', name: { $first: '$actor.name' }, role: { $first: '$actor.role' } } },
        { $match: { role: { $in: ['developer', 'superAdmin'] } } },
        { $group: { _id: { name: '$name', role: '$role', area: { $ifNull: ['$area', '$action'] } }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]);
      return [table('Actions by actor', rows.map((r) => ({ actor: r._id.name, role: r._id.role, area: r._id.area, actions: r.n })))];
    }
    default:
      return null;
  }
}

const getReportTypes = asyncHandler(async (req, res) => sendSuccess(res, { types: Object.entries(REPORTS).map(([key, title]) => ({ key, title })) }));

const getReport = asyncHandler(async (req, res) => {
  const type = req.params.type;
  if (!REPORTS[type]) return sendError(res, 'Unknown report.', 404);
  const { from, to } = parseRange(req.query);
  const sections = await buildReport(type, from, to);
  await audit(req, `Developer generated report: ${REPORTS[type]}`, { area: 'developer.reports', type, from, to });
  return sendSuccess(res, { type, title: REPORTS[type], generatedAt: new Date(), range: { from, to }, environment: process.env.NODE_ENV || 'development', sections });
});

module.exports = { REPORTS, buildReport, getReportTypes, getReport };
