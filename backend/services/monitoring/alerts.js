const mongoose = require('mongoose');

/**
 * Alert evaluator: every minute, compute a few health metrics, turn breached thresholds
 * into Incidents (deduplicated by fingerprint while unresolved) and notify Slack/email.
 * Runs only where the scheduler runs (ENABLE_SCHEDULER), so one instance owns alerting.
 *
 * ponytail: the dedupe is find-then-create, so two evaluators racing could open the same
 * incident twice; acceptable while a single instance runs the scheduler. Upgrade path:
 * a partial unique index on { fingerprint } where status != 'resolved'.
 */

const MINUTE = 60 * 1000;
const CONFIG_KEY = 'devdash_alert_thresholds';
const DEFAULT_THRESHOLDS = {
  apiErrorRatePct: 5, // 5xx share of requests over 5 min (min 20 requests)
  apiP95Ms: 2000, // P95 latency over 5 min
  criticalErrors: 1, // critical ErrorLogs in 5 min
  webhookFailures: 3, // failing Stripe events in 15 min
  schedulerFailures: 2, // failed scheduler runs in 15 min
  queueStuck: 1, // stuck queue items (see queues)
  loginFailuresPerIp: 20, // failed logins from one IP in 15 min
  mobileCrashes: 5, // fatal app crashes in 15 min
  redisMemoryPct: 85, // Redis used memory as % of maxmemory
  queueBacklog: 500, // waiting jobs in one BullMQ queue
  recoveryMinutes: 10, // condition absent this long → mark recovered
};

