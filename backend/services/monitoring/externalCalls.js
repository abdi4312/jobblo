const { percentile } = require('../../middleware/requestMetrics');

/**
 * Outbound calls to third parties (Stripe, OpenAI, ...): latency, failures, rate limits.
 * In-memory per (service, op), flushed to ExternalCallMinute every minute — same model as
 * requestMetrics. ponytail: per process; fine for one API instance.
 */

const FLUSH_MS = 60_000;
const MAX_SAMPLES = 200;
let buckets = new Map();

/** Pure: outcome of one call. Unit-tested. */
function classify(status, error) {
  const text = String(error || '');
  if (status === 429 || /rate.?limit|too many requests|quota|message-rate-exceeded|4\.7\.0|421|450|454|5\.4\.5/i.test(text)) return 'rate_limited';
  if (!status || status >= 500) return 'error';
  if (status >= 400) return 'client_error';
  return 'ok';
}

/** Pure: "/v1/customers/cus_123/sources/src_9?x" → "/v1/customers/:id/sources/:id". */
const templateOp = (method, path) => `${String(method || 'GET').toUpperCase()} ${String(path || '/').split('?')[0].replace(/\/[a-z]{2,10}_(?=[a-z]*[A-Z0-9])[A-Za-z0-9]{3,}(?=\/|$)/g, '/:id').replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:id')}`;

function record({ service, op, ms, status, error }) {
  const key = `${service}|${op}`;
  const b = buckets.get(key) || { service, op, count: 0, errors: 0, rateLimited: 0, clientErrors: 0, durSum: 0, durMax: 0, samples: [], lastError: null };
  const outcome = classify(status, error);
  b.count += 1;
  b.durSum += ms || 0;
  b.durMax = Math.max(b.durMax, ms || 0);
  if (b.samples.length < MAX_SAMPLES) b.samples.push(ms || 0);
  if (outcome === 'error') b.errors += 1;
  if (outcome === 'rate_limited') b.rateLimited += 1;
  if (outcome === 'client_error') b.clientErrors += 1;
  if (outcome !== 'ok') b.lastError = `${status || 'network'}${error ? ` ${String(error).slice(0, 200)}` : ''}`;
  buckets.set(key, b);
}

/** A fetch that records every call; pass to SDKs that accept a custom fetch (OpenAI). */
const timedFetch = (service) => async (url, init = {}) => {
  const started = Date.now();
  const op = templateOp(init.method, new URL(String(url?.url || url)).pathname);
  try {
    const res = await fetch(url, init);
    record({ service, op, ms: Date.now() - started, status: res.status, error: res.ok ? null : res.statusText });
    return res;
  } catch (e) {
    record({ service, op, ms: Date.now() - started, status: null, error: e.name === 'AbortError' ? 'timeout' : e.message });
    throw e;
  }
};

async function flush() {
  if (!buckets.size) return;
  const current = buckets;
  buckets = new Map();
  const minute = new Date(Math.floor(Date.now() / FLUSH_MS) * FLUSH_MS);
  const rows = [...current.values()].map(({ samples, errors, ...b }) => ({ ...b, failed: errors, minute, p95: percentile(samples.sort((x, y) => x - y), 95) }));
  try {
    await require('../../models/ExternalCallMinute').insertMany(rows, { ordered: false });
  } catch (err) {
    console.error('[externalCalls] flush failed:', err.message);
  }
}

let timer = null;
function startExternalFlush() {
  if (timer || process.env.NODE_ENV === 'test') return;
  timer = setInterval(flush, FLUSH_MS);
  if (timer.unref) timer.unref();
}

/**
 * Pure: fold call rows (minute aggregates or single events, both shaped like
 * ExternalCallMinute) into totals, a time series and per-op stats. p95 is the
 * count-weighted percentile of the rows' p95 — exact for single events,
 * approximate for minute rows. Unit-tested.
 */
