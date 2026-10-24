const os = require('os');
const { execFileSync } = require('child_process');

/**
 * Deployment impact: what changed after each release.
 *
 * API releases are recorded on boot (no CI hook needed): identity is APP_VERSION /
 * GIT_COMMIT_SHA, falling back to package.json and `git rev-parse` in a checkout. The first
 * boot of a new identity is the deployment; DEPLOYED_AT overrides its time. Mobile releases
 * are the first session seen for each app version (MobileEvent).
 *
 * Each release is judged on equal windows before and after it.
 */

const HOUR = 60 * 60 * 1000;

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString().trim() || null;
  } catch {
    return null;
  }
}

function identity() {
  return {
    version: process.env.APP_VERSION || require('../../package.json').version,
    commit: process.env.GIT_COMMIT_SHA || gitHead(),
    branch: process.env.GIT_BRANCH || null,
  };
}

/** Called once from server.js after listen. Never throws. */
async function recordBoot() {
  try {
    const Deployment = require('../../models/Deployment');
    const id = identity();
    const now = new Date();
    const last = await Deployment.findOne().sort({ deployedAt: -1 });
    if (last && last.version === id.version && (last.commit || null) === (id.commit || null)) {
      last.boots += 1;
      last.lastBootAt = now;
      await last.save();
      return last;
    }
    return await Deployment.create({
      ...id,
      environment: process.env.NODE_ENV || 'development',
      host: os.hostname(),
      deployedAt: process.env.DEPLOYED_AT ? new Date(process.env.DEPLOYED_AT) : now,
      lastBootAt: now,
      previous: last?._id || null,
    });
  } catch (e) {
    console.error('[deployments] could not record boot:', e.message);
    return null;
  }
}

/** Pure: compare a before and after window. Unit-tested. */
function judge(before, after, { newErrors = 0 } = {}) {
  const reasons = [];
  const MIN = 50;
  if (before.requests < MIN || after.requests < MIN) {
    return { verdict: 'insufficient', reasons: [`Needs ≥ ${MIN} requests on each side (before ${before.requests}, after ${after.requests}).`] };
  }
  let regression = false;
  let warning = false;
  const errB = before.c5xx / before.requests;
  const errA = after.c5xx / after.requests;
  if (after.c5xx >= 5 && errA > Math.max(errB * 2, errB + 0.005)) {
    regression = true;
    reasons.push(`5xx rate ${(errB * 100).toFixed(2)}% → ${(errA * 100).toFixed(2)}%`);
  }
  if (before.p95 && after.p95 && after.p95 > before.p95 * 1.5 && after.p95 - before.p95 >= 200) {
    regression = true;
    reasons.push(`p95 latency ${before.p95} ms → ${after.p95} ms`);
  }
  const slowB = before.slowShare;
  const slowA = after.slowShare;
  if (slowA !== null && slowB !== null && slowA > Math.max(slowB * 2, slowB + 0.01)) {
    warning = true;
    reasons.push(`slow requests ${(slowB * 100).toFixed(1)}% → ${(slowA * 100).toFixed(1)}%`);
  }
  if (newErrors > 0) {
    warning = true;
    reasons.push(`${newErrors} new error type${newErrors === 1 ? '' : 's'} first seen after the release`);
  }
  if (regression) return { verdict: 'regression', reasons };
  if (warning) return { verdict: 'warning', reasons };
  const improved = (errA < errB * 0.5 && before.c5xx >= 5) || (before.p95 && after.p95 && after.p95 < before.p95 * 0.7);
  return { verdict: improved ? 'improved' : 'healthy', reasons: improved ? ['Errors or latency went down after the release.'] : ['No meaningful change in errors or latency.'] };
}

const USER_ROUTES = { route: { $not: /^\/api\/(developer|mobile\/telemetry)/ } };

