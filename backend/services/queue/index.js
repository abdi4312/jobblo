/**
 * Background jobs. With REDIS_URL they go through BullMQ: persisted, retried with backoff,
 * spread over every instance, visible (and retryable when failed) in the developer console.
 * Without Redis the same handler runs in-process right after the request — the behaviour
 * Jobblo had before queues existed — so nothing needs Redis to work.
 *
 * Handlers live in ./handlers.js as `queue → job name → async (data) => result`. A handler
 * must be idempotent: a job can run more than once (retry after a timeout, a crashed worker).
 * Secrets never go into job data in clear text: seal them (services/queue/handlers.js).
 */
const redis = require('../../config/redis');

const ONE_DAY = 24 * 60 * 60;
// Per queue: worker concurrency, retry policy, and how long finished jobs are kept.
const QUEUES = {
  email: { concurrency: 5, attempts: 5, backoff: { type: 'exponential', delay: 30_000 }, keepCompleted: { age: 3600, count: 500 } },
  push: { concurrency: 10, attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, keepCompleted: { age: 3600, count: 1000 } },
  scheduler: { concurrency: 2, attempts: 1, backoff: undefined, keepCompleted: { age: ONE_DAY, count: 200 } },
};
const KEEP_FAILED = { age: 14 * ONE_DAY, count: 2000 }; // the dead-letter list
const ENQUEUE_TIMEOUT_MS = 3000;

const queues = new Map();
const workers = new Map();
const inlineStats = { ran: 0, failed: 0, lastError: null };

const handlers = () => require('./handlers').HANDLERS;
const usingRedis = () => redis.enabled();

function getQueue(name) {
  if (!QUEUES[name]) throw new Error(`Unknown queue "${name}"`);
  if (!queues.has(name)) {
    const { Queue } = require('bullmq');
    const cfg = QUEUES[name];
    queues.set(
      name,
      new Queue(name, {
        connection: redis.bullConnection(`queue:${name}`),
        prefix: `${redis.PREFIX}:bull`,
        defaultJobOptions: { attempts: cfg.attempts, backoff: cfg.backoff, removeOnComplete: cfg.keepCompleted, removeOnFail: KEEP_FAILED },
      })
    );
  }
  return queues.get(name);
}

function handlerFor(queue, jobName) {
  const fn = handlers()[queue]?.[jobName];
  if (!fn) throw new Error(`No handler for ${queue}/${jobName}`);
  return fn;
}

/** Run a job in this process, now-ish. Errors are logged, never thrown to the request. */
function runInline(queue, jobName, data) {
  const fn = handlerFor(queue, jobName);
  setImmediate(async () => {
    try {
      await fn(data, { attemptsMade: 0, inline: true });
      inlineStats.ran += 1;
    } catch (err) {
      inlineStats.failed += 1;
      inlineStats.lastError = `${queue}/${jobName}: ${err.message}`;
      console.error(`[queue:inline] ${queue}/${jobName} failed: ${err.message}`);
    }
  });
  return { id: null, inline: true };
}

/**
 * Queue a job. Never throws for infrastructure reasons: if Redis is off or does not answer
 * within ENQUEUE_TIMEOUT_MS, the job runs in-process instead — sending the email late
 * beats losing it.
 */
async function enqueue(queue, jobName, data = {}, opts = {}) {
  handlerFor(queue, jobName); // unknown job = programming error, fail loudly
  if (!usingRedis()) return runInline(queue, jobName, data);
  try {
    const job = await Promise.race([
      getQueue(queue).add(jobName, data, opts),
      new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue timed out')), ENQUEUE_TIMEOUT_MS).unref()),
    ]);
    return { id: job.id, inline: false };
  } catch (err) {
    console.error(`[queue] ${queue}/${jobName}: Redis unavailable (${err.message}) — running in-process`);
    return runInline(queue, jobName, data);
  }
}

/** Start one BullMQ worker per queue on this instance (ENABLE_WORKERS=false to skip). */
function startWorkers() {
  if (!usingRedis()) return { started: 0, mode: 'inline' };
  if (String(process.env.ENABLE_WORKERS || 'true').toLowerCase() === 'false') {
    console.log('[queue] workers disabled via ENABLE_WORKERS=false (this instance only enqueues)');
    return { started: 0, mode: 'producer-only' };
  }
  const { Worker } = require('bullmq');
  for (const [name, cfg] of Object.entries(QUEUES)) {
    if (workers.has(name)) continue;
    const worker = new Worker(name, async (job) => handlerFor(name, job.name)(job.data, { attemptsMade: job.attemptsMade, jobId: job.id }), {
      connection: redis.bullConnection(`worker:${name}`),
      prefix: `${redis.PREFIX}:bull`,
      concurrency: cfg.concurrency,
      metrics: { maxDataPoints: 24 * 60 }, // one day of per-minute completed/failed counts (Redis Workers page)
    });
    worker.on('failed', (job, err) => {
      const final = job && job.attemptsMade >= (job.opts.attempts || 1);
      console.error(`[queue] ${name}/${job?.name} #${job?.id} ${final ? 'FAILED for good' : `failed (attempt ${job?.attemptsMade})`}: ${err.message}`);
    });
    worker.on('error', (err) => console.error(`[queue] worker ${name}: ${err.message}`));
    workers.set(name, worker);
  }
  console.log(`[queue] ${workers.size} workers started (${Object.keys(QUEUES).join(', ')})`);
  return { started: workers.size, mode: 'redis' };
}

/** Let running jobs finish, then close (graceful shutdown). */
async function stopWorkers() {
  await Promise.allSettled([...workers.values()].map((w) => w.close()));
  await Promise.allSettled([...queues.values()].map((q) => q.close()));
  workers.clear();
  queues.clear();
}

module.exports = { QUEUES, KEEP_FAILED, enqueue, getQueue, startWorkers, stopWorkers, usingRedis, inlineStats, workers };
