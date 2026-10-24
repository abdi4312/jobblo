const os = require('os');

/**
 * Staging failure simulator: deliberate, time-boxed faults to prove that monitoring,
 * alerts, retries and reconciliation behave when something breaks.
 *
 * Hard safety rails — a fault is only ever applied when ALL hold, checked on every call:
 *   - NODE_ENV is not "production";
 *   - ENABLE_FAILURE_SIMULATOR=true on this instance;
 *   - the Stripe key in use is not a live key (checked when an experiment starts and
 *     cached; a live key disables injection even mid-experiment).
 * The developer dashboard API, the mobile telemetry intake and health of the simulator
 * itself are never faulted. Experiments end on their own (max 60 min) and can be stopped.
 */

const REFRESH_MS = 5000;
const MAX_MINUTES = 60;
const EXCLUDED = /^\/api\/(developer|mobile\/telemetry)(\/|$)/;
const TYPES = {
  http_latency: { label: 'API latency', needsTarget: true },
  http_error: { label: 'API errors', needsTarget: true },
  stripe: { label: 'Stripe API outage' },
  email: { label: 'Email (SMTP) outage' },
  push: { label: 'Push (Firebase) outage' },
  stripe_webhook: { label: 'Stripe webhooks rejected' },
  scheduler: { label: 'Scheduler job failure' },
};

let active = [];
let liveStripe = null; // null = unknown, true = live key in use

async function refreshStripeMode() {
  try {
    const r = await require('../../config/stripe').getStripeModeReport();
    liveStripe = r.keyMode === 'live';
  } catch {
    liveStripe = null;
  }
  return liveStripe;
}

/** Why the simulator is (un)available on this instance. */
function availability(env = process.env) {
  const reasons = [];
  if (env.NODE_ENV === 'production') reasons.push('NODE_ENV is production — the simulator never runs in production.');
  if (env.ENABLE_FAILURE_SIMULATOR !== 'true') reasons.push('ENABLE_FAILURE_SIMULATOR is not "true" on this instance.');
  if (liveStripe === true) reasons.push('A live Stripe key is in use — faults could affect real money.');
  return { enabled: reasons.length === 0, reasons };
}

/** Pure: does an experiment apply to this request path / target now? Unit-tested. */
function matches(exp, { type, target, path }, now = Date.now()) {
  if (exp.type !== type || exp.stoppedAt || new Date(exp.endsAt).getTime() <= now) return false;
  if (type === 'http_latency' || type === 'http_error') return Boolean(path) && !EXCLUDED.test(path) && path.startsWith(exp.target || '/api/');
  if (type === 'scheduler') return !exp.target || exp.target === '*' || exp.target === target;
  return true;
}

function find(type, ctx = {}) {
  if (!availability().enabled) return null;
  return active.find((e) => matches(e, { type, ...ctx })) || null;
}

/** Throw if a dependency outage is being simulated. Call at the top of the real call. */
function assertNoFault(type, target) {
  const exp = find(type, { target });
  if (exp) {
    const err = new Error(`Simulated ${TYPES[type].label.toLowerCase()} (failure simulator experiment ${exp._id})`);
    err.code = 'SIMULATED_FAULT';
    throw err;
  }
}

/** Express middleware for API latency / error experiments (after requestMetrics so they are measured). */
async function faultMiddleware(req, res, next) {
  if (!active.length) return next();
  const path = req.originalUrl.split('?')[0];
  const slow = find('http_latency', { path });
  if (slow) await new Promise((r) => setTimeout(r, Math.min(slow.latencyMs || 0, 30_000)));
  const failing = find('http_error', { path });
  if (failing && Math.random() * 100 < (failing.errorRate ?? 100)) {
    return res.status(failing.statusCode || 503).json({ success: false, message: 'Simulated failure (staging failure simulator).', code: 'SIMULATED_FAULT' });
  }
  return next();
}

/** Stripe webhook guard: 503 makes Stripe retry, exactly like a real outage. */
function webhookGuard(req, res, next) {
  if (find('stripe_webhook')) return res.status(503).json({ received: false, code: 'SIMULATED_FAULT' });
  return next();
}

async function refresh() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return;
    active = await require('../../models/FailureExperiment').find({ stoppedAt: null, endsAt: { $gt: new Date() } }).lean();
    if (active.length) await refreshStripeMode();
  } catch {
    /* keep the last known list */
  }
}

function startFaults() {
  if (process.env.NODE_ENV === 'test') return;
  setInterval(refresh, REFRESH_MS).unref();
  void refresh();
}

/** Pure: validate a new experiment request. Unit-tested. */
function validate(body) {
  const type = String(body?.type || '');
  if (!TYPES[type]) return { error: 'Unknown fault type.' };
  const minutes = Number(body.durationMinutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_MINUTES) return { error: `Duration must be 1–${MAX_MINUTES} minutes.` };
  const reason = String(body.reason || '').trim();
  if (reason.length < 5) return { error: 'Give a reason (at least 5 characters).' };
  const v = { type, reason: reason.slice(0, 300), minutes, target: null, latencyMs: null, errorRate: null, statusCode: null };
  if (type === 'http_latency' || type === 'http_error') {
    const target = String(body.target || '/api/').trim();
    if (!target.startsWith('/api/') || EXCLUDED.test(target)) return { error: 'Route prefix must start with /api/ and cannot be the developer API or telemetry.' };
    v.target = target.slice(0, 200);
  }
  if (type === 'http_latency') {
    const ms = Number(body.latencyMs);
    if (!Number.isFinite(ms) || ms < 50 || ms > 30_000) return { error: 'Latency must be 50–30 000 ms.' };
    v.latencyMs = Math.round(ms);
  }
  if (type === 'http_error') {
    const rate = Number(body.errorRate);
    const code = Number(body.statusCode || 503);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return { error: 'Error rate must be 1–100 %.' };
    if (![500, 502, 503, 504].includes(code)) return { error: 'Status must be 500, 502, 503 or 504.' };
    v.errorRate = rate;
    v.statusCode = code;
  }
  if (type === 'scheduler') v.target = String(body.target || '*').slice(0, 80);
  return { value: v };
}

async function startExperiment(body, userId) {
  const { value, error } = validate(body);
  if (error) return { error, status: 400 };
  await refreshStripeMode();
  const a = availability();
  if (!a.enabled) return { error: a.reasons.join(' '), status: 403 };
  const now = new Date();
  const exp = await require('../../models/FailureExperiment').create({
    ...value,
    startedBy: userId,
    startedAt: now,
    endsAt: new Date(now.getTime() + value.minutes * 60 * 1000),
    environment: process.env.NODE_ENV || 'development',
    host: os.hostname(),
  });
  await refresh();
  return { experiment: exp };
}

async function stopExperiments(filter, userId) {
  const r = await require('../../models/FailureExperiment').updateMany({ ...filter, stoppedAt: null, endsAt: { $gt: new Date() } }, { $set: { stoppedAt: new Date(), stoppedBy: userId } });
  await refresh();
  return r.modifiedCount;
}

module.exports = { TYPES, MAX_MINUTES, availability, matches, validate, assertNoFault, faultMiddleware, webhookGuard, startFaults, startExperiment, stopExperiments, refresh, refreshStripeMode };