async function getThresholds() {
  try {
    const doc = await require('../../models/GlobalConfig').findOne({ key: CONFIG_KEY }).lean();
    return { ...DEFAULT_THRESHOLDS, ...(doc?.value && typeof doc.value === 'object' ? doc.value : {}) };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

/** Pure: metrics + thresholds → firing alerts. */
function evaluateRules(m, t) {
  const out = [];
  const fire = (fingerprint, severity, service, title, detail) => out.push({ fingerprint, severity, service, title, detail });
  if (m.api.count >= 20 && (m.api.c5xx / m.api.count) * 100 >= t.apiErrorRatePct) {
    fire('api_error_rate', 'high', 'api', 'API error rate above threshold', `${((m.api.c5xx / m.api.count) * 100).toFixed(1)}% 5xx over 5 min (${m.api.c5xx}/${m.api.count})`);
  }
  if (m.api.count >= 20 && m.api.p95 >= t.apiP95Ms) fire('api_latency', 'medium', 'api', 'API latency above threshold', `P95 ${m.api.p95} ms over 5 min`);
  if (m.criticalErrors >= t.criticalErrors) fire('critical_errors', 'high', 'api', 'Critical errors logged', `${m.criticalErrors} critical error(s) in 5 min: ${m.criticalCodes.join(', ')}`);
  if (m.webhookFailures >= t.webhookFailures) fire('stripe_webhook_failures', 'high', 'webhook', 'Stripe webhook failures', `${m.webhookFailures} events failing in 15 min`);
  if (m.schedulerFailures >= t.schedulerFailures) fire('scheduler_failures', 'medium', 'scheduler', 'Scheduler jobs failing', `${m.schedulerFailures} failed runs in 15 min: ${m.failedJobs.join(', ')}`);
  if (m.queueStuck >= t.queueStuck) fire('queue_stuck', 'high', 'queue', 'Background work is stuck', `${m.queueStuck} item(s) stuck in processing`);
  for (const ip of m.loginFailureIps.filter((x) => x.n >= t.loginFailuresPerIp)) {
    fire(`login_failures:${ip.ip}`, 'critical', 'security', 'Possible brute force / credential stuffing', `${ip.n} failed logins from ${ip.ip} in 15 min`);
  }
  if (m.backup?.configured) {
    const b = m.backup;
    if (b.ageHours === null) fire('backup_missing', 'critical', 'database', 'No successful database backup', 'Backups are configured but none has succeeded yet');
    else if (b.ageHours > b.maxAgeHours) fire('backup_stale', 'critical', 'database', 'Database backup is stale', `Last successful backup ${Math.round(b.ageHours)} h ago (limit ${b.maxAgeHours} h)`);
    if (b.lastDrillFailed) fire('restore_drill_failed', 'high', 'database', 'Restore drill failed', b.lastDrillFailed);
  }
  for (const c of m.contractBreaks || []) {
    fire(`contract:${c._id}`, 'medium', 'api', `Breaking API change: ${c._id}`, `${c.n} breaking change(s) (${c.paths.slice(0, 3).join(', ')}) — clients may break. Acknowledge on API Contracts.`);
  }
  for (const f of m.fraudHigh || []) {
    fire(`fraud:${f.userId}`, 'high', 'fraud', `High fraud risk: ${f.name}`, `Score ${f.score} — ${f.rules.join(', ')}. Review it on the Fraud & Abuse page.`);
  }
  for (const b of m.sloBurning || []) {
    fire(`slo_burn:${b.key}`, 'high', 'slo', `Error budget burning fast: ${b.name}`, `Burn rate ${b.burn1h.toFixed(1)}× over the last hour — at this pace the 30-day budget is gone in ${Math.max(1, Math.round(720 / b.burn1h))} h`);
  }
  if (m.mobileCrashes >= t.mobileCrashes) fire('mobile_crashes', 'high', 'mobile', 'Mobile app crashes spiking', `${m.mobileCrashes} fatal crashes in 15 min`);
  for (const c of m.syntheticDown || []) {
    fire(`synthetic:${c.key}`, 'high', 'synthetic', `Synthetic check failing: ${c.name}`, `Failed ${c.n} runs in a row: ${c.error || 'unknown error'}`);
  }
  if (!m.mongoUp) fire('mongo_down', 'critical', 'database', 'MongoDB unreachable', 'The API cannot reach the database');
  out.push(...require('./redisInsights').evaluateRedisAlerts(m.redis, t));
  return out;
}

/** Probes whose last two runs (within 30 min) both failed — one blip does not page anyone. */
async function syntheticDown(now) {
  const rows = await require('../../models/SyntheticRun').aggregate([
    { $match: { at: { $gte: new Date(now - 30 * MINUTE) } } },
    { $sort: { at: -1 } },
    { $group: { _id: '$key', name: { $first: '$name' }, runs: { $push: { ok: '$ok', error: '$error' } } } },
  ]);
  return rows
    .map((r) => ({ key: r._id, name: r.name, last: r.runs.slice(0, 2), n: r.runs.findIndex((x) => x.ok) === -1 ? r.runs.length : r.runs.findIndex((x) => x.ok) }))
    .filter((r) => r.last.length === 2 && r.last.every((x) => !x.ok))
    .map((r) => ({ key: r.key, name: r.name, n: r.n, error: r.last[0].error }));
}

// SLO burn is computed every 5 minutes, not every tick.
let sloCache = { at: 0, value: [] };
async function sloBurningCached(now) {
  if (now - sloCache.at >= 5 * MINUTE) sloCache = { at: now, value: await require('./slo').burningSlos().catch(() => []) };
  return sloCache.value;
}

async function collectMetrics() {
  const now = Date.now();
  const since = (min) => new Date(now - min * MINUTE);
  const ApiMetricMinute = require('../../models/ApiMetricMinute');
  const ErrorLog = require('../../models/ErrorLog');
  const StripeEvent = require('../../models/StripeEvent');
  const SchedulerRun = require('../../models/SchedulerRun');
  const SecurityEvent = require('../../models/SecurityEvent');
  const { stuckCount } = require('./workQueues');
  const [api, critical, webhookFailures, failedRuns, loginFailureIps, queueStuck] = await Promise.all([
    ApiMetricMinute.aggregate([
      { $match: { minute: { $gte: since(5) } } },
      { $group: { _id: null, count: { $sum: '$count' }, c5xx: { $sum: '$c5xx' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } } } },
    ]),
    ErrorLog.find({ severity: 'critical', createdAt: { $gte: since(5) } }).select('errorCode').lean(),
    StripeEvent.countDocuments({ status: 'processing', lastError: { $ne: null }, updatedAt: { $gte: since(15) } }),
    SchedulerRun.find({ ok: false, startedAt: { $gte: since(15) } }).select('job').lean(),
    SecurityEvent.aggregate([{ $match: { type: 'login_failed', at: { $gte: since(15) } } }, { $group: { _id: '$ip', n: { $sum: 1 } } }]),
    stuckCount(),
  ]);
  // ponytail: only mongodump backups (BACKUP_DIR) are watched; Atlas snapshot freshness is shown on the page, not alerted.
  const backupCfg = require('../backup').config();
  let backup = null;
  if (backupCfg.dir) {
    const BackupRun = require('../../models/BackupRun');
    const [last, drill] = await Promise.all([
      BackupRun.findOne({ kind: 'backup', status: 'succeeded' }).sort({ startedAt: -1 }).select('startedAt').lean(),
      BackupRun.findOne({ kind: 'drill', status: { $ne: 'running' } }).sort({ startedAt: -1 }).select('status error').lean(),
    ]);
    backup = {
      configured: true,
      maxAgeHours: backupCfg.maxAgeHours,
      ageHours: last ? (now - last.startedAt) / (60 * MINUTE) : null,
      lastDrillFailed: drill?.status === 'failed' ? drill.error || 'failed' : null,
    };
  }
  const a = api[0] || { count: 0, c5xx: 0, p95w: 0 };
  return {
    mongoUp: mongoose.connection.readyState === 1,
    api: { count: a.count, c5xx: a.c5xx, p95: a.count ? Math.round(a.p95w / a.count) : 0 },
    criticalErrors: critical.length,
    criticalCodes: [...new Set(critical.map((c) => c.errorCode))].slice(0, 5),
    webhookFailures,
    schedulerFailures: failedRuns.length,
    failedJobs: [...new Set(failedRuns.map((r) => r.job))],
    loginFailureIps: loginFailureIps.map((x) => ({ ip: x._id, n: x.n })),
    queueStuck,
    backup,
    syntheticDown: await syntheticDown(now),
    sloBurning: await sloBurningCached(now),
    fraudHigh: await require('./fraud').openHighRisk().catch(() => []), // scan is cached 10 min
    contractBreaks: await require('../../models/ContractEvent').aggregate([
      { $match: { breaking: true, acknowledgedAt: null, at: { $gte: since(60) } } },
      { $group: { _id: { $concat: ['$method', ' ', '$route'] }, n: { $sum: 1 }, paths: { $addToSet: '$path' } } },
    ]),
    mobileCrashes: await require('../../models/MobileEvent').countDocuments({ type: 'error', fatal: true, at: { $gte: since(15) } }),
    redis: await require('./redisInsights').alertMetrics().catch((err) => ({ enabled: true, ok: false, error: err.message })),
  };
}

async function notify(incident) {
  const text = `[Jobblo ${process.env.NODE_ENV || 'dev'}] ${incident.severity.toUpperCase()}: ${incident.title} — ${incident.detail || ''}`;
  const channels = [];
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await require('axios').post(process.env.SLACK_WEBHOOK_URL, { text }, { timeout: 5000 });
      channels.push('slack');
    } catch (err) {
      console.error('[alerts] slack notify failed:', err.message);
    }
  }
  if (process.env.DEV_ALERT_EMAIL) {
    try {
      // Queued: retried with backoff if SMTP is down (services/queue).
      await require('../queue').enqueue('email', 'devAlert', { to: process.env.DEV_ALERT_EMAIL, incidentId: String(incident._id) });
      channels.push('email');
    } catch (err) {
      console.error('[alerts] email notify failed:', err.message);
    }
  }
  return channels;
}

