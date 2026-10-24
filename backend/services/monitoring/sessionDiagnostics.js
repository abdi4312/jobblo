/**
 * Frontend session diagnostics over RumEvent: sessions that hit a problem (JS error, broken
 * screen, page not found, failed code chunk, failed API call, console error) and a replay of
 * each one as a timeline — page views plus the masked breadcrumb trail sent with every
 * problem. A breadcrumb replay, not a DOM recording: it never captures what was on screen
 * or typed. ponytail: upgrade path is rrweb with maskAllInputs + maskAllText if that is
 * ever needed.
 */

const DAY = 86_400_000;
const PROBLEM = { $or: [{ type: 'error' }, { type: 'problem' }] };
const kindOf = (e) => (e.type === 'error' ? 'js_error' : e.kind);

/** Pure: one ordered, de-duplicated timeline from a session's events. Unit-tested. */
function buildTimeline(events) {
  const seen = new Set();
  const out = [];
  const push = (item) => {
    const key = `${+new Date(item.at)}|${item.type}|${item.label || ''}|${item.page || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  for (const e of events) {
    // Crumbs first: they happened before the problem they were sent with.
    for (const c of e.trail || []) if (c.type !== 'view') push({ at: c.at, type: c.type, page: c.page, label: c.label, status: c.status ?? null, ms: c.ms ?? null });
    if (e.type === 'view') push({ at: e.at, type: 'view', page: e.page, label: null, ms: e.loadMs ?? null });
    else if (e.type === 'error' || e.type === 'problem') push({ at: e.at, type: 'problem', kind: kindOf(e), page: e.page, label: e.message, status: e.status ?? null, source: e.source || null });
  }
  return out.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

async function overview({ days = 7, kind } = {}) {
  const RumEvent = require('../../models/RumEvent');
  const from = new Date(Date.now() - days * DAY);
  const kindMatch = kind === 'js_error' ? { type: 'error' } : kind ? { type: 'problem', kind } : PROBLEM;
  const [allSessions, byKind, sessions, groups] = await Promise.all([
    RumEvent.distinct('sessionId', { at: { $gte: from } }),
    RumEvent.aggregate([{ $match: { at: { $gte: from }, ...PROBLEM } }, { $group: { _id: { t: '$type', k: '$kind' }, n: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } }]),
    RumEvent.aggregate([
      { $match: { at: { $gte: from }, ...kindMatch } },
      { $sort: { at: 1 } },
      { $group: { _id: '$sessionId', first: { $first: '$at' }, last: { $last: '$at' }, problems: { $sum: 1 }, kinds: { $addToSet: { $cond: [{ $eq: ['$type', 'error'] }, 'js_error', '$kind'] } }, pages: { $addToSet: '$page' }, device: { $first: '$device' }, browser: { $first: '$browser' }, release: { $first: '$release' }, lastMessage: { $last: '$message' } } },
      { $sort: { last: -1 } },
      { $limit: 100 },
    ]),
    RumEvent.aggregate([
      { $match: { at: { $gte: from }, ...kindMatch } },
      { $sort: { at: -1 } },
      { $group: { _id: '$fingerprint', kind: { $first: { $cond: [{ $eq: ['$type', 'error'] }, 'js_error', '$kind'] } }, message: { $first: '$message' }, n: { $sum: 1 }, sessions: { $addToSet: '$sessionId' }, pages: { $addToSet: '$page' }, last: { $first: '$at' }, sampleSession: { $first: '$sessionId' } } },
      { $project: { _id: 0, fingerprint: '$_id', kind: 1, message: 1, n: 1, sessions: { $size: '$sessions' }, pages: { $slice: ['$pages', 4] }, last: 1, sampleSession: 1 } },
      { $sort: { sessions: -1, n: -1 } },
      { $limit: 30 },
    ]),
  ]);
  const kinds = {};
  const affected = new Set();
  for (const k of byKind) {
    const key = k._id.t === 'error' ? 'js_error' : k._id.k;
    kinds[key] = { events: (kinds[key]?.events || 0) + k.n, sessions: (kinds[key]?.sessions || 0) + k.sessions.length };
    for (const s of k.sessions) affected.add(s);
  }
  return {
    days,
    sessions: allSessions.length,
    affectedSessions: affected.size,
    problemFree: allSessions.length ? Math.round((1 - affected.size / allSessions.length) * 1000) / 10 : null,
    kinds,
    list: sessions.map((s) => ({ sessionId: s._id, first: s.first, last: s.last, problems: s.problems, kinds: s.kinds, pages: s.pages.slice(0, 5), device: s.device, browser: s.browser, release: s.release, lastMessage: s.lastMessage })),
    groups,
  };
}

async function session(sessionId) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) return null;
  const events = await require('../../models/RumEvent').find({ sessionId, type: { $in: ['view', 'error', 'problem'] } }).sort({ at: 1 }).limit(500).lean();
  if (!events.length) return null;
  const first = events[0];
  return { sessionId, device: first.device, browser: first.browser, connection: first.connection, release: first.release, started: first.at, ended: events[events.length - 1].at, timeline: buildTimeline(events) };
}

module.exports = { buildTimeline, overview, session };