function fold(rows, bucketMs) {
  const t = { calls: 0, errors: 0, rateLimited: 0, clientErrors: 0, durSum: 0, maxMs: 0, lastError: null, lastErrorAt: null };
  const series = new Map();
  const ops = new Map();
  for (const r of rows) {
    t.calls += r.count;
    t.errors += r.errors || 0;
    t.rateLimited += r.rateLimited || 0;
    t.clientErrors += r.clientErrors || 0;
    t.durSum += r.durSum || 0;
    t.maxMs = Math.max(t.maxMs, r.durMax || 0);
    if (r.lastError && (!t.lastErrorAt || r.minute > t.lastErrorAt)) Object.assign(t, { lastError: r.lastError, lastErrorAt: r.minute });
    const k = new Date(Math.floor(+new Date(r.minute) / bucketMs) * bucketMs).toISOString();
    const s = series.get(k) || { t: k, calls: 0, errors: 0, rateLimited: 0, rows: [] };
    s.calls += r.count;
    s.errors += r.errors || 0;
    s.rateLimited += r.rateLimited || 0;
    s.rows.push(r);
    series.set(k, s);
    const o = ops.get(r.op) || { op: r.op, calls: 0, failed: 0, rateLimited: 0, durSum: 0, rows: [] };
    o.calls += r.count;
    o.failed += (r.errors || 0) + (r.rateLimited || 0);
    o.rateLimited += r.rateLimited || 0;
    o.durSum += r.durSum || 0;
    o.rows.push(r);
    ops.set(r.op, o);
  }
  const wp95 = (list) => {
    const sorted = [...list].sort((a, b) => a.p95 - b.p95);
    const total = sorted.reduce((a, r) => a + r.count, 0);
    let seen = 0;
    for (const r of sorted) if ((seen += r.count) >= 0.95 * total) return Math.round(r.p95);
    return null;
  };
  return {
    ...t,
    errorRate: t.calls ? Math.round(((t.errors + t.rateLimited) / t.calls) * 10000) / 100 : null,
    avgMs: t.calls ? Math.round(t.durSum / t.calls) : null,
    p95: wp95(rows),
    series: [...series.values()].sort((a, b) => a.t.localeCompare(b.t)).map(({ rows: r, ...s }) => ({ ...s, p95: wp95(r) })),
    ops: [...ops.values()].sort((a, b) => b.calls - a.calls).slice(0, 10).map(({ rows: r, durSum, ...o }) => ({ ...o, avgMs: o.calls ? Math.round(durSum / o.calls) : null, p95: wp95(r) })),
  };
}

const event = (minute, op, ms, outcome, lastError) => ({
  minute,
  op,
  count: 1,
  errors: outcome === 'error' ? 1 : 0,
  rateLimited: outcome === 'rate_limited' ? 1 : 0,
  clientErrors: outcome === 'client_error' ? 1 : 0,
  durSum: ms || 0,
  durMax: ms || 0,
  p95: ms || 0,
  lastError: outcome === 'ok' ? null : lastError || 'failed',
});

const health = (f, configured) => (!configured ? 'off' : !f.calls ? 'idle' : f.rateLimited ? 'throttled' : f.errorRate >= 5 ? 'degraded' : 'healthy');

/** Peak calls in any one minute, for rate-limit headroom. */
function peakPerMinute(rows) {
  const by = {};
  for (const r of rows) by[+new Date(r.minute)] = (by[+new Date(r.minute)] || 0) + r.count;
  return Math.max(0, ...Object.values(by));
}

