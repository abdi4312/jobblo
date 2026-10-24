const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/**
 * Configuration drift detection.
 *
 *   1. Fingerprints of the running configuration (env vars declared in .env.example,
 *      installed package versions, Node/app version, GlobalConfig entries) recorded on boot.
 *      A developer accepts one as the baseline; everything that differs is drift.
 *   2. Policy rules: settings that must hold (in production especially).
 *   3. Declared vs. installed dependency versions.
 *   4. Stripe webhook subscriptions vs. the event types the code handles.
 * Secret values never leave the process: only "set / unset / changed" is reported.
 */

const ROOT = path.join(__dirname, '..', '..');
const fp = (v) => (v === undefined || v === null || v === '' ? null : crypto.createHash('sha256').update(`jobblo-config|${v}`).digest('hex').slice(0, 16));
const model = (name) => require(`../../models/${name}`);

/** Env vars the app declares (keys in .env.example). */
function declaredEnv() {
  try {
    return [...new Set(fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8').split(/\r?\n/).map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1]).filter(Boolean))].sort();
  } catch {
    return [];
  }
}

function packageState() {
  const pkg = require(path.join(ROOT, 'package.json'));
  const deps = { ...(pkg.dependencies || {}) };
  return Object.keys(deps)
    .sort()
    .map((name) => {
      let installed = null;
      try {
        installed = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version;
      } catch {
        /* not installed */
      }
      return { name, wanted: deps[name], installed };
    });
}

async function currentState() {
  const { identity } = require('./deployments');
  const id = identity();
  const env = declaredEnv().map((k) => [k, fp(process.env[k]) || '']);
  const packages = packageState().map((p) => [p.name, p.installed || '']);
  const configs = await model('GlobalConfig').find().select('key value').lean().catch(() => []);
  const globalConfig = configs.map((c) => [c.key, fp(JSON.stringify(c.value)) || '']).sort((a, b) => a[0].localeCompare(b[0]));
  const nodeVersion = process.version;
  const digest = crypto.createHash('sha256').update(JSON.stringify([nodeVersion, id.version, id.commit, env, packages, globalConfig])).digest('hex').slice(0, 20);
  return { nodeVersion, version: id.version, commit: id.commit, env, packages, globalConfig, digest };
}

/** Pure: what changed between two states. Unit-tested. */
function diffStates(from, to) {
  const out = [];
  const map = (pairs) => new Map((pairs || []).map(([k, v]) => [k, v || '']));
  const area = (name, a, b, label = (k) => k) => {
    const A = map(a);
    const B = map(b);
    for (const [k, v] of B) {
      if (!A.has(k)) out.push({ area: name, key: label(k), change: v ? 'added' : 'declared' });
      else if (A.get(k) !== v) out.push({ area: name, key: label(k), change: !A.get(k) ? 'set' : !v ? 'unset' : 'changed' });
    }
    for (const [k, v] of A) if (!B.has(k)) out.push({ area: name, key: label(k), change: v ? 'removed' : 'undeclared' });
  };
  if (from.nodeVersion !== to.nodeVersion) out.push({ area: 'runtime', key: 'Node.js', change: 'changed', from: from.nodeVersion, to: to.nodeVersion });
  if (from.version !== to.version || from.commit !== to.commit) out.push({ area: 'runtime', key: 'App release', change: 'changed', from: `${from.version}@${from.commit || '?'}`, to: `${to.version}@${to.commit || '?'}` });
  area('env', from.env, to.env);
  // Package values are versions, not secrets — show them.
  const A = map(from.packages);
  for (const [k, v] of map(to.packages)) {
    if (!A.has(k)) out.push({ area: 'packages', key: k, change: 'added', to: v || null });
    else if (A.get(k) !== v) out.push({ area: 'packages', key: k, change: 'changed', from: A.get(k) || null, to: v || null });
  }
  for (const [k, v] of A) if (!map(to.packages).has(k)) out.push({ area: 'packages', key: k, change: 'removed', from: v || null });
  area('globalConfig', from.globalConfig, to.globalConfig);
  return out;
}

/** Called once after listen: store a boot snapshot when the configuration changed. */
async function recordBoot() {
  try {
    const state = await currentState();
    const last = await model('ConfigSnapshot').findOne({ kind: 'boot' }).sort({ at: -1 }).select('digest').lean();
    if (last?.digest === state.digest) return null;
    return await model('ConfigSnapshot').create({ ...state, at: new Date(), kind: 'boot', host: os.hostname() });
  } catch (e) {
    console.error('[config-drift] could not record boot:', e.message);
    return null;
  }
}

/** Pure-ish policy rules over an env object (defaults to process.env). Unit-tested. */
function policyChecks(env = process.env, extra = {}) {
  const prod = env.NODE_ENV === 'production';
  const rules = [];
  const rule = (key, title, severity, ok, detail, prodOnly = false) => rules.push({ key, title, severity, ok: prodOnly && !prod ? null : Boolean(ok), detail, prodOnly });
  const len = (k) => String(env[k] || '').length;
  const origins = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

  rule('node_env', 'NODE_ENV is set', 'medium', Boolean(env.NODE_ENV), env.NODE_ENV ? `NODE_ENV=${env.NODE_ENV}` : 'NODE_ENV is unset — production hardening (secure cookies, no API docs) is off.');
  if (extra.stripe) {
    const s = extra.stripe;
    rule('stripe_mode_mismatch', 'Stripe toggle matches the key in use', 'critical', !s.mismatch, s.mismatch ? `Toggle says ${s.toggleTestMode ? 'test' : 'live'} but the key is ${s.keyMode}.` : `Using a ${s.keyMode} key.`);
    rule('stripe_live_in_prod', 'Production uses a live Stripe key', 'high', s.keyMode === 'live', `Key mode: ${s.keyMode}.`, true);
    rule('stripe_webhook_secret', 'Stripe webhook secret configured', 'high', s.webhookConfigured, s.webhookConfigured ? `${s.webhookVarName} is set.` : `${s.webhookVarName} is missing — webhooks cannot be verified.`);
  }
  rule('jwt_secret', 'JWT secrets are strong and distinct', 'high', len('JWT_SECRET') >= 32 && len('JWT_REFRESH_SECRET') >= 32 && env.JWT_SECRET !== env.JWT_REFRESH_SECRET, `JWT_SECRET ${len('JWT_SECRET')} chars, JWT_REFRESH_SECRET ${len('JWT_REFRESH_SECRET')} chars${env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET ? ', identical' : ''} (need ≥ 32 and different).`);
  rule('session_secret', 'Session secret is strong', 'medium', len('SESSION_SECRET') >= 32, `SESSION_SECRET ${len('SESSION_SECRET')} chars (need ≥ 32).`);
  rule('host_bind', 'API listens on localhost only (behind nginx)', 'high', ['127.0.0.1', 'localhost', '::1'].includes(env.HOST), env.HOST ? `HOST=${env.HOST}` : 'HOST unset — listens on all interfaces; port 5001 is reachable unless firewalled.', true);
  rule('api_docs', 'Swagger docs are off', 'medium', env.ENABLE_API_DOCS !== 'true', env.ENABLE_API_DOCS === 'true' ? 'ENABLE_API_DOCS=true exposes the API surface publicly.' : 'API docs disabled.', true);
  rule('cors', 'CORS origins are explicit https origins', 'high', origins.length > 0 && origins.every((o) => o !== '*' && o.startsWith('https://')), origins.length ? `ALLOWED_ORIGINS: ${origins.join(', ')}` : 'ALLOWED_ORIGINS unset — falls back to FRONTEND_URL.', true);
  rule('frontend_https', 'FRONTEND_URL uses https', 'medium', String(env.FRONTEND_URL || '').startsWith('https://'), `FRONTEND_URL=${env.FRONTEND_URL || 'unset'}`, true);
  rule('trust_proxy', 'Proxy trust is not "true"', 'medium', String(env.TRUST_PROXY || '').toLowerCase() !== 'true', env.TRUST_PROXY ? `TRUST_PROXY=${env.TRUST_PROXY}` : "default 'loopback' (nginx on the same host).");
  rule('mongo_auth', 'MongoDB connection uses credentials', 'high', /^mongodb(\+srv)?:\/\/[^/]*@/.test(String(env.MONGO_URI || '')), /^mongodb(\+srv)?:\/\/[^/]*@/.test(String(env.MONGO_URI || '')) ? 'Credentials present in MONGO_URI.' : 'MONGO_URI has no user — the database accepts unauthenticated connections.', true);
  rule('backups', 'Database backups configured', 'high', Boolean(env.BACKUP_DIR || (env.ATLAS_CLIENT_ID && env.ATLAS_GROUP_ID)), env.BACKUP_DIR ? `BACKUP_DIR=${env.BACKUP_DIR}` : 'No BACKUP_DIR and no Atlas credentials.', true);
  rule('alerts', 'Alerts reach a human', 'medium', Boolean(env.DEV_ALERT_EMAIL || env.SLACK_WEBHOOK_URL), env.DEV_ALERT_EMAIL || env.SLACK_WEBHOOK_URL ? 'DEV_ALERT_EMAIL / SLACK_WEBHOOK_URL set.' : 'Incidents open but nobody is notified.', true);
  rule('scheduler', 'Scheduler runs (escrow release, payout retries)', 'high', env.ENABLE_SCHEDULER !== 'false', env.ENABLE_SCHEDULER === 'false' ? 'ENABLE_SCHEDULER=false — fine on extra instances, wrong on the only one.' : 'Scheduler enabled.', true);
  return rules;
}

/** Event types the webhook dispatcher handles (read from the source, so it never goes stale). */
function handledStripeEvents() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'services', 'stripe', 'webhookDispatcher.js'), 'utf8');
    return [...new Set([...src.matchAll(/case '([a-z_]+(?:\.[a-z_]+)+)'/g)].map((m) => m[1]))].sort();
  } catch {
    return [];
  }
}

