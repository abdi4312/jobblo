const fs = require('fs');
const path = require('path');

/**
 * Mobile release management over the app's own telemetry (MobileEvent): which iOS/Android
 * versions are in use, how fast the newest one is adopted, which versions are outdated or
 * below the supported minimum, crash-free and API failures per version, and whether a
 * breaking API change landed after a version shipped (reuses the Migrations check).
 */

const DAY = 86_400_000;

/** Pure: compare "1.10.2" with "1.9" numerically. Unit-tested. */
function cmpVersion(a, b) {
  const pa = String(a || '0').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * Pure: per-platform release table. rows = [{ platform, version, installs, sessions,
 * crashedSessions, apiFailures, firstSeen, lastSeen }]; minVersion = { ios, android }.
 * Unit-tested.
 */
function releaseTable(rows, minVersion = {}) {
  const out = [];
  for (const platform of [...new Set(rows.map((r) => r.platform || 'unknown'))]) {
    const list = rows.filter((r) => (r.platform || 'unknown') === platform).sort((a, b) => cmpVersion(b.version, a.version));
    const total = list.reduce((a, r) => a + r.installs, 0);
    const latest = list[0]?.version;
    list.forEach((r, i) => {
      const min = minVersion[platform];
      const status = min && cmpVersion(r.version, min) < 0 ? 'unsupported' : i === 0 ? 'latest' : i >= 2 ? 'outdated' : 'previous';
      out.push({
        platform,
        version: r.version,
        latest,
        behind: i,
        status,
        installs: r.installs,
        share: total ? Math.round((r.installs / total) * 1000) / 10 : null,
        sessions: r.sessions,
        crashFree: r.sessions ? Math.round((1 - r.crashedSessions / r.sessions) * 10000) / 100 : null,
        apiFailuresPer100: r.sessions ? Math.round((r.apiFailures / r.sessions) * 1000) / 10 : null,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
      });
    });
  }
  return out;
}

/** The version the app in this repository will ship as next (jobblo-app/app.json), if present. */
function repoVersion() {
  try {
    const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'jobblo-app', 'app.json'), 'utf8'));
    return app.expo?.version || app.version || null;
  } catch {
    return null; // not shipped in the backend image
  }
}

async function releases({ days = 30 } = {}) {
  const MobileEvent = require('../../models/MobileEvent');
  const active = new Date(Date.now() - 7 * DAY);
  const from = new Date(Date.now() - days * DAY);
  const minVersion = { ios: process.env.MOBILE_MIN_VERSION_IOS || process.env.MOBILE_MIN_VERSION || null, android: process.env.MOBILE_MIN_VERSION_ANDROID || process.env.MOBILE_MIN_VERSION || null };
  const [versions, crashed, api, os, daily, clients] = await Promise.all([
    MobileEvent.aggregate([
      { $match: { type: 'session', at: { $gte: active }, appVersion: { $ne: null } } },
      { $group: { _id: { p: '$platform', v: '$appVersion' }, sessions: { $sum: 1 }, installs: { $addToSet: '$installId' } } },
    ]),
    MobileEvent.aggregate([{ $match: { type: 'error', fatal: true, at: { $gte: active } } }, { $group: { _id: { p: '$platform', v: '$appVersion' }, s: { $addToSet: '$sessionId' } } }]),
    MobileEvent.aggregate([{ $match: { type: 'api', at: { $gte: active } } }, { $group: { _id: { p: '$platform', v: '$appVersion' }, n: { $sum: 1 } } }]),
    MobileEvent.aggregate([
      { $match: { type: 'session', at: { $gte: active } } },
      { $group: { _id: { p: '$platform', o: { $arrayElemAt: [{ $split: [{ $ifNull: ['$osVersion', '?'] }, '.'] }, 0] } }, installs: { $addToSet: '$installId' } } },
      { $project: { _id: 0, platform: '$_id.p', os: '$_id.o', installs: { $size: '$installs' } } },
      { $sort: { installs: -1 } },
    ]),
    MobileEvent.aggregate([
      { $match: { type: 'session', at: { $gte: from }, appVersion: { $ne: null } } },
      { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$at' } }, p: '$platform', v: '$appVersion' }, installs: { $addToSet: '$installId' } } },
      { $project: { _id: 0, day: '$_id.d', platform: '$_id.p', version: '$_id.v', installs: { $size: '$installs' } } },
    ]),
    require('./migrations').incompatibleClients(),
  ]);
  const key = (x) => `${x._id.p}|${x._id.v}`;
  const crashedBy = Object.fromEntries(crashed.map((c) => [key(c), c.s.length]));
  const apiBy = Object.fromEntries(api.map((a) => [key(a), a.n]));
  const seen = Object.fromEntries(clients.map((c) => [`${c.platform}|${c.version}`, c]));
  const table = releaseTable(
    versions.map((v) => {
      const c = seen[key(v)];
      return { platform: v._id.p, version: v._id.v, installs: v.installs.length, sessions: v.sessions, crashedSessions: crashedBy[key(v)] || 0, apiFailures: apiBy[key(v)] || 0, firstSeen: c?.firstSeen || null, lastSeen: c?.lastSeen || null };
    }),
    minVersion
  ).map((r) => ({ ...r, breakingSince: seen[`${r.platform}|${r.version}`]?.breakingSince || 0, breakingRoutes: seen[`${r.platform}|${r.version}`]?.routes || [] }));

  // Adoption of each platform's latest version, per day: share of that day's installs.
  const adoption = {};
  for (const platform of [...new Set(table.map((r) => r.platform))]) {
    const latest = table.find((r) => r.platform === platform && r.behind === 0)?.version;
    const byDay = {};
    for (const d of daily.filter((x) => x.platform === platform)) {
      byDay[d.day] ||= { t: `${d.day}T00:00:00.000Z`, total: 0, latest: 0 };
      byDay[d.day].total += d.installs;
      if (d.version === latest) byDay[d.day].latest += d.installs;
    }
    adoption[platform] = { latest, series: Object.values(byDay).sort((a, b) => a.t.localeCompare(b.t)).map((d) => ({ t: d.t, share: d.total ? Math.round((d.latest / d.total) * 1000) / 10 : 0 })) };
  }

  const summary = (platform) => {
    const rows = table.filter((r) => r.platform === platform);
    const installs = rows.reduce((a, r) => a + r.installs, 0);
    const share = (pred) => (installs ? Math.round((rows.filter(pred).reduce((a, r) => a + r.installs, 0) / installs) * 1000) / 10 : null);
    return { platform, latest: rows[0]?.latest || null, installs, onLatest: share((r) => r.behind === 0), outdated: share((r) => r.status === 'outdated' || r.status === 'unsupported'), unsupported: share((r) => r.status === 'unsupported'), minVersion: minVersion[platform] };
  };

  return { days, repoVersion: repoVersion(), minVersion, platforms: ['ios', 'android'].map(summary), versions: table, adoption, os, bucketMs: DAY };
}

module.exports = { cmpVersion, releaseTable, releases };