async function tick() {
  const Incident = require('../../models/Incident');
  if (mongoose.connection.readyState !== 1) return; // cannot record anything without the DB
  const thresholds = await getThresholds();
  const firing = evaluateRules(await collectMetrics(), thresholds);
  const now = new Date();

  for (const alert of firing) {
    const open = await Incident.findOne({ fingerprint: alert.fingerprint, status: { $ne: 'resolved' } });
    if (open) {
      open.lastSeenAt = now;
      open.occurrences += 1;
      open.detail = alert.detail;
      if (open.recoveredAt) {
        open.recoveredAt = null;
        open.timeline.push({ kind: 'alert', text: `Condition returned: ${alert.detail}` });
      }
      await open.save();
      continue;
    }
    const repeat = await Incident.countDocuments({ fingerprint: alert.fingerprint, status: 'resolved' });
    const incident = await Incident.create({
      ...alert,
      source: 'alert',
      startedAt: now,
      lastSeenAt: now,
      timeline: [{ kind: 'opened', text: `${alert.detail}${repeat ? ` (repeat #${repeat + 1})` : ''}` }],
    });
    const channels = await notify(incident);
    if (channels.length) {
      incident.notifiedAt = new Date();
      incident.timeline.push({ kind: 'notify', text: `Notified via ${channels.join(', ')}` });
      await incident.save();
    }
  }

  // Recovery: alert incidents whose condition has been absent for a while.
  const firingKeys = new Set(firing.map((f) => f.fingerprint));
  const stale = await Incident.find({ source: 'alert', status: { $ne: 'resolved' }, recoveredAt: null, lastSeenAt: { $lt: new Date(now - thresholds.recoveryMinutes * MINUTE) } });
  for (const inc of stale.filter((i) => !firingKeys.has(i.fingerprint))) {
    inc.recoveredAt = now;
    inc.timeline.push({ kind: 'recovered', text: `Condition clear for ${thresholds.recoveryMinutes} min — confirm and resolve` });
    await inc.save();
  }
}

let timer = null;
function startAlerts() {
  if (timer || process.env.NODE_ENV === 'test') return;
  if (String(process.env.ENABLE_SCHEDULER || 'true').toLowerCase() === 'false') return;
  const run = () => tick().catch((err) => console.error('[alerts] evaluation failed:', err.message));
  timer = setInterval(run, MINUTE);
  if (timer.unref) timer.unref();
  setTimeout(run, 2 * MINUTE).unref?.();
}

module.exports = { evaluateRules, startAlerts, getThresholds, DEFAULT_THRESHOLDS, CONFIG_KEY, tick };