async function summary({ hours = 24 } = {}) {
  const from = new Date(Date.now() - hours * 3_600_000);
  const bucketMs = hours <= 24 ? 3_600_000 : 6 * 3_600_000;
  const [minutes, deliveries, geo] = await Promise.all([
    require('../../models/ExternalCallMinute').find({ minute: { $gte: from } }).lean().then((rows) => rows.map(({ failed, ...r }) => ({ ...r, errors: failed }))),
    require('../../models/DeliveryLog').find({ at: { $gte: from }, status: { $ne: 'skipped' } }).select('at channel status latencyMs error errorCode').lean(),
    require('../../models/SyntheticRun').find({ key: 'geonorge', at: { $gte: from } }).select('at ok latencyMs status error').lean(),
  ]);
  const env = process.env;
  const stripeCfg = await require('../../config/stripe').getStripeConfiguration().catch(() => null);
  const stripeLive = stripeCfg ? !stripeCfg.testMode : false;
  const stripeLimit = stripeLive ? 100 : 25;
  const deliveryRows = (channel) =>
    deliveries
      .filter((d) => d.channel === channel)
      .map((d) => {
        const why = `${d.errorCode || ''} ${d.error || ''}`.trim();
        return event(d.at, channel === 'email' ? 'SMTP send' : 'FCM send', d.latencyMs, d.status === 'sent' ? 'ok' : classify(null, why), why);
      });
  const lastDay = (rows) => rows.filter((r) => +new Date(r.minute) >= Date.now() - 86_400_000).reduce((a, r) => a + r.count, 0);
  const smtpQuota = Number(env.SMTP_DAILY_QUOTA) || (/gmail/i.test(env.SMTP_HOST || 'smtp.gmail.com') ? 500 : 0);

  const services = [
    {
      key: 'stripe',
      name: 'Stripe API',
      usedFor: 'Checkout, payments, refunds, Connect payouts, subscriptions',
      configured: Boolean(env.STRIPE_SECRET_KEY || env.STRIPE_TEST_SECRET_KEY),
      rows: minutes.filter((m) => m.service === 'stripe'),
      quota: (rows) => ({ label: `Rate limit ${stripeLimit} req/s (${stripeLive ? 'live' : 'test'} mode)`, used: peakPerMinute(rows), limit: stripeLimit * 60, unit: 'calls in the busiest minute' }),
    },
    {
      key: 'email',
      name: 'Email (SMTP)',
      usedFor: 'Verification, password reset, receipts, job notifications',
      configured: Boolean(env.SMTP_USER && env.SMTP_PASS),
      rows: deliveryRows('email'),
      quota: (rows) => (smtpQuota ? { label: `${env.SMTP_DAILY_QUOTA ? 'SMTP_DAILY_QUOTA' : 'Gmail sending limit'} ${smtpQuota}/day`, used: lastDay(rows), limit: smtpQuota, unit: 'emails in the last 24 h' } : null),
    },
    {
      key: 'push',
      name: 'Push (Firebase Cloud Messaging)',
      usedFor: 'Mobile push notifications',
      configured: Boolean(env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_CONFIG || env.FIREBASE_PROJECT_ID),
      rows: deliveryRows('push'),
      quota: () => null,
    },
    {
      key: 'openai',
      name: 'OpenAI',
      usedFor: 'AI job-listing assistant (text and image)',
      configured: Boolean(env.OPENAI_API_KEY),
      rows: minutes.filter((m) => m.service === 'openai'),
      quota: (rows) => (Number(env.OPENAI_RPM_LIMIT) ? { label: `OPENAI_RPM_LIMIT ${env.OPENAI_RPM_LIMIT}/min`, used: peakPerMinute(rows), limit: Number(env.OPENAI_RPM_LIMIT), unit: 'requests in the busiest minute' } : null),
    },
    {
      key: 'geocoding',
      name: 'Geocoding (Geonorge)',
      usedFor: 'Address search in the app. The web uses Google Maps in the browser — its failures show under Real Users.',
      configured: env.SYNTHETIC_GEO !== 'false',
      probe: true,
      rows: geo.map((g) => event(g.at, 'GET /adresser/v1/sok (probe)', g.latencyMs, g.ok ? 'ok' : classify(g.status, g.error || 'failed'), `${g.status || ''} ${g.error || ''}`.trim())),
      quota: () => null,
    },
  ];
  return {
    hours,
    bucketMs,
    services: services.map(({ rows, quota, ...s }) => {
      const f = fold(rows, bucketMs);
      const q = quota(rows);
      return { ...s, status: health(f, s.configured), ...f, quota: q ? { ...q, pct: q.limit ? Math.round((q.used / q.limit) * 1000) / 10 : null } : null };
    }),
  };
}

module.exports = { classify, templateOp, record, timedFetch, flush, startExternalFlush, fold, summary };