let stripeCache = { at: 0, value: null };
async function stripeWebhookCoverage() {
  if (stripeCache.value && Date.now() - stripeCache.at < 10 * 60 * 1000) return stripeCache.value;
  const handled = handledStripeEvents();
  let value;
  try {
    const stripe = await require('../../config/stripe').getStripe();
    const endpoints = [];
    for await (const e of stripe.webhookEndpoints.list({ limit: 100 })) endpoints.push({ id: e.id, url: e.url, status: e.status, events: e.enabled_events, connect: Boolean(e.application) || undefined });
    const enabled = endpoints.filter((e) => e.status === 'enabled');
    const all = enabled.some((e) => e.events.includes('*'));
    const subscribed = new Set(enabled.flatMap((e) => e.events));
    value = {
      ok: true,
      endpoints: endpoints.map((e) => ({ ...e, events: e.events.length > 20 ? [`${e.events.length} events`] : e.events })),
      handled: handled.length,
      missing: all ? [] : handled.filter((h) => !subscribed.has(h)),
      unhandled: all ? [] : [...subscribed].filter((s) => s !== '*' && !handled.includes(s)).sort(),
    };
  } catch (e) {
    value = { ok: false, error: e.message, handled: handled.length, missing: [], unhandled: [], endpoints: [] };
  }
  stripeCache = { at: Date.now(), value };
  return value;
}

