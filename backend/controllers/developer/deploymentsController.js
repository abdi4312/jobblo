const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const ErrorLog = require('../../models/ErrorLog');
const AdminActivity = require('../../models/AdminActivity');
const ApiMetricMinute = require('../../models/ApiMetricMinute');
const { HOUR, DAY } = require('../../utils/devQuery');
const { githubRuns } = require('../../services/monitoring/github');

/** Developer console — deployments: current release, CI runs and errors around the deploy. */

// ── 23b. Deployments page ───
const getDeployments = asyncHandler(async (req, res) => {
  const startedAt = new Date(Date.now() - process.uptime() * 1000);
  const deployedAt = process.env.DEPLOYED_AT ? new Date(process.env.DEPLOYED_AT) : startedAt;
  const windowMs = Math.min(Date.now() - deployedAt.getTime(), DAY);
  const before = new Date(deployedAt.getTime() - windowMs);
  const groupKey = { errorCode: '$errorCode', route: '$route', message: '$message' };
  const [github, errorsAfter, errorsBefore, apiAfter, apiBefore, newErrors, deployAudit] = await Promise.all([
    githubRuns(),
    ErrorLog.countDocuments({ createdAt: { $gte: deployedAt } }),
    ErrorLog.countDocuments({ createdAt: { $gte: before, $lt: deployedAt } }),
    ApiMetricMinute.aggregate([{ $match: { minute: { $gte: deployedAt } } }, { $group: { _id: null, n: { $sum: '$count' }, c5xx: { $sum: '$c5xx' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } } } }]),
    ApiMetricMinute.aggregate([{ $match: { minute: { $gte: before, $lt: deployedAt } } }, { $group: { _id: null, n: { $sum: '$count' }, c5xx: { $sum: '$c5xx' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } } } }]),
    // Error groups first seen after this deploy = regressions introduced by it.
    ErrorLog.aggregate([
      { $group: { _id: groupKey, first: { $min: '$createdAt' }, last: { $max: '$createdAt' }, n: { $sum: 1 }, id: { $last: '$_id' } } },
      { $match: { first: { $gte: deployedAt } } },
      { $sort: { n: -1 } },
      { $limit: 20 },
    ]),
    AdminActivity.find({ 'metadata.area': 'developer.deployments' }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const sum = (a) => (a[0] ? { requests: a[0].n, errorRate: a[0].n ? Math.round((a[0].c5xx / a[0].n) * 10000) / 100 : null, p95: a[0].n ? Math.round(a[0].p95w / a[0].n) : null } : { requests: 0, errorRate: null, p95: null });
  return sendSuccess(res, {
    current: {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || require('../../package.json').version,
      commit: process.env.GIT_COMMIT_SHA || null,
      branch: process.env.GIT_BRANCH || null,
      deployedAt,
      deployedAtSource: process.env.DEPLOYED_AT ? 'DEPLOYED_AT' : 'process start',
      node: process.version,
      deliveredBy: 'ArgoCD (jobblo-argo-cd, image tag "stable")',
    },
    comparison: { windowHours: Math.round((windowMs / HOUR) * 10) / 10, before: { errors: errorsBefore, ...sum(apiBefore) }, after: { errors: errorsAfter, ...sum(apiAfter) } },
    newErrors: newErrors.map((e) => ({ id: e.id, errorCode: e._id.errorCode, route: e._id.route, message: e._id.message, count: e.n, firstSeen: e.first, lastSeen: e.last })),
    github,
    audit: deployAudit,
    rollback: { available: false, reason: 'Rollbacks are done through ArgoCD (sync to a previous image), never from this dashboard.' },
  });
});

module.exports = { getDeployments };
