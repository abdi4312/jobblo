const jobs = require('./jobs');

/**
 * Lifecycle jobs (escrow auto-release, payout retries, reconciliation, …).
 *
 * Without Redis: plain timers in this process, staggered so they do not all fire on boot.
 * Every job is idempotent, so two instances running them is safe but noisy — set
 * ENABLE_SCHEDULER=false on all but one.
 *
 * With REDIS_URL: BullMQ job schedulers on the `scheduler` queue (services/queue). Each run
 * is one job picked up by exactly one worker in the fleet, so every instance can stay
 * enabled, and the schedule survives restarts.
 */

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
// Minute test deadlines (disabled in production, see providerConnectDeadline.js) need a
// check every minute, or the start-deadline refund lags up to 15 minutes behind.
const SAFEPAY_CHECK_MS = process.env.NODE_ENV !== 'production' && process.env.SAFEPAY_CONNECT_TEST_DEADLINE_MINUTES
  ? MINUTE
  : 15 * MINUTE;

const SCHEDULE = [
  { name: 'autoReleaseStaleReviews', fn: jobs.autoReleaseStaleReviews, everyMs: 6 * HOUR, delayMs: 2 * MINUTE },
  { name: 'warnBeforeAutoRelease', fn: jobs.warnBeforeAutoRelease, everyMs: 12 * HOUR, delayMs: 3 * MINUTE },
  { name: 'retryFailedPayouts', fn: jobs.retryFailedPayouts, everyMs: 2 * HOUR, delayMs: 4 * MINUTE },
  { name: 'cleanupAbandonedOrders', fn: jobs.cleanupAbandonedOrders, everyMs: 6 * HOUR, delayMs: 5 * MINUTE },
  { name: 'recordSafePayConnectReadiness', fn: jobs.recordSafePayConnectReadiness, everyMs: SAFEPAY_CHECK_MS, delayMs: 60 * 1000 },
  { name: 'cancelExpiredUnconnectedSafePayOrders', fn: jobs.cancelExpiredUnconnectedSafePayOrders, everyMs: SAFEPAY_CHECK_MS, delayMs: 90 * 1000 },
  { name: 'reconcileMoneyState', fn: jobs.reconcileMoneyState, everyMs: 24 * HOUR, delayMs: 6 * MINUTE },
  { name: 'reconcileStripeFinancialHistory', fn: jobs.reconcileStripeFinancialHistory, everyMs: 24 * HOUR, delayMs: 7 * MINUTE },
  { name: 'cancelExpiredSubscriptionRecoveries', fn: jobs.cancelExpiredSubscriptionRecoveries, everyMs: MINUTE, delayMs: 8 * MINUTE },
  { name: 'dispatchSubscriptionRecoveryEmails', fn: jobs.dispatchSubscriptionRecoveryEmails, everyMs: 5 * MINUTE, delayMs: 9 * MINUTE },
];

// In-app backups only when asked for (BACKUP_SCHEDULE_HOURS); host cron with scripts/backup.js is the default.
const backupCfg = require('../backup').config();
if (backupCfg.scheduleHours && backupCfg.dir) {
  SCHEDULE.push({
    name: 'backupDatabase',
    everyMs: backupCfg.scheduleHours * HOUR,
    delayMs: 15 * MINUTE,
    fn: async () => {
      const r = await (await require('../backup').startBackup({ trigger: 'cron' })).done;
      if (r.status !== 'succeeded') throw new Error(r.error);
      return { file: r.file, sizeBytes: r.sizeBytes, offsite: r.offsite?.status };
    },
  });
}

const timers = [];

// Read by the developer dashboard: whether the schedule is running, and how.
const state = { enabled: false, startedAt: null, mode: null };

// Best-effort run history for the developer dashboard; never blocks or fails a job.
function recordRun(job, started, ok, result, error) {
  try {
    require('../../models/SchedulerRun')
      .create({
        job: job.name,
        startedAt: new Date(started),
        durationMs: Date.now() - started,
        ok,
        result: ok ? result || null : null,
        error: error ? String(error).slice(0, 1000) : null,
      })
      .catch(() => {});
  } catch {
    /* model unavailable — ignore */
  }
}

async function runOnce(job) {
  const started = Date.now();
  try {
    require('../monitoring/faults').assertNoFault('scheduler', job.name); // staging failure simulator only
    const result = await job.fn();
    console.log(
      `[scheduler] ${job.name} ok in ${Date.now() - started}ms ${JSON.stringify(result || {})}`
    );
    recordRun(job, started, true, result);
  } catch (err) {
    // A scheduler job must never take the process down.
    console.error(`[scheduler] ${job.name} failed: ${err.message}`);
    recordRun(job, started, false, null, err.message);
  }
}

/**
 * Make the Redis schedule match SCHEDULE. An existing scheduler with the same interval is
 * left alone: re-creating it on every boot would restart its timer, and a 24 h job on an
 * instance that redeploys daily would never run. Schedulers for removed jobs are deleted.
 */
async function syncRedisSchedule(queue = require('../queue').getQueue('scheduler'), schedule = SCHEDULE) {
  const existing = new Map((await queue.getJobSchedulers(0, -1)).map((s) => [s.key || s.id, s]));
  const changes = { created: [], kept: [], removed: [] };
  for (const job of schedule) {
    const current = existing.get(job.name);
    if (current && Number(current.every) === job.everyMs) {
      changes.kept.push(job.name);
    } else {
      await queue.upsertJobScheduler(job.name, { every: job.everyMs, startDate: Date.now() + job.delayMs }, { name: 'run', data: { job: job.name } });
      changes.created.push(job.name);
    }
    existing.delete(job.name);
  }
  for (const id of existing.keys()) {
    await queue.removeJobScheduler(id);
    changes.removed.push(id);
  }
  return changes;
}

function startScheduler() {
  if (String(process.env.ENABLE_SCHEDULER || 'true').toLowerCase() === 'false') {
    console.log('[scheduler] disabled via ENABLE_SCHEDULER=false');
    return { stop: () => {} };
  }

  state.enabled = true;
  state.startedAt = new Date();
  if (require('../queue').usingRedis()) {
    state.mode = 'redis';
    syncRedisSchedule()
      .then((c) => console.log(`[scheduler] Redis schedule: ${c.created.length} created, ${c.kept.length} kept, ${c.removed.length} removed`))
      .catch((err) => console.error('[scheduler] could not sync the Redis schedule:', err.message));
    return { stop: () => {} };
  }
  state.mode = 'timers';
  const { autoReleaseDays, abandonedOrderHours } = jobs.config();
  console.log(
    `[scheduler] starting — auto-release after ${autoReleaseDays}d, abandoned cleanup after ${abandonedOrderHours}h`
  );

  for (const job of SCHEDULE) {
    const kickoff = setTimeout(() => {
      runOnce(job);
      const interval = setInterval(() => runOnce(job), job.everyMs);
      // Do not hold the event loop open on shutdown.
      if (interval.unref) interval.unref();
      timers.push(interval);
    }, job.delayMs);
    if (kickoff.unref) kickoff.unref();
    timers.push(kickoff);
  }

  return {
    stop() {
      for (const t of timers) {
        clearTimeout(t);
        clearInterval(t);
      }
      timers.length = 0;
    },
  };
}

module.exports = { startScheduler, syncRedisSchedule, SCHEDULE, runOnce, state };
