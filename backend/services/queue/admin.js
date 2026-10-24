/**
 * Read and recover queues for the developer console (Queues page): counts per queue, the
 * failed jobs (dead letters) with their error, and retry / remove. Job data is shown
 * redacted — sealed codes hidden, emails masked, push text reduced to its title.
 */
const redis = require('../../config/redis');
const queue = require('./index');

const SECRET_KEY = /sealed|secret|token|password|otp|code/i;

/** Pure: what a developer may see of a job payload. Unit-tested. */
function redactJobData(data) {
  if (!data || typeof data !== 'object') return data ?? null;
  const { maskEmail } = require('../monitoring/securityEvents');
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (SECRET_KEY.test(k)) out[k] = '[hidden]';
    else if (k === 'message' && v && typeof v === 'object') out[k] = { title: v.title ? String(v.title).slice(0, 80) : undefined, fields: Object.keys(v) };
    else if (typeof v === 'string' && /@/.test(v)) out[k] = maskEmail(v);
    else if (v && typeof v === 'object') out[k] = Array.isArray(v) ? `[${v.length} items]` : redactJobData(v);
    else out[k] = v;
  }
  return out;
}

const jobView = (j) => ({
  id: j.id,
  name: j.name,
  data: redactJobData(j.data),
  attemptsMade: j.attemptsMade,
  maxAttempts: j.opts?.attempts || 1,
  failedReason: j.failedReason ? String(j.failedReason).slice(0, 500) : null,
  stack: j.stacktrace?.at(-1) ? String(j.stacktrace.at(-1)).split('\n').slice(0, 4).join('\n') : null,
  createdAt: j.timestamp ? new Date(j.timestamp) : null,
  finishedAt: j.finishedOn ? new Date(j.finishedOn) : null,
});

async function overview() {
  const ping = await redis.pingRedis();
  const base = { mode: queue.usingRedis() ? 'redis' : 'inline', redis: ping, redisState: { status: redis.state.status, lastError: redis.state.lastError, lastErrorAt: redis.state.lastErrorAt }, inline: queue.inlineStats };
  if (!queue.usingRedis() || !ping.ok) return { ...base, queues: Object.keys(queue.QUEUES).map((name) => ({ name, ...queue.QUEUES[name], counts: null, failed: [], workerHere: false })) };
  const queues = await Promise.all(
    Object.entries(queue.QUEUES).map(async ([name, cfg]) => {
      const q = queue.getQueue(name);
      const [counts, failed, isPaused, schedulers] = await Promise.all([
        q.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused', 'prioritized'),
        q.getFailed(0, 49),
        q.isPaused(),
        name === 'scheduler' ? q.getJobSchedulers(0, -1) : [],
      ]);
      return {
        name,
        concurrency: cfg.concurrency,
        attempts: cfg.attempts,
        counts,
        isPaused,
        workerHere: queue.workers.has(name),
        failed: failed.filter(Boolean).map(jobView),
        schedulers: schedulers.map((s) => ({ id: s.key || s.id, every: s.every ? Number(s.every) : null, next: s.next ? new Date(Number(s.next)) : null })),
      };
    })
  );
  return { ...base, queues };
}

function assertQueue(name) {
  if (!queue.QUEUES[name]) throw Object.assign(new Error('Unknown queue.'), { status: 404 });
  if (!queue.usingRedis()) throw Object.assign(new Error('Queues run in-process (no REDIS_URL); there is nothing to retry.'), { status: 409 });
  return queue.getQueue(name);
}

async function retryJob(name, id) {
  const job = await assertQueue(name).getJob(String(id));
  if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
  if ((await job.getState()) !== 'failed') throw Object.assign(new Error('Only failed jobs can be retried.'), { status: 409 });
  await job.retry();
  return { id: job.id, name: job.name };
}

async function removeJob(name, id) {
  const job = await assertQueue(name).getJob(String(id));
  if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
  if ((await job.getState()) === 'active') throw Object.assign(new Error('The job is running; wait for it to finish.'), { status: 409 });
  await job.remove();
  return { id: job.id, name: job.name };
}

/** Retry every failed job in a queue (after the cause is fixed). ponytail: first 500 only. */
async function retryAllFailed(name) {
  const q = assertQueue(name);
  const failed = (await q.getFailed(0, 499)).filter(Boolean);
  let retried = 0;
  for (const job of failed) {
    try {
      await job.retry();
      retried += 1;
    } catch {
      /* already retried by someone else */
    }
  }
  return { retried, of: failed.length };
}

module.exports = { redactJobData, overview, retryJob, removeJob, retryAllFailed };
