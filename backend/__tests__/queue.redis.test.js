/**
 * Integration: queues, scheduler, rate limits and cache against a REAL Redis.
 * Uses REDIS_TEST_URL (default redis://127.0.0.1:6379) and a throw-away key prefix that is
 * deleted afterwards. Skipped when no Redis answers, so the normal suite never needs one.
 */
const net = require('net');

const URL_ = process.env.REDIS_TEST_URL || 'redis://127.0.0.1:6379';
process.env.REDIS_URL = URL_;
process.env.REDIS_IN_TESTS = 'true';
process.env.REDIS_PREFIX = `jobblo-test-${process.pid}`;

const reachable = () =>
  new Promise((resolve) => {
    const u = new URL(URL_);
    const s = net.connect({ host: u.hostname, port: Number(u.port || 6379) }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
    s.setTimeout(1000, () => {
      s.destroy();
      resolve(false);
    });
  });

jest.mock('../services/pushNotifications', () => ({ deliverPush: jest.fn() }));

const until = async (fn, ms = 8000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 50));
  }
};

let up = false;
beforeAll(async () => {
  up = await reachable();
});
afterAll(async () => {
  if (!up) return;
  const queue = require('../services/queue');
  await queue.stopWorkers();
  const redis = require('../config/redis');
  const client = redis.getRedis();
  const keys = await client.keys(`${process.env.REDIS_PREFIX}*`);
  if (keys.length) await client.del(...keys);
  await redis.closeRedis();
});

const maybe = (name, fn, timeout = 20000) => it(name, async () => (up ? fn() : console.warn(`[skip] no Redis at ${URL_}`)), timeout);

describe('queues on Redis (BullMQ)', () => {
  maybe('a worker picks up a queued job', async () => {
    const queue = require('../services/queue');
    const { deliverPush } = require('../services/pushNotifications');
    deliverPush.mockResolvedValue(undefined);
    queue.startWorkers();
    const r = await queue.enqueue('push', 'send', { userId: 'u1', message: { title: 'hi' } });
    expect(r.inline).toBe(false);
    await until(() => deliverPush.mock.calls.length >= 1);
    expect(deliverPush).toHaveBeenCalledWith('u1', { title: 'hi' });
  });

  maybe('a failing job is retried with backoff and then succeeds', async () => {
    const queue = require('../services/queue');
    const { deliverPush } = require('../services/pushNotifications');
    deliverPush.mockReset();
    deliverPush.mockRejectedValueOnce(new Error('fcm 503')).mockRejectedValueOnce(new Error('fcm 503')).mockResolvedValue(undefined);
    const { id } = await queue.enqueue('push', 'send', { userId: 'u2', message: {} }, { attempts: 3, backoff: { type: 'fixed', delay: 50 } });
    const job = await until(async () => {
      const j = await queue.getQueue('push').getJob(id);
      return j && (await j.getState()) === 'completed' ? j : null;
    });
    expect(deliverPush).toHaveBeenCalledTimes(3);
    expect(job.attemptsMade).toBe(3);
  });

  maybe('a job that keeps failing ends in the failed list (dead letter) and can be retried', async () => {
    const queue = require('../services/queue');
    const { deliverPush } = require('../services/pushNotifications');
    deliverPush.mockReset();
    deliverPush.mockRejectedValue(new Error('permanently broken'));
    const { id } = await queue.enqueue('push', 'send', { userId: 'u3', message: {} }, { attempts: 2, backoff: { type: 'fixed', delay: 50 } });
    const job = await until(async () => {
      const j = await queue.getQueue('push').getJob(id);
      return j && (await j.getState()) === 'failed' ? j : null;
    });
    expect(job.failedReason).toMatch(/permanently broken/);
    // Recovery: fix the cause, retry the dead job.
    deliverPush.mockReset();
    deliverPush.mockResolvedValue(undefined);
    await job.retry();
    await until(async () => (await queue.getQueue('push').getJob(id).then((j) => j.getState())) === 'completed');
  });

  maybe('the Redis schedule is synced without resetting existing timers', async () => {
    const { syncRedisSchedule } = require('../services/scheduler');
    const q = require('../services/queue').getQueue('scheduler');
    const a = { name: 'testJobA', everyMs: 60_000, delayMs: 60_000 };
    const b = { name: 'testJobB', everyMs: 120_000, delayMs: 60_000 };
    expect(await syncRedisSchedule(q, [a, b])).toEqual({ created: ['testJobA', 'testJobB'], kept: [], removed: [] });
    expect(await syncRedisSchedule(q, [a, b])).toEqual({ created: [], kept: ['testJobA', 'testJobB'], removed: [] });
    expect(await syncRedisSchedule(q, [{ ...a, everyMs: 30_000 }])).toEqual({ created: ['testJobA'], kept: [], removed: ['testJobB'] });
    await syncRedisSchedule(q, []);
  });
});

describe('rate limits on Redis', () => {
  maybe('two API instances share one limit', async () => {
    const express = require('express');
    const request = require('supertest');
    const { makeLimiter } = require('../middleware/rateLimiter');
    const name = `shared-${Date.now()}`;
    // Two separate limiter instances = two server processes behind a load balancer.
    const appFor = () => express().get('/', makeLimiter(name, { windowMs: 60_000, max: 3, standardHeaders: true, legacyHeaders: false }), (req, res) => res.send('ok'));
    const [one, two] = [appFor(), appFor()];
    const statuses = [];
    for (const app of [one, two, one, two]) statuses.push((await request(app).get('/')).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

describe('cache on Redis', () => {
  maybe('serves a HIT from Redis and forgets on invalidate', async () => {
    const express = require('express');
    const request = require('supertest');
    const { cacheJson, invalidate } = require('../utils/cache');
    let calls = 0;
    const app = express().get('/c', cacheJson('itest', 60), (req, res) => res.json({ n: ++calls }));
    const first = await request(app).get('/c');
    expect(first.headers['x-cache']).toBe('MISS');
    await until(async () => (await request(app).get('/c')).headers['x-cache'] === 'HIT');
    expect((await request(app).get('/c')).body).toEqual({ n: 1 });
    await invalidate('itest');
    expect((await request(app).get('/c')).body).toEqual({ n: 2 });
  });
});
