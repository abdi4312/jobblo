const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { parseRange } = require('../../utils/devQuery');
const { percentile } = require('../../middleware/requestMetrics');
const MobileEvent = require('../../models/MobileEvent');

/** Developer dashboard — mobile app health from the app's own reporter. Read-only. */

const pct = (part, total) => (total ? Math.round((1 - part / total) * 10000) / 100 : null);

const getMobile = asyncHandler(async (req, res) => {
  const { from, to, bucketMs } = parseRange({ range: req.query.range || '7d', ...req.query });
  const inRange = { at: { $gte: from, $lte: to } };
  const sessions = { ...inRange, type: 'session' };
  const errors = { ...inRange, type: 'error' };

  const [totals, crashedSessions, versions, crashedByVersion, platforms, devices, errorGroups, api, series, recentCrashes] = await Promise.all([
    MobileEvent.aggregate([
      { $match: inRange },
      {
        $group: {
          _id: null,
          installs: { $addToSet: '$installId' },
          users: { $addToSet: '$userId' },
          sessions: { $sum: { $cond: [{ $eq: ['$type', 'session'] }, 1, 0] } },
          errors: { $sum: { $cond: [{ $eq: ['$type', 'error'] }, 1, 0] } },
          fatal: { $sum: { $cond: ['$fatal', 1, 0] } },
          apiFailures: { $sum: { $cond: [{ $eq: ['$type', 'api'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, installs: { $size: '$installs' }, users: { $size: { $setDifference: ['$users', [null]] } }, sessions: 1, errors: 1, fatal: 1, apiFailures: 1 } },
    ]),
    MobileEvent.distinct('sessionId', { ...errors, fatal: true }),
    MobileEvent.aggregate([
      { $match: sessions },
      { $group: { _id: { v: '$appVersion', b: '$build', p: '$platform' }, sessions: { $sum: 1 }, installs: { $addToSet: '$installId' }, lastSeen: { $max: '$at' }, firstSeen: { $min: '$at' } } },
      { $project: { _id: 0, appVersion: '$_id.v', build: '$_id.b', platform: '$_id.p', sessions: 1, installs: { $size: '$installs' }, lastSeen: 1, firstSeen: 1 } },
      { $sort: { lastSeen: -1 } },
      { $limit: 30 },
    ]),
    MobileEvent.aggregate([
      { $match: { ...errors, fatal: true } },
      { $group: { _id: { v: '$appVersion', b: '$build', p: '$platform' }, sessions: { $addToSet: '$sessionId' } } },
      { $project: { _id: 0, key: { $concat: [{ $ifNull: ['$_id.v', ''] }, '|', { $ifNull: ['$_id.b', ''] }, '|', { $ifNull: ['$_id.p', ''] }] }, n: { $size: '$sessions' } } },
    ]),
    MobileEvent.aggregate([
      { $match: sessions },
      { $group: { _id: { p: '$platform', os: '$osVersion' }, sessions: { $sum: 1 }, installs: { $addToSet: '$installId' } } },
      { $project: { _id: 0, platform: '$_id.p', osVersion: '$_id.os', sessions: 1, installs: { $size: '$installs' } } },
      { $sort: { sessions: -1 } },
      { $limit: 20 },
    ]),
    MobileEvent.aggregate([
      { $match: sessions },
      { $group: { _id: '$device', sessions: { $sum: 1 }, installs: { $addToSet: '$installId' } } },
      { $project: { _id: 0, device: '$_id', sessions: 1, installs: { $size: '$installs' } } },
      { $sort: { installs: -1 } },
      { $limit: 12 },
    ]),
    MobileEvent.aggregate([
      { $match: errors },
      { $sort: { at: -1 } },
      {
        $group: {
          _id: '$fingerprint',
          count: { $sum: 1 },
          fatal: { $sum: { $cond: ['$fatal', 1, 0] } },
          installs: { $addToSet: '$installId' },
          versions: { $addToSet: '$appVersion' },
          platforms: { $addToSet: '$platform' },
          lastSeen: { $first: '$at' },
          firstSeen: { $last: '$at' },
          name: { $first: '$name' },
          message: { $first: '$message' },
          kind: { $first: '$kind' },
          screen: { $first: '$screen' },
        },
      },
      { $project: { _id: 0, fingerprint: '$_id', count: 1, fatal: 1, installs: { $size: '$installs' }, versions: 1, platforms: 1, lastSeen: 1, firstSeen: 1, name: 1, message: 1, kind: 1, screen: 1 } },
      { $sort: { fatal: -1, count: -1 } },
      { $limit: 50 },
    ]),
    MobileEvent.aggregate([
      { $match: { ...inRange, type: 'api' } },
      { $sort: { at: -1 } },
      { $group: { _id: { m: '$method', p: '$path' }, count: { $sum: 1 }, statuses: { $push: '$status' }, ms: { $push: '$ms' }, installs: { $addToSet: '$installId' }, lastSeen: { $first: '$at' } } },
      { $project: { _id: 0, method: '$_id.m', path: '$_id.p', count: 1, statuses: { $slice: ['$statuses', 500] }, ms: { $slice: ['$ms', 500] }, installs: { $size: '$installs' }, lastSeen: 1 } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]),
    MobileEvent.aggregate([
      { $match: inRange },
      {
        $group: {
          _id: { $toDate: { $subtract: [{ $toLong: '$at' }, { $mod: [{ $toLong: '$at' }, bucketMs] }] } },
          sessions: { $sum: { $cond: [{ $eq: ['$type', 'session'] }, 1, 0] } },
          errors: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'error'] }, { $ne: ['$fatal', true] }] }, 1, 0] } },
          crashes: { $sum: { $cond: ['$fatal', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, t: '$_id', sessions: 1, errors: 1, crashes: 1 } },
    ]),
    MobileEvent.find({ ...errors, fatal: true }).sort({ at: -1 }).limit(15).select('at name message screen appVersion build platform device fingerprint userId').lean(),
  ]);

  const t = totals[0] || { installs: 0, users: 0, sessions: 0, errors: 0, fatal: 0, apiFailures: 0 };
  const crashed = Object.fromEntries(crashedByVersion.map((c) => [c.key, c.n]));
  return sendSuccess(res, {
    range: { from, to, bucketMs },
    summary: { ...t, crashedSessions: crashedSessions.length, crashFreeSessions: pct(crashedSessions.length, t.sessions) },
    versions: versions.map((v) => {
      const n = crashed[`${v.appVersion || ''}|${v.build || ''}|${v.platform || ''}`] || 0;
      return { ...v, crashedSessions: n, crashFree: pct(n, v.sessions) };
    }),
    platforms,
    devices,
    errorGroups,
    api: api.map(({ statuses, ms, ...a }) => {
      const sorted = ms.filter((x) => typeof x === 'number').sort((x, y) => x - y);
      const codes = {};
      for (const s of statuses) codes[s ?? 'unknown'] = (codes[s ?? 'unknown'] || 0) + 1;
      return { ...a, codes, p50: sorted.length ? percentile(sorted, 50) : null, p95: sorted.length ? percentile(sorted, 95) : null };
    }),
    series,
    recentCrashes,
  });
});

const getMobileError = asyncHandler(async (req, res) => {
  const fp = String(req.params.fingerprint || '');
  if (!/^[0-9a-f]{16}$/.test(fp)) return sendError(res, 'Invalid fingerprint.', 400);
  const events = await MobileEvent.find({ type: 'error', fingerprint: fp }).sort({ at: -1 }).limit(50).populate('userId', 'name email').lean();
  if (!events.length) return sendError(res, 'Not found.', 404);
  return sendSuccess(res, { events });
});

/** Release management: versions per platform, adoption, outdated/unsupported, API compatibility. */
const getMobileReleases = asyncHandler(async (req, res) => sendSuccess(res, await require('../../services/monitoring/mobileReleases').releases({ days: [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30 })));

module.exports = { getMobile, getMobileError, getMobileReleases };
