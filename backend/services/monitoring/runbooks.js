const mongoose = require('mongoose');

/**
 * Automated runbook center. Runbooks live in code (reviewed like code, versioned with the
 * release that they describe) — no editor, no DB copy. Each one:
 *   - matches alert fingerprints, so an incident opens straight onto its runbook,
 *   - runs read-only diagnostic CHECKS on demand,
 *   - lists investigation steps (links into the console),
 *   - lists RECOVERY steps that only point at workflows that already exist and are already
 *     gated: an operations endpoint, a sensitive action (step-up / ChangeRequest approval),
 *     or a manual step for a human with shell access. Nothing here moves money or data.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const since = (ms) => new Date(Date.now() - ms);
const pass = (detail) => ({ state: 'pass', detail });
const warn = (detail) => ({ state: 'warn', detail });
const fail = (detail) => ({ state: 'fail', detail });
const model = (name) => require(`../../models/${name}`);

// ── Diagnostic checks (read-only, each < a few seconds) ─────────────────────────────
const CHECKS = {
  mongo: {
    title: 'MongoDB answers a ping',
    run: async () => {
      if (mongoose.connection.readyState !== 1) return fail(`Connection state ${mongoose.connection.readyState} (1 = connected).`);
      const t = Date.now();
      await mongoose.connection.db.admin().ping();
      const ms = Date.now() - t;
      return ms > 500 ? warn(`Ping took ${ms} ms.`) : pass(`Ping ${ms} ms.`);
    },
  },
  disk: {
    title: 'Disk has free space',
    run: async () => {
      const d = require('./system').diskUsage();
      if (!d) return warn('Disk usage unavailable on this host.');
      const free = `${(d.free / 1e9).toFixed(1)} GB free (${d.percent}% used)`;
      return d.percent >= 95 ? fail(free) : d.percent >= 85 ? warn(free) : pass(free);
    },
  },
  api_5xx: {
    title: 'API 5xx in the last 15 min',
    run: async () => {
      const rows = await model('ApiMetricMinute').aggregate([
        { $match: { minute: { $gte: since(15 * MIN) }, route: { $not: /^\/api\/developer/ } } },
        { $group: { _id: { m: '$method', r: '$route' }, n: { $sum: '$count' }, e: { $sum: '$c5xx' } } },
        { $sort: { e: -1 } },
      ]);
      const total = rows.reduce((a, r) => a + r.n, 0);
      const errors = rows.reduce((a, r) => a + r.e, 0);
      const top = rows.filter((r) => r.e).slice(0, 3).map((r) => `${r._id.m} ${r._id.r} (${r.e})`).join(', ');
      if (!total) return warn('No API traffic recorded in 15 min.');
      const pct = (errors / total) * 100;
      const detail = `${errors}/${total} requests failed (${pct.toFixed(1)}%)${top ? ` — worst: ${top}` : ''}.`;
      return pct >= 5 ? fail(detail) : errors ? warn(detail) : pass(detail);
    },
  },
  event_loop: {
    title: 'Node event loop is not blocked',
    run: async () => {
      const p99 = require('./apm').snapshot().eventLoop?.p99;
      if (p99 == null) return warn('No event-loop sample yet.');
      return p99 > 500 ? fail(`p99 ${p99} ms — something CPU-heavy is blocking requests.`) : p99 > 100 ? warn(`p99 ${p99} ms.`) : pass(`p99 ${p99} ms.`);
    },
  },
  recent_deploy: {
    title: 'Was there a release in the last 2 hours?',
    run: async () => {
      const d = await model('Deployment').findOne({ deployedAt: { $gte: since(2 * HOUR) } }).sort({ deployedAt: -1 }).lean();
      return d ? warn(`Release ${d.version}${d.commit ? ` (${String(d.commit).slice(0, 7)})` : ''} at ${d.deployedAt.toISOString()} — compare on Deployment Impact.`) : pass('No release in the last 2 hours.');
    },
  },
  fault_injection: {
    title: 'No failure experiment is running',
    run: async () => {
      const active = await model('FailureExperiment').find({ stoppedAt: null, endsAt: { $gt: new Date() } }).select('type target').lean();
      return active.length ? fail(`${active.length} active: ${active.map((a) => `${a.type}${a.target ? ` ${a.target}` : ''}`).join(', ')} — stop it on Failure Simulator.`) : pass('None active.');
    },
  },
  stripe_api: {
    title: 'Stripe API reachable',
    run: async () => {
      const t = Date.now();
      await (await require('../../config/stripe').getStripe()).balance.retrieve();
      return pass(`balance.retrieve in ${Date.now() - t} ms.`);
    },
  },
  webhook_stuck: {
    title: 'No webhook stuck in processing',
    run: async () => {
      const c = require('./eventConsistency').CHECKS.find((x) => x.key === 'webhook_stuck');
      const r = await c.run({ days: 30 });
      return r.count ? fail(`${r.count} stuck — e.g. ${r.samples[0]?.ref} ${r.samples[0]?.detail}`) : pass('None stuck.');
    },
  },
  webhook_coverage: {
    title: 'Stripe endpoint sends every handled event',
    run: async () => {
      const d = await require('./configDrift').getDrift();
      const s = d?.stripeWebhooks;
      if (!s || s.ok === false) return warn(`Could not read webhook endpoints${s?.error ? `: ${s.error}` : ''}.`);
      return s.missing?.length ? fail(`Not subscribed: ${s.missing.join(', ')}.`) : pass(`All ${s.handled} handled events subscribed.`);
    },
  },
  scheduler: {
    title: 'Scheduler running and jobs succeeding',
    run: async () => {
      const { state } = require('../scheduler');
      const failed = await model('SchedulerRun').find({ ok: false, startedAt: { $gte: since(HOUR) } }).sort({ startedAt: -1 }).select('job error').lean();
      if (!state.enabled) return fail('Scheduler is not running in this process (ENABLE_SCHEDULER=false or not started).');
      return failed.length ? fail(`${failed.length} failed run(s) in 1 h: ${[...new Set(failed.map((f) => `${f.job}${f.error ? ` — ${f.error.slice(0, 80)}` : ''}`))].slice(0, 3).join('; ')}`) : pass('Running; no failures in 1 h.');
    },
  },
  backup: {
    title: 'Last backup and restore drill',
    run: async () => {
      const B = model('BackupRun');
      const [b, d, failedDrill] = await Promise.all([
        B.findOne({ kind: 'backup', status: 'succeeded' }).sort({ finishedAt: -1 }).lean(),
        B.findOne({ kind: 'drill', status: 'succeeded' }).sort({ finishedAt: -1 }).lean(),
        B.findOne({ kind: 'drill', status: 'failed' }).sort({ startedAt: -1 }).lean(),
      ]);
      if (!b) return fail('No successful backup recorded.');
      const ageH = (Date.now() - b.finishedAt) / HOUR;
      const detail = `Backup ${ageH.toFixed(1)} h old; last good drill ${d ? d.finishedAt.toISOString() : 'never'}${failedDrill && (!d || failedDrill.startedAt > d.finishedAt) ? `; latest drill FAILED: ${failedDrill.error}` : ''}.`;
      return ageH > 26 || !d ? fail(detail) : pass(detail);
    },
  },
  backup_tools: {
    title: 'mongodump / mongorestore installed',
    run: async () => {
      const v = await require('../backup').toolsVersion();
      return v?.mongodump && v?.mongorestore ? pass(`mongodump ${v.mongodump}, mongorestore ${v.mongorestore}.`) : fail('Database tools not found — set MONGODUMP_BIN or install mongodb-database-tools.');
    },
  },
  login_failures: {
    title: 'Failed logins by IP (15 min)',
    run: async () => {
      const rows = await model('SecurityEvent').aggregate([{ $match: { type: 'login_failed', at: { $gte: since(15 * MIN) } } }, { $group: { _id: '$ip', n: { $sum: 1 }, accounts: { $addToSet: '$emailHash' } } }, { $sort: { n: -1 } }, { $limit: 5 }]);
      if (!rows.length) return pass('No failed logins in 15 min.');
      const blocked = new Set(await model('IpBlock').find({ target: { $in: rows.map((r) => r._id) }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).distinct('target'));
      const detail = rows.map((r) => `${r._id}: ${r.n} tries, ${r.accounts.length} account(s)${blocked.has(r._id) ? ' [blocked]' : ''}`).join('; ');
      return rows.some((r) => r.n >= 20 && !blocked.has(r._id)) ? fail(detail) : warn(detail);
    },
  },
  synthetic: {
    title: 'Latest synthetic probe results',
    run: async () => {
      const rows = await model('SyntheticRun').aggregate([{ $match: { at: { $gte: since(HOUR) } } }, { $sort: { at: -1 } }, { $group: { _id: '$key', name: { $first: '$name' }, ok: { $first: '$ok' }, error: { $first: '$error' } } }]);
      if (!rows.length) return warn('No probe ran in the last hour (ENABLE_SYNTHETIC?).');
      const bad = rows.filter((r) => !r.ok);
      return bad.length ? fail(bad.map((r) => `${r.name}: ${r.error}`).join('; ')) : pass(`${rows.length} probes passing.`);
    },
  },
  mobile_crashes: {
    title: 'Top mobile crashes (1 h)',
    run: async () => {
      const rows = await model('MobileEvent').aggregate([{ $match: { type: 'error', fatal: true, at: { $gte: since(HOUR) } } }, { $group: { _id: { f: '$fingerprint', v: '$appVersion' }, n: { $sum: 1 }, message: { $first: '$message' } } }, { $sort: { n: -1 } }, { $limit: 3 }]);
      return rows.length ? fail(rows.map((r) => `${r.n}× ${r.message || r._id.f} (v${r._id.v})`).join('; ')) : pass('No fatal crashes in 1 h.');
    },
  },
  money_consistency: {
    title: 'Payment events consistent',
    run: async () => {
      const keys = ['payment_not_recorded', 'payment_state_lag', 'safepay_duplicate_open'];
      const results = await Promise.all(require('./eventConsistency').CHECKS.filter((c) => keys.includes(c.key)).map(async (c) => ({ c, r: await c.run({ days: 30 }) })));
      const bad = results.filter((x) => x.r.count);
      return bad.length ? fail(bad.map((x) => `${x.c.title}: ${x.r.count}`).join('; ')) : pass('Orders, Payments and SafePay agree.');
    },
  },
  connect_blocked: {
    title: 'Providers who cannot be paid out',
    run: async () => {
      const { summary: s } = await require('./connectHealth').scan({});
      const n = s.restricted + s.missing + s.pending;
      const detail = `${s.ready}/${s.accounts} accounts ready, ${s.restricted} restricted, ${s.pending} pending, ${s.missing} missing in Stripe; ${s.blockedNok} NOK cannot be paid out; ${s.failedPayouts} failed payout(s).`;
      return s.blockedNok || s.failedPayouts ? fail(detail) : n ? warn(detail) : pass(detail);
    },
  },
};

// ── Runbooks ─────────────────────────────────────────────────────────────────────────
// step kinds: investigate (link), recover (endpoint | action | link | manual).
// approval: 'none' (read-only), 'operations', 'step-up', 'change-request', 'human' (shell / external dashboard).
const RUNBOOKS = [
  {
    key: 'api_errors',
    title: 'API errors or slowness',
    severity: 'high',
    alerts: ['api_error_rate', 'api_latency', 'critical_errors', 'slo_burn:'],
    symptoms: '5xx responses, slow pages, the error-rate or latency alert, an SLO burning.',
    checks: ['api_5xx', 'mongo', 'event_loop', 'disk', 'recent_deploy', 'fault_injection'],
    steps: [
      { kind: 'investigate', text: 'Find the failing routes and the error groups behind them.', link: '/developer/api' },
      { kind: 'investigate', text: 'Open the newest error groups (stack, request ids, users).', link: '/developer/errors' },
      { kind: 'investigate', text: 'If a release went out, compare before/after.', link: '/developer/deployment-impact' },
      { kind: 'investigate', text: 'See which users and jobs were hit.', link: '/developer/impact' },
      { kind: 'recover', text: 'Stop any running failure experiment.', link: '/developer/failure-simulator', approval: 'operations' },
      { kind: 'recover', text: 'Roll back to the previous release (redeploy the previous image/commit on the VPS).', manual: 'docker compose pull && docker compose up -d   # with the previous tag', approval: 'human' },
      { kind: 'recover', text: 'Turn off the feature behind the failing route with a feature flag.', link: '/developer/flags', approval: 'change-request' },
    ],
  },
  {
    key: 'webhooks',
    title: 'Stripe webhooks failing or missing',
    severity: 'critical',
    alerts: ['stripe_webhook_failures', 'queue_stuck'],
    symptoms: 'Paid orders not marked paid, refunds not reflected, subscription state wrong, the webhook alert.',
    checks: ['stripe_api', 'webhook_stuck', 'webhook_coverage', 'mongo', 'fault_injection'],
    steps: [
      { kind: 'investigate', text: 'See failing deliveries and their errors.', link: '/developer/webhooks' },
      { kind: 'investigate', text: 'Check for events Stripe sent that never arrived, or arrived out of order.', link: '/developer/event-consistency?area=webhook' },
      { kind: 'recover', text: 'Fix the handler error, deploy, then resend the failed events from Stripe Dashboard → Developers → Events → Resend. Stripe also retries automatically for 3 days.', manual: 'Stripe Dashboard → Developers → Events → (event) → Resend', approval: 'human' },
      { kind: 'recover', text: 'If an event type is not subscribed, add it to the endpoint in Stripe Dashboard → Webhooks.', manual: 'Stripe Dashboard → Developers → Webhooks → endpoint → Update events', approval: 'human' },
      { kind: 'recover', text: 'Do NOT mark orders paid or refunded by hand — verify against Stripe first and follow Reconciliation.', link: '/developer/reconciliation', approval: 'none' },
    ],
  },
  {
    key: 'money',
    title: 'Money out of sync (payments, escrow, payouts)',
    severity: 'critical',
    alerts: ['critical_errors'],
    symptoms: 'MONEY_RECONCILIATION_MISMATCH, an order completed but never paid out, a refund that did not land.',
    checks: ['money_consistency', 'connect_blocked', 'stripe_api', 'scheduler'],
    steps: [
      { kind: 'investigate', text: 'Trace the order end to end (job → payment → completion → payout).', link: '/developer/transactions' },
      { kind: 'investigate', text: "Check the order's ledger: held, released, refunded, fees.", link: '/developer/ledger' },
      { kind: 'investigate', text: 'Check the SafePay state machine for impossible transitions.', link: '/developer/safepay-machine' },
      { kind: 'investigate', text: 'Is the provider able to receive payouts?', link: '/developer/connect' },
      { kind: 'recover', text: 'Re-sync a provider’s Connect status from Stripe.', link: '/developer/connect', approval: 'operations' },
      { kind: 'recover', text: 'Never release or refund manually from here. Verify in Stripe (all accounts, metadata, accounting history), get a Super Admin decision, and record it on the incident.', manual: 'Escalate to Super Admin with the order id and the Ledger/Transactions links', approval: 'human' },
    ],
  },
  {
    key: 'scheduler',
    title: 'Scheduled jobs failing',
    severity: 'medium',
    alerts: ['scheduler_failures'],
    symptoms: 'Escrow not auto-released, payout retries not happening, reconciliation silent.',
    checks: ['scheduler', 'mongo', 'stripe_api', 'fault_injection'],
    steps: [
      { kind: 'investigate', text: 'Open the failing job and its last errors.', link: '/developer/scheduler' },
      { kind: 'investigate', text: 'Check whether the failures left money stuck.', link: '/developer/event-consistency?area=payment' },
      { kind: 'recover', text: 'Restart the API process if the scheduler is not running (exactly one instance must have ENABLE_SCHEDULER on).', manual: 'docker compose restart backend', approval: 'human' },
    ],
  },
  {
    key: 'database',
    title: 'Database unreachable or slow',
    severity: 'critical',
    alerts: ['mongo_down'],
    symptoms: 'Every request fails or hangs; MongoDB unreachable alert.',
    checks: ['mongo', 'disk', 'event_loop'],
    steps: [
      { kind: 'investigate', text: 'Connections, slow operations and collection sizes.', link: '/developer/mongo' },
      { kind: 'investigate', text: 'Disk and memory on the server.', link: '/developer/server' },
      { kind: 'recover', text: 'Check and restart mongod on the VPS; free disk if it is full (old backups, logs).', manual: 'sudo systemctl status mongod && sudo journalctl -u mongod -n 100\nsudo systemctl restart mongod', approval: 'human' },
      { kind: 'recover', text: 'If data is damaged, follow the disaster-recovery runbook (restore from the last verified backup).', manual: 'docs/runbooks/disaster-recovery.md', approval: 'human' },
    ],
  },
  {
    key: 'backups',
    title: 'Backups missing, stale or drill failed',
    severity: 'critical',
    alerts: ['backup_missing', 'backup_stale', 'restore_drill_failed'],
    symptoms: 'The backup alert; no recent verified backup to roll back to.',
    checks: ['backup', 'backup_tools', 'disk', 'mongo'],
    steps: [
      { kind: 'investigate', text: 'Backup history, sizes and drill results.', link: '/developer/backups' },
      { kind: 'recover', text: 'Take a backup now.', endpoint: 'backup_run', approval: 'operations' },
      { kind: 'recover', text: 'Prove it restores: run a restore drill (into a separate database).', link: '/developer/backups', approval: 'step-up' },
    ],
  },
  {
    key: 'brute_force',
    title: 'Login attack / credential stuffing',
    severity: 'critical',
    alerts: ['login_failures:'],
    symptoms: 'Many failed logins from one IP or across many accounts.',
    checks: ['login_failures'],
    steps: [
      { kind: 'investigate', text: 'Failed logins, targeted accounts, rate limits.', link: '/developer/security' },
      { kind: 'recover', text: 'Block the attacking IP (time-limited).', link: '/developer/ips', approval: 'step-up' },
      { kind: 'recover', text: 'If accounts were taken over, revoke their sessions and force a password reset.', link: '/developer/users', approval: 'human' },
    ],
  },
  {
    key: 'synthetic',
    title: 'Synthetic check failing (site or login down)',
    severity: 'high',
    alerts: ['synthetic:'],
    symptoms: 'A probe of the API, web app, login journey or geocoding fails repeatedly.',
    checks: ['synthetic', 'api_5xx', 'mongo', 'recent_deploy'],
    steps: [
      { kind: 'investigate', text: 'Which step fails and since when.', link: '/developer/synthetic' },
      { kind: 'investigate', text: 'Is it the edge (nginx/TLS) or the API?', link: '/developer/dependencies' },
      { kind: 'recover', text: 'Re-run the probes after a fix to confirm recovery.', endpoint: 'synthetic_run', approval: 'operations' },
    ],
  },
  {
    key: 'mobile',
    title: 'Mobile app crashing',
    severity: 'high',
    alerts: ['mobile_crashes'],
    symptoms: 'Crash spike alert; crash-free sessions dropping for a version.',
    checks: ['mobile_crashes', 'api_5xx', 'recent_deploy'],
    steps: [
      { kind: 'investigate', text: 'Crash groups, versions and devices.', link: '/developer/mobile' },
      { kind: 'investigate', text: 'Did an API change break older app versions?', link: '/developer/contracts' },
      { kind: 'recover', text: 'Disable the crashing feature with a flag, or roll back the OTA update / pause the store rollout.', link: '/developer/flags', approval: 'change-request' },
    ],
  },
];

/** Pure: runbooks that cover an alert fingerprint ("synthetic:web" matches "synthetic:"). Unit-tested. */
function forFingerprint(fingerprint) {
  const fp = String(fingerprint || '');
  return RUNBOOKS.filter((r) => r.alerts.some((a) => (a.endsWith(':') ? fp.startsWith(a) : fp === a))).map((r) => r.key);
}

/** Pure: overall state of a set of check results. */
const overall = (results) => (results.some((r) => r.state === 'fail') ? 'fail' : results.some((r) => r.state === 'warn' || r.state === 'error') ? 'warn' : 'pass');

async function runChecks(runbook) {
  return Promise.all(
    runbook.checks.map(async (key) => {
      const started = Date.now();
      try {
        const r = await Promise.race([CHECKS[key].run(), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after 10 s')), 10_000))]);
        return { key, title: CHECKS[key].title, ...r, ms: Date.now() - started };
      } catch (e) {
        return { key, title: CHECKS[key].title, state: 'error', detail: e.message, ms: Date.now() - started };
      }
    })
  );
}

const describe = (r) => ({ ...r, checks: r.checks.map((k) => ({ key: k, title: CHECKS[k].title })) });

module.exports = { CHECKS, RUNBOOKS, forFingerprint, overall, runChecks, describe };
