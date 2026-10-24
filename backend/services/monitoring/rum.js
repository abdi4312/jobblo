const crypto = require('crypto');

/**
 * Real-user monitoring intake + aggregation for the web app.
 * Intake is public (anonymous visitors), so it whitelists, caps and validates everything.
 * Aggregation follows Google's convention: a page passes a Core Web Vital when its 75th
 * percentile is "good" (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, FCP ≤ 1.8 s, TTFB ≤ 800 ms).
 */

const MAX_BATCH = 30;
const METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
const THRESHOLDS = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] };
const DEVICES = ['mobile', 'tablet', 'desktop'];
const RATINGS = ['good', 'needs-improvement', 'poor'];
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v, max) => (Number.isFinite(v) && v >= 0 ? Math.min(v, max) : null);

/** Pure: "/jobs/6ad90a9e94221dfd9681ff17?x=1" → "/jobs/:id". Unit-tested. */
function templatePage(raw) {
  const p = String(raw || '/').split(/[?#]/)[0].slice(0, 200);
  return p.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id').replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:id') || '/';
}

const PROBLEM_KINDS = ['render', 'not_found', 'chunk', 'api', 'console'];
const CRUMB_TYPES = ['view', 'click', 'api', 'console', 'error'];
const MAX_TRAIL = 30;

/** Pure: strip anything personal from a free-text label. Unit-tested. */
function maskLabel(raw, max = 80) {
  return String(raw || '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\b[0-9a-f]{24}\b/gi, ':id')
    .replace(/\+?\d[\d\s-]{2,}\d/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Pure: whitelist and mask a breadcrumb trail. Unit-tested. */
function normalizeTrail(trail, now = Date.now()) {
  if (!Array.isArray(trail)) return undefined;
  const out = [];
  for (const c of trail.slice(-MAX_TRAIL)) {
    if (!c || !CRUMB_TYPES.includes(c.type)) continue;
    const t = Number(new Date(c.at));
    out.push({
      at: new Date(Number.isFinite(t) && t <= now + 300_000 && t >= now - 86_400_000 ? t : now),
      type: c.type,
      page: templatePage(c.page),
      label: maskLabel(c.label),
      status: Number.isInteger(c.status) && c.status >= 0 && c.status < 600 ? c.status : undefined,
      ms: num(c.ms, 120_000) ?? undefined,
    });
  }
  return out.length ? out : undefined;
}

/** Pure: Google rating for a value. */
function rate(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t || value === null) return null;
  return value <= t[0] ? 'good' : value <= t[1] ? 'needs-improvement' : 'poor';
}

/** Pure: whitelist one batch. Unit-tested. */
function normalize(body, now = Date.now()) {
  const b = body && typeof body === 'object' ? body : {};
  const sessionId = typeof b.sessionId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(b.sessionId) ? b.sessionId : null;
  if (!sessionId) return { error: 'sessionId is required.' };
  const base = {
    sessionId,
    device: DEVICES.includes(b.device) ? b.device : 'desktop',
    browser: str(b.browser, 40),
    connection: str(b.connection, 20),
    release: str(b.release, 40),
  };
  const docs = [];
  for (const e of Array.isArray(b.events) ? b.events.slice(0, MAX_BATCH) : []) {
    if (!e || !['view', 'vital', 'error', 'problem'].includes(e.type)) continue;
    const page = templatePage(e.page);
    // Never store the developer console or admin pages as "user" experience.
    if (/^\/(developer|dashboard)(\/|$)/.test(page)) continue;
    const t = Number(new Date(e.at));
    const doc = { ...base, type: e.type, page, at: new Date(Number.isFinite(t) && t <= now + 300_000 && t >= now - 86_400_000 ? t : now) };
    if (e.type === 'vital') {
      if (!METRICS.includes(e.metric)) continue;
      doc.metric = e.metric;
      doc.value = num(e.value, e.metric === 'CLS' ? 10 : 120_000);
      if (doc.value === null) continue;
      doc.rating = RATINGS.includes(e.rating) ? e.rating : rate(e.metric, doc.value);
      doc.navigationType = str(e.navigationType, 20);
    } else if (e.type === 'view') {
      doc.loadMs = num(e.loadMs, 120_000);
    } else {
      if (e.type === 'problem') {
        if (!PROBLEM_KINDS.includes(e.kind)) continue;
        doc.kind = e.kind;
        doc.status = Number.isInteger(e.status) && e.status >= 0 && e.status < 600 ? e.status : null;
      }
      doc.message = maskLabel(e.message, 300) || '(no message)';
      doc.source = str(e.source, 200);
      doc.trail = normalizeTrail(e.trail, now);
      doc.fingerprint = crypto.createHash('sha1').update(`${doc.message.replace(/\d+/g, '#')}|${(doc.source || '').replace(/[?#].*$|:\d+:\d+$/g, '')}`).digest('hex').slice(0, 16);
    }
    docs.push(doc);
  }
  return { docs };
}

async function ingest(req, res) {
  // sendBeacon posts text/plain; parse it ourselves.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).end();
    }
  }
  const { docs, error } = normalize(body);
  if (error) return res.status(400).json({ success: false, message: error });
  if (docs.length) await require('../../models/RumEvent').insertMany(docs, { ordered: false });
  return res.status(204).end();
}

const p75 = (sorted) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.75 * sorted.length))] : null);

