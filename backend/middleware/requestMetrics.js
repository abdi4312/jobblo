const ApiMetricMinute = require('../models/ApiMetricMinute');
const securityEvents = require('../services/monitoring/securityEvents');

/**
 * Per-route request metrics for the developer dashboard.
 *
 * Every finished /api request lands in an in-memory bucket keyed by method + route
 * template; once a minute the buckets are flushed to ApiMetricMinute.
 *
 * ponytail: per-process and approximate — per-minute percentiles come from a
 * 200-sample reservoir, range percentiles are count-weighted averages of those,
 * and up to 60s of data is lost on crash. Several instances each write their own
 * rows, which the aggregations still sum correctly. Move to Prometheus/OpenTelemetry
 * if exact percentiles are ever needed.
 */

const SAMPLE_CAP = 200;
const FLUSH_MS = 60 * 1000;
const TRACKED_CODES = [400, 401, 403, 404, 429, 500];
const IP_CAP_PER_BUCKET = 500; // distinct IPs tracked per route per minute
const IP_TOP_STORED = 50; // stored per row; the remainder goes to ipsOther

let buckets = new Map();
let activeRequests = 0;
const recent = []; // last 60s: [{ t, ms, err }]

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, idx))];
}

function routeOf(req) {
  // Rejected before routing (401/429/404): group by the first two segments after /api,
  // which keeps cardinality bounded even under random-path scanning.
  if (!req.route) {
    const parts = req.originalUrl.split('?')[0].split('/').filter(Boolean).slice(0, 3);
    return `/${parts.join('/')}/*`;
  }
  const path = Array.isArray(req.route.path) ? req.route.path.join('|') : String(req.route.path);
  return `${req.baseUrl || ''}${path}` || '/';
}

/** Latency SLO threshold: a request slower than this counts against the latency budget. */
const SLOW_REQUEST_MS = Number(process.env.SLO_LATENCY_MS) || 1000;

function record(method, route, status, ms, ip = null) {
  const key = `${method} ${route}`;
  let b = buckets.get(key);
  if (!b) {
    b = { method, route, count: 0, failed: 0, slow: 0, durSum: 0, durMax: 0, codes: {}, samples: [], ips: new Map(), ipsOther: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (status >= 400) b.failed += 1;
  if (ip) {
    let c = b.ips.get(ip);
    if (!c && b.ips.size >= IP_CAP_PER_BUCKET) b.ipsOther += 1;
    else {
      if (!c) b.ips.set(ip, (c = { n: 0, failed: 0 }));
      c.n += 1;
      if (status >= 400) c.failed += 1;
    }
  }
  b.codes[status] = (b.codes[status] || 0) + 1;
  b.durSum += ms;
  if (ms > SLOW_REQUEST_MS) b.slow += 1; // exact count for the latency SLO
  if (ms > b.durMax) b.durMax = ms;
  // Reservoir sampling keeps an unbiased sample once the cap is reached.
  if (b.samples.length < SAMPLE_CAP) b.samples.push(ms);
  else {
    const j = Math.floor(Math.random() * b.count);
    if (j < SAMPLE_CAP) b.samples[j] = ms;
  }

  const now = Date.now();
  recent.push({ t: now, ms, err: status >= 500 });
  while (recent.length && recent[0].t < now - 60000) recent.shift();
}

function toRow(b, minute) {
  const sorted = [...b.samples].sort((x, y) => x - y);
  const row = {
    minute,
    method: b.method,
    route: b.route,
    count: b.count,
    failed: b.failed,
    slow: b.slow || 0,
    durSum: b.durSum,
    durMax: b.durMax,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    c2xx: 0,
    c3xx: 0,
    c4xx: 0,
    c5xx: 0,
    ips: [],
    ipsOther: b.ipsOther || 0,
  };
  const ipList = [...(b.ips || new Map()).entries()].sort((x, y) => y[1].n - x[1].n);
  row.ips = ipList.slice(0, IP_TOP_STORED).map(([ip, c]) => ({ ip, n: c.n, failed: c.failed }));
  row.ipsOther += ipList.slice(IP_TOP_STORED).reduce((sum, [, c]) => sum + c.n, 0);
  for (const [code, count] of Object.entries(b.codes)) {
    const c = Number(code);
    const family = `c${Math.floor(c / 100)}xx`;
    if (family in row) row[family] += count;
    if (TRACKED_CODES.includes(c)) row[`c${c}`] = count;
  }
  return row;
}

function requestMetrics(req, res, next) {
  if (!req.originalUrl.startsWith('/api/')) return next();
  const start = process.hrtime.bigint();
  activeRequests += 1;
  // Remember the machine-readable error code (TOKEN_EXPIRED, …) for security classification.
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body && typeof body === 'object') res.locals.errorCode = body.code || body.error?.code || null;
    return json(body);
  };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    activeRequests -= 1;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    record(req.method, routeOf(req), res.statusCode, Math.round(ms * 10) / 10, securityEvents.clientIp(req));
    securityEvents.record(req, res);
  };
  res.on('finish', finish);
  res.on('close', finish);
  next();
}

async function flush() {
  if (!buckets.size) return;
  const current = buckets;
  buckets = new Map();
  const minute = new Date(Math.floor(Date.now() / FLUSH_MS) * FLUSH_MS);
  try {
    await ApiMetricMinute.insertMany([...current.values()].map((b) => toRow(b, minute)), { ordered: false });
  } catch (err) {
    console.error('[requestMetrics] flush failed:', err.message);
  }
}

let timer = null;
function startMetricsFlush() {
  if (timer || process.env.NODE_ENV === 'test') return;
  timer = setInterval(flush, FLUSH_MS);
  if (timer.unref) timer.unref();
}

/** Live snapshot of the last 60 seconds (this process only). */
function liveSnapshot() {
  const now = Date.now();
  const last10 = recent.filter((r) => r.t >= now - 10000).length;
  const sorted = recent.map((r) => r.ms).sort((a, b) => a - b);
  return {
    activeRequests,
    rps: Math.round((last10 / 10) * 10) / 10,
    requestsLastMin: recent.length,
    errorsLastMin: recent.filter((r) => r.err).length,
    p95LastMin: percentile(sorted, 95),
  };
}

module.exports = { requestMetrics, startMetricsFlush, liveSnapshot, percentile, toRow, routeOf };