function dependencyDrift() {
  let semver = null;
  try {
    semver = require('semver');
  } catch {
    /* without semver only missing packages are reported */
  }
  return packageState()
    .map((p) => ({ ...p, problem: !p.installed ? 'missing' : semver && semver.validRange(p.wanted) && !semver.satisfies(p.installed, p.wanted) ? 'out_of_range' : null }))
    .filter((p) => p.problem);
}

async function getDrift({ force = false } = {}) {
  if (force) stripeCache = { at: 0, value: null };
  const [state, baseline, boots, stripeReport, stripe] = await Promise.all([
    currentState(),
    model('ConfigSnapshot').findOne({ kind: 'baseline' }).sort({ at: -1 }).populate('acceptedBy', 'name').lean(),
    model('ConfigSnapshot').find({ kind: 'boot' }).sort({ at: -1 }).limit(16).lean(),
    require('../../config/stripe').getStripeModeReport().catch(() => null),
    stripeWebhookCoverage(),
  ]);
  const policies = policyChecks(process.env, { stripe: stripeReport });
  const history = boots.slice(0, 15).map((b, i) => ({ at: b.at, host: b.host, version: b.version, commit: b.commit, changes: boots[i + 1] ? diffStates(boots[i + 1], b) : null }));
  const unsetEnv = state.env.filter(([, v]) => !v).map(([k]) => k);
  const baselineDiff = baseline ? diffStates(baseline, state) : null;
  const dependencies = dependencyDrift();
  const failing = policies.filter((p) => p.ok === false);
  return {
    generatedAt: new Date(),
    environment: process.env.NODE_ENV || 'development',
    current: { digest: state.digest, nodeVersion: state.nodeVersion, version: state.version, commit: state.commit, envDeclared: state.env.length, envSet: state.env.length - unsetEnv.length, packages: state.packages.length, globalConfigKeys: state.globalConfig.length },
    baseline: baseline ? { at: baseline.at, by: baseline.acceptedBy?.name || null, note: baseline.note, digest: baseline.digest, matches: baseline.digest === state.digest } : null,
    baselineDiff,
    history,
    policies,
    dependencies,
    unsetEnv,
    stripeWebhooks: stripe,
    summary: {
      driftFromBaseline: baselineDiff ? baselineDiff.length : null,
      policyFailures: failing.length,
      criticalOrHigh: failing.filter((p) => ['critical', 'high'].includes(p.severity)).length,
      dependencyProblems: dependencies.length,
      webhookGaps: stripe.missing.length,
    },
  };
}

async function acceptBaseline(userId, note) {
  const state = await currentState();
  return model('ConfigSnapshot').create({ ...state, at: new Date(), kind: 'baseline', host: os.hostname(), acceptedBy: userId, note: note ? String(note).slice(0, 300) : null });
}

module.exports = { fp, declaredEnv, currentState, diffStates, recordBoot, policyChecks, handledStripeEvents, getDrift, acceptBaseline };
