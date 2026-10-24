const { monitorEventLoopDelay, PerformanceObserver, constants: perfConstants } = require('perf_hooks');
const v8 = require('v8');
const { percentile, liveSnapshot } = require('../../middleware/requestMetrics');

/**
 * In-process APM: event-loop delay, GC, heap/CPU, MongoDB command latency and
 * Stripe API latency, sampled into a 60-minute rolling history.
 *
 * ponytail: per-process memory only (lost on restart, one instance's view). Query
 * shapes keep filter KEYS only — never values. Upgrade path: OpenTelemetry exporter.
 */

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 100);
const HISTORY = 60;
const SAMPLE_CAP = 300;

const history = []; // per-minute samples
const slowQueries = []; // newest first, max 100
let loop = null;
let gc = { count: 0, ms: 0, byKind: {} };
let db = new Map(); // "find users" -> { count, sum, max, samples[] }
let stripe = new Map(); // "GET /v1/payment_intents/:id" -> same
let lastCpu = process.cpuUsage();
let lastTick = Date.now();
let started = false;
let sessionsOnline = null;

const GC_KINDS = {
  [perfConstants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
  [perfConstants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
  [perfConstants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
  [perfConstants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb',
};

function bump(map, key, ms) {
  let s = map.get(key);
  if (!s) map.set(key, (s = { count: 0, sum: 0, max: 0, samples: [] }));
  s.count += 1;
  s.sum += ms;
  if (ms > s.max) s.max = ms;
  if (s.samples.length < SAMPLE_CAP) s.samples.push(ms);
  else s.samples[Math.floor(Math.random() * SAMPLE_CAP)] = ms;
}

function summarize(map) {
  return [...map.entries()]
    .map(([key, s]) => {
      const sorted = [...s.samples].sort((a, b) => a - b);
      return { key, count: s.count, avgMs: Math.round(s.sum / s.count), p95: Math.round(percentile(sorted, 95)), maxMs: Math.round(s.max) };
    })
    .sort((a, b) => b.p95 - a.p95);
}

/** Keys of a filter, recursively, values replaced — safe to show and to group by. */
function shape(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 3) return '?';
  if (Array.isArray(obj)) return obj.length ? [shape(obj[0], depth + 1)] : [];
  return Object.fromEntries(Object.keys(obj).slice(0, 15).map((k) => [k, typeof obj[k] === 'object' && obj[k] !== null && !(obj[k] instanceof Date) && !obj[k]._bsontype ? shape(obj[k], depth + 1) : '?']));
}

function attachMongo(mongoose) {
  const pending = new Map();
  const client = mongoose.connection.getClient();
  client.on('commandStarted', (e) => {
    const coll = e.command?.[e.commandName];
    if (typeof coll !== 'string' || ['ping', 'hello', 'isMaster', 'endSessions', 'saslContinue', 'saslStart', 'buildInfo'].includes(e.commandName)) return;
    pending.set(e.requestId, { coll, filter: e.command.filter || e.command.q || e.command.pipeline?.[0]?.$match || null });
  });
  const done = (failed) => (e) => {
    const p = pending.get(e.requestId);
    if (!p) return;
    pending.delete(e.requestId);
    const msTaken = e.duration;
    bump(db, `${e.commandName} ${p.coll}`, msTaken);
    if (msTaken >= SLOW_QUERY_MS || failed) {
      slowQueries.unshift({ at: new Date(), command: e.commandName, collection: p.coll, ms: Math.round(msTaken), failed, shape: shape(p.filter) });
      slowQueries.length = Math.min(slowQueries.length, 100);
    }
  };
  client.on('commandSucceeded', done(false));
  client.on('commandFailed', done(true));
}

/** Called from config/stripe.js for every Stripe API response. */
function recordStripe({ method, path, elapsed, status }) {
  // Stripe ids are prefix_ + mixed case/digits; path words like payment_intents are all lowercase.
  const op = require('./externalCalls').templateOp(method, path);
  bump(stripe, op, Number(elapsed) || 0);
  if (status >= 500) bump(stripe, '__errors__', 0);
  require('./externalCalls').record({ service: 'stripe', op, ms: Number(elapsed) || 0, status });
}

async function tick() {
  const now = Date.now();
  const cpu = process.cpuUsage(lastCpu);
  const elapsedMs = now - lastTick;
  lastCpu = process.cpuUsage();
  lastTick = now;
  const mem = process.memoryUsage();
  const ns = (v) => Math.round((v / 1e6) * 10) / 10;
  try {
    const Session = require('../../models/Session');
    sessionsOnline = await Session.countDocuments({ lastUsed: { $gte: new Date(now - 5 * 60 * 1000) } });
  } catch {
    /* db down — keep last value */
  }
  history.push({
    t: new Date(now),
    loopP50: loop ? ns(loop.percentile(50)) : null,
    loopP99: loop ? ns(loop.percentile(99)) : null,
    loopMax: loop ? ns(loop.max) : null,
    heapUsed: mem.heapUsed,
    rss: mem.rss,
    cpu: Math.round(((cpu.user + cpu.system) / 1000 / elapsedMs) * 1000) / 10,
    gcCount: gc.count,
    gcMs: Math.round(gc.ms),
    rps: liveSnapshot().rps,
    sessionsOnline,
  });
  if (history.length > HISTORY) history.shift();
  loop?.reset();
  gc = { count: 0, ms: 0, byKind: gc.byKind };
}

function startApm(mongoose) {
  if (started || process.env.NODE_ENV === 'test') return;
  started = true;
  loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      gc.count += 1;
      gc.ms += e.duration;
      const kind = GC_KINDS[e.detail?.kind] || 'other';
      gc.byKind[kind] = (gc.byKind[kind] || 0) + 1;
    }
  }).observe({ entryTypes: ['gc'] });
  try {
    attachMongo(mongoose);
  } catch (err) {
    console.error('[apm] mongo monitoring unavailable:', err.message);
  }
  const t = setInterval(tick, 60 * 1000);
  if (t.unref) t.unref();
  tick();
}

function snapshot() {
  const heap = v8.getHeapStatistics();
  const ns = (v) => (loop ? Math.round((v / 1e6) * 10) / 10 : null);
  return {
    enabled: started,
    eventLoop: loop ? { p50: ns(loop.percentile(50)), p99: ns(loop.percentile(99)), max: ns(loop.max), mean: ns(loop.mean) } : null,
    heap: { used: heap.used_heap_size, total: heap.total_heap_size, limit: heap.heap_size_limit, external: process.memoryUsage().external },
    gc: { lastMinuteCount: gc.count, lastMinuteMs: Math.round(gc.ms), byKindSinceStart: gc.byKind },
    db: summarize(db).slice(0, 25),
    stripe: summarize(stripe).filter((s) => s.key !== '__errors__').slice(0, 25),
    stripeErrors: stripe.get('__errors__')?.count || 0,
    slowQueries: slowQueries.slice(0, 50),
    slowQueryMs: SLOW_QUERY_MS,
    history,
    sessionsOnline,
  };
}

module.exports = { startApm, snapshot, recordStripe, shape };
