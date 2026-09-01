const jobs = require('./jobs');

/**
 * The smallest scheduler that does the job: plain timers, no new dependency.
 *
 * A queue library would buy distributed locking and retries, but nothing here needs
 * either — every job is idempotent by construction and safe to run concurrently on
 * two instances. If a second instance is ever added and duplicate runs become noisy,
 * set ENABLE_SCHEDULER=false on all but one.
 *
 * Runs are staggered so they do not all fire together on boot.
 */

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const SCHEDULE = [
  { name: 'autoReleaseStaleReviews', fn: jobs.autoReleaseStaleReviews, everyMs: 6 * HOUR, delayMs: 2 * MINUTE },
  { name: 'warnBeforeAutoRelease', fn: jobs.warnBeforeAutoRelease, everyMs: 12 * HOUR, delayMs: 3 * MINUTE },
  { name: 'retryFailedPayouts', fn: jobs.retryFailedPayouts, everyMs: 2 * HOUR, delayMs: 4 * MINUTE },
  { name: 'cleanupAbandonedOrders', fn: jobs.cleanupAbandonedOrders, everyMs: 6 * HOUR, delayMs: 5 * MINUTE },
  { name: 'reconcileMoneyState', fn: jobs.reconcileMoneyState, everyMs: 24 * HOUR, delayMs: 6 * MINUTE },
];

const timers = [];

async function runOnce(job) {
  const started = Date.now();
  try {
    const result = await job.fn();
    console.log(
      `[scheduler] ${job.name} ok in ${Date.now() - started}ms ${JSON.stringify(result || {})}`
    );
  } catch (err) {
    // A scheduler job must never take the process down.
    console.error(`[scheduler] ${job.name} failed: ${err.message}`);
  }
}

function startScheduler() {
  if (String(process.env.ENABLE_SCHEDULER || 'true').toLowerCase() === 'false') {
    console.log('[scheduler] disabled via ENABLE_SCHEDULER=false');
    return { stop: () => {} };
  }

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

module.exports = { startScheduler, SCHEDULE, runOnce };