async function apiWindow(from, to) {
  const [r] = await require('../../models/ApiMetricMinute').aggregate([
    { $match: { minute: { $gte: from, $lt: to }, ...USER_ROUTES } },
    {
      $group: {
        _id: null,
        requests: { $sum: '$count' },
        c5xx: { $sum: '$c5xx' },
        p95w: { $sum: { $multiply: ['$p95', '$count'] } },
        slow: { $sum: { $ifNull: ['$slow', 0] } },
        // Rows written before the slow counter existed have no `slow` field; 0 is a real value.
        slowCounted: { $sum: { $cond: [{ $eq: [{ $type: '$slow' }, 'missing'] }, 0, '$count'] } },
      },
    },
  ]);
  if (!r) return { requests: 0, c5xx: 0, p95: null, slowShare: null };
  return { requests: r.requests, c5xx: r.c5xx, p95: r.requests ? Math.round(r.p95w / r.requests) : null, slowShare: r.slowCounted ? r.slow / r.slowCounted : null };
}

/** Error groups (code + route + message) whose first occurrence is inside [from, to). */
async function newErrorGroups(from, to) {
  return require('../../models/ErrorLog').aggregate([
    { $match: { createdAt: { $lt: to } } },
    { $group: { _id: { code: '$errorCode', route: '$route', message: '$message' }, first: { $min: '$createdAt' }, n: { $sum: { $cond: [{ $gte: ['$createdAt', from] }, 1, 0] } }, id: { $last: '$_id' } } },
    { $match: { first: { $gte: from } } },
    { $sort: { n: -1 } },
    { $limit: 20 },
    { $project: { _id: 0, errorCode: '$_id.code', route: '$_id.route', message: '$_id.message', firstSeen: '$first', count: '$n', id: 1 } },
  ]);
}

/** Routes whose error rate or p95 moved the most. */
async function routeDiffs(beforeFrom, at, afterTo) {
  const rows = await require('../../models/ApiMetricMinute').aggregate([
    { $match: { minute: { $gte: beforeFrom, $lt: afterTo }, ...USER_ROUTES } },
    { $project: { key: { $concat: ['$method', ' ', '$route'] }, side: { $cond: [{ $lt: ['$minute', at] }, 'before', 'after'] }, count: 1, c5xx: 1, p95w: { $multiply: ['$p95', '$count'] } } },
    { $group: { _id: { key: '$key', side: '$side' }, n: { $sum: '$count' }, c5xx: { $sum: '$c5xx' }, p95w: { $sum: '$p95w' } } },
  ]);
  const by = {};
  for (const r of rows) {
    const k = r._id.key;
    by[k] ||= { route: k, before: null, after: null };
    by[k][r._id.side] = { requests: r.n, c5xx: r.c5xx, p95: r.n ? Math.round(r.p95w / r.n) : null };
  }
  return Object.values(by)
    .filter((r) => r.after && (r.after.requests >= 10 || r.after.c5xx > 0))
    .map((r) => {
      const eb = r.before?.requests ? r.before.c5xx / r.before.requests : 0;
      const ea = r.after.c5xx / r.after.requests;
      const latencyDelta = r.before?.p95 && r.after.p95 ? r.after.p95 - r.before.p95 : null;
      return { ...r, errorDelta: ea - eb, latencyDelta, isNew: !r.before };
    })
    .sort((a, b) => b.errorDelta - a.errorDelta || (b.latencyDelta ?? 0) - (a.latencyDelta ?? 0))
    .slice(0, 15);
}

/** Window either side of `at`: the requested hours, cut short by the next release or now. */
function windows(at, nextAt, hours) {
  const span = Math.min(hours * HOUR, (nextAt ? nextAt.getTime() : Date.now()) - at.getTime());
  return { span: Math.max(span, 0), before: [new Date(at.getTime() - span), at], after: [at, new Date(at.getTime() + span)] };
}

module.exports = { identity, recordBoot, judge, apiWindow, newErrorGroups, routeDiffs, windows };