async function summary({ days = 7 } = {}) {
  const RumEvent = require('../../models/RumEvent');
  const from = new Date(Date.now() - days * 86_400_000);
  const match = { at: { $gte: from } };
  const bucket = days <= 1 ? 3_600_000 : 86_400_000;
  const [vitals, views, errors, sessions, series, errorSessions] = await Promise.all([
    RumEvent.aggregate([
      { $match: { ...match, type: 'vital' } },
      { $sort: { value: 1 } },
      { $group: { _id: { m: '$metric', p: '$page' }, values: { $push: '$value' }, good: { $sum: { $cond: [{ $eq: ['$rating', 'good'] }, 1, 0] } }, poor: { $sum: { $cond: [{ $eq: ['$rating', 'poor'] }, 1, 0] } } } },
    ]),
    RumEvent.aggregate([
      { $match: { ...match, type: 'view' } },
      { $group: { _id: { p: '$page', d: '$device', b: '$browser' }, n: { $sum: 1 }, loads: { $push: '$loadMs' } } },
    ]),
    RumEvent.aggregate([
      { $match: { ...match, type: 'error' } },
      { $sort: { at: -1 } },
      { $group: { _id: '$fingerprint', n: { $sum: 1 }, sessions: { $addToSet: '$sessionId' }, message: { $first: '$message' }, source: { $first: '$source' }, pages: { $addToSet: '$page' }, browsers: { $addToSet: '$browser' }, last: { $first: '$at' }, first: { $last: '$at' } } },
      { $project: { _id: 0, fingerprint: '$_id', n: 1, sessions: { $size: '$sessions' }, message: 1, source: 1, pages: { $slice: ['$pages', 5] }, browsers: 1, last: 1, first: 1 } },
      { $sort: { sessions: -1, n: -1 } },
      { $limit: 50 },
    ]),
    RumEvent.distinct('sessionId', match),
    RumEvent.aggregate([
      { $match: { ...match, type: { $in: ['view', 'error'] } } },
      { $group: { _id: { $toDate: { $subtract: [{ $toLong: '$at' }, { $mod: [{ $toLong: '$at' }, bucket] }] } }, views: { $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] } }, errors: { $sum: { $cond: [{ $eq: ['$type', 'error'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, t: '$_id', views: 1, errors: 1 } },
    ]),
    RumEvent.distinct('sessionId', { ...match, type: 'error' }),
  ]);

  // Overall p75 per metric, and per page.
  const overall = Object.fromEntries(METRICS.map((m) => [m, { values: [], good: 0, poor: 0 }]));
  const pages = new Map();
  for (const v of vitals) {
    const o = overall[v._id.m];
    o.values.push(...v.values);
    o.good += v.good;
    o.poor += v.poor;
    const p = pages.get(v._id.p) || { page: v._id.p, views: 0, errors: 0, sessions: 0, vitals: {} };
    p.vitals[v._id.m] = { p75: p75(v.values), samples: v.values.length };
    pages.set(v._id.p, p);
  }
  const deviceViews = {};
  const browserViews = {};
  for (const v of views) {
    const p = pages.get(v._id.p) || { page: v._id.p, views: 0, errors: 0, vitals: {} };
    p.views += v.n;
    pages.set(v._id.p, p);
    deviceViews[v._id.d || 'desktop'] = (deviceViews[v._id.d || 'desktop'] || 0) + v.n;
    browserViews[v._id.b || 'other'] = (browserViews[v._id.b || 'other'] || 0) + v.n;
  }
  for (const e of errors) for (const pg of e.pages) if (pages.has(pg)) pages.get(pg).errors += e.n;
  const metrics = METRICS.map((m) => {
    const o = overall[m];
    const sorted = o.values.sort((a, b) => a - b);
    const value = p75(sorted);
    return { metric: m, p75: value, rating: rate(m, value), samples: sorted.length, goodShare: sorted.length ? Math.round((o.good / sorted.length) * 1000) / 10 : null, poorShare: sorted.length ? Math.round((o.poor / sorted.length) * 1000) / 10 : null, thresholds: THRESHOLDS[m] };
  });
  const totalViews = views.reduce((a, v) => a + v.n, 0);
  return {
    days,
    bucketMs: bucket,
    sessions: sessions.length,
    views: totalViews,
    errorCount: errors.reduce((a, e) => a + e.n, 0),
    crashFreeSessions: sessions.length ? Math.round((1 - errorSessions.length / sessions.length) * 1000) / 10 : null,
    metrics,
    pages: [...pages.values()].map((p) => ({ ...p, worst: METRICS.map((m) => rate(m, p.vitals[m]?.p75 ?? null)).includes('poor') ? 'poor' : METRICS.map((m) => rate(m, p.vitals[m]?.p75 ?? null)).includes('needs-improvement') ? 'needs-improvement' : Object.keys(p.vitals).length ? 'good' : null })).sort((a, b) => b.views - a.views).slice(0, 50),
    errors,
    devices: deviceViews,
    browsers: browserViews,
    series,
  };
}

module.exports = { templatePage, rate, normalize, ingest, summary, THRESHOLDS, maskLabel, normalizeTrail, PROBLEM_KINDS };
