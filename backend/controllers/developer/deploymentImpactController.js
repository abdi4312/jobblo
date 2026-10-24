const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const dep = require('../../services/monitoring/deployments');
const Deployment = require('../../models/Deployment');

/** Developer dashboard — deployment impact analyzer. Read-only. */

const HOUR = 60 * 60 * 1000;
const hoursOf = (q) => ([1, 3, 6, 12, 24].includes(Number(q)) ? Number(q) : 6);

async function judgeDeployment(d, nextAt, hours) {
  const w = dep.windows(d.deployedAt, nextAt, hours);
  const [before, after, newErrors] = await Promise.all([dep.apiWindow(...w.before), dep.apiWindow(...w.after), dep.newErrorGroups(...w.after)]);
  return { windowHours: Math.round((w.span / HOUR) * 10) / 10, before, after, newErrors, ...dep.judge(before, after, { newErrors: newErrors.filter((e) => e.count >= 3).length }) };
}

/** Mobile releases: first session per app version, with crash-free sessions vs the rest of the fleet. */
async function mobileReleases() {
  const MobileEvent = require('../../models/MobileEvent');
  const versions = await MobileEvent.aggregate([
    { $match: { type: 'session', appVersion: { $ne: null } } },
    { $group: { _id: { v: '$appVersion', p: '$platform' }, firstSeen: { $min: '$at' }, sessions: { $sum: 1 }, installs: { $addToSet: '$installId' } } },
    { $sort: { firstSeen: -1 } },
    { $limit: 10 },
  ]);
  return Promise.all(
    versions.map(async (v) => {
      const crashed = await MobileEvent.distinct('sessionId', { type: 'error', fatal: true, appVersion: v._id.v, platform: v._id.p });
      const crashFree = v.sessions ? Math.round((1 - crashed.length / v.sessions) * 10000) / 100 : null;
      return {
        kind: 'mobile',
        id: `${v._id.p}-${v._id.v}`,
        version: v._id.v,
        platform: v._id.p,
        deployedAt: v.firstSeen,
        sessions: v.sessions,
        installs: v.installs.length,
        crashFree,
        verdict: v.sessions < 20 ? 'insufficient' : crashFree < 99 ? 'regression' : crashFree < 99.5 ? 'warning' : 'healthy',
      };
    })
  );
}

const getImpact = asyncHandler(async (req, res) => {
  const hours = hoursOf(req.query.hours);
  const list = await Deployment.find().sort({ deployedAt: -1 }).limit(15).lean();
  const api = await Promise.all(
    list.map(async (d, i) => {
      const nextAt = i > 0 ? list[i - 1].deployedAt : null;
      const j = await judgeDeployment(d, nextAt, hours);
      return { kind: 'api', id: String(d._id), version: d.version, commit: d.commit, branch: d.branch, environment: d.environment, host: d.host, deployedAt: d.deployedAt, boots: d.boots, current: i === 0, ...j, newErrors: j.newErrors.length };
    })
  );
  return sendSuccess(res, { hours, current: dep.identity(), api, mobile: await mobileReleases() });
});

const getImpactDetail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const hours = hoursOf(req.query.hours);
  const d = await Deployment.findById(req.params.id).populate('previous', 'version commit deployedAt').lean();
  if (!d) return sendError(res, 'Deployment not found.', 404);
  const next = await Deployment.findOne({ deployedAt: { $gt: d.deployedAt } }).sort({ deployedAt: 1 }).select('deployedAt version').lean();
  const w = dep.windows(d.deployedAt, next?.deployedAt, hours);
  const bucketMs = w.span <= 3 * HOUR ? 5 * 60 * 1000 : w.span <= 12 * HOUR ? 15 * 60 * 1000 : HOUR;
  const bucket = { $toDate: { $subtract: [{ $toLong: '$minute' }, { $mod: [{ $toLong: '$minute' }, bucketMs] }] } };
  const [j, routes, series, synthetic] = await Promise.all([
    judgeDeployment(d, next?.deployedAt, hours),
    dep.routeDiffs(w.before[0], d.deployedAt, w.after[1]),
    require('../../models/ApiMetricMinute').aggregate([
      { $match: { minute: { $gte: w.before[0], $lt: w.after[1] }, route: { $not: /^\/api\/(developer|mobile\/telemetry)/ } } },
      { $group: { _id: bucket, requests: { $sum: '$count' }, errors: { $sum: '$c5xx' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, t: '$_id', requests: 1, errors: 1, p95: { $cond: ['$requests', { $round: [{ $divide: ['$p95w', '$requests'] }, 0] }, null] } } },
    ]),
    require('../../models/SyntheticRun').aggregate([
      { $match: { at: { $gte: w.before[0], $lt: w.after[1] } } },
      { $group: { _id: { $cond: [{ $lt: ['$at', d.deployedAt] }, 'before', 'after'] }, runs: { $sum: 1 }, failed: { $sum: { $cond: ['$ok', 0, 1] } } } },
    ]),
  ]);
  const syn = Object.fromEntries(synthetic.map((s) => [s._id, { runs: s.runs, failed: s.failed }]));
  return sendSuccess(res, {
    deployment: { ...d, _id: String(d._id) },
    next: next || null,
    bucketMs,
    ...j,
    synthetic: { before: syn.before || { runs: 0, failed: 0 }, after: syn.after || { runs: 0, failed: 0 } },
    routes,
    series,
  });
});

module.exports = { getImpact, getImpactDetail };
