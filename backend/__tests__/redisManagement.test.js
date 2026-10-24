/**
 * Redis management pages (services/monitoring/redisInsights.js).
 * Unit part: pure helpers and the guards on every write — always runs.
 * Integration part: against a REAL Redis (REDIS_TEST_URL, default 127.0.0.1:6379) under a
 * throw-away prefix; skipped when no Redis answers.
 */
const net = require('net');
const express = require('express');
const request = require('supertest');

const URL_ = process.env.REDIS_TEST_URL || 'redis://127.0.0.1:6379';
process.env.REDIS_URL = URL_;
process.env.REDIS_IN_TESTS = 'true';
process.env.REDIS_PREFIX = `jobblo-test-rm-${process.pid}`;

jest.mock('../models/SecurityEvent', () => ({ aggregate: jest.fn().mockResolvedValue([]), countDocuments: jest.fn().mockResolvedValue(0) }));
jest.mock('../services/pushNotifications', () => ({ deliverPush: jest.fn().mockResolvedValue(undefined) }));

const ri = require('../services/monitoring/redisInsights');

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

describe('redisInsights — pure helpers', () => {
  it('parses INFO, including key=value lists', () => {
    const info = ri.parseInfo('# Server\r\nredis_version:8.10.2\r\nuptime_in_seconds:42\r\n\r\n# Memory\r\nmem_fragmentation_ratio:1.25\r\nmaxmemory_policy:noeviction\r\n# Keyspace\r\ndb0:keys=12,expires=3,avg_ttl=0\r\n# Commandstats\r\ncmdstat_get:calls=5,usec=10,usec_per_call=2.00,rejected_calls=0,failed_calls=0\r\n');
    expect(info.server).toEqual({ redis_version: '8.10.2', uptime_in_seconds: 42 });
    expect(info.memory.mem_fragmentation_ratio).toBe(1.25);
    expect(info.memory.maxmemory_policy).toBe('noeviction');
    expect(info.keyspace.db0).toEqual({ keys: 12, expires: 3, avg_ttl: 0 });
    expect(info.commandstats.cmdstat_get.calls).toBe(5);
  });

  it('a search string can never widen the SCAN pattern', () => {
    expect(ri.escapeGlob('a*b?[c]\\')).toBe('a\\*b\\?\\[c\\]\\\\');
  });

  it('slowlog shows the command and key, never the values', () => {
    const e = ri.redactSlowlog([7, 1761280000, 25000, ['set', 'jobblo:cache:x', 'SECRET-VALUE', 'EX', '60'], '10.0.0.5:51234', 'jobblo:shared']);
    expect(e).toMatchObject({ id: 7, ms: 25, command: 'SET', key: 'jobblo:cache:x', args: 3, client: 'jobblo:shared', clientAddr: '10.0.0.5' });
    expect(JSON.stringify(e)).not.toContain('SECRET-VALUE');
  });

  it('never reads passwords through CONFIG GET', () => {
    expect(ri.SAFE_CONFIG).not.toEqual(expect.arrayContaining(['requirepass']));
    expect(ri.SAFE_CONFIG.some((k) => /pass|auth|user|acl/i.test(k))).toBe(false);
  });

  it('flags a maxmemory-policy that can delete queued jobs as critical', () => {
    const bad = ri.reviewConfig({ 'maxmemory-policy': 'allkeys-lru', maxmemory: '0' }, { production: true });
    expect(bad.find((c) => c.key === 'maxmemory-policy')).toMatchObject({ ok: false, severity: 'critical' });
    expect(bad.find((c) => c.key === 'maxmemory')).toMatchObject({ ok: false });
    const good = ri.reviewConfig({ 'maxmemory-policy': 'noeviction', maxmemory: '1073741824', appendonly: 'yes', 'slowlog-log-slower-than': '10000' }, { production: true });
    expect(good.filter((c) => !c.ok)).toEqual([]);
  });

  it('shows REDIS_URL without its password', () => {
    const d = ri.describeUrl('rediss://default:s3cret@cache.example.net:6380/2');
    expect(d).toEqual({ scheme: 'rediss', tls: true, host: 'cache.example.net', port: 6380, db: 2, user: 'default', password: 'set' });
    expect(JSON.stringify(d)).not.toContain('s3cret');
  });

  it('alerts: down, memory, evictions, backlog', () => {
    const t = { redisMemoryPct: 85, queueBacklog: 500 };
    expect(ri.evaluateRedisAlerts({ enabled: false }, t)).toEqual([]);
    expect(ri.evaluateRedisAlerts({ enabled: true, ok: false, error: 'ECONNREFUSED' }, t).map((a) => a.fingerprint)).toEqual(['redis_down']);
    const many = ri.evaluateRedisAlerts({ enabled: true, ok: true, memoryPct: 90, evictedKeys: 4, policy: 'allkeys-lru', backlog: [{ name: 'email', waiting: 501 }, { name: 'push', waiting: 3 }] }, t);
    expect(many.map((a) => a.fingerprint)).toEqual(['redis_memory', 'redis_evictions', 'queue_backlog:email']);
    expect(ri.evaluateRedisAlerts({ enabled: true, ok: true, memoryPct: 10, evictedKeys: 0, policy: 'noeviction', backlog: [] }, t)).toEqual([]);
  });

  it('the alert evaluator includes the Redis rules', () => {
    const { evaluateRules, DEFAULT_THRESHOLDS } = require('../services/monitoring/alerts');
    const calm = { mongoUp: true, api: { count: 0, c5xx: 0, p95: 0 }, criticalErrors: 0, criticalCodes: [], webhookFailures: 0, schedulerFailures: 0, failedJobs: [], loginFailureIps: [], queueStuck: 0, mobileCrashes: 0 };
    expect(evaluateRules({ ...calm, redis: { enabled: true, ok: false } }, DEFAULT_THRESHOLDS).map((a) => a.fingerprint)).toEqual(['redis_down']);
    expect(DEFAULT_THRESHOLDS).toMatchObject({ redisMemoryPct: 85, queueBacklog: 500 });
  });

  it('cache writes only touch known namespaces', async () => {
    await expect(ri.invalidateNamespace('sessions')).rejects.toMatchObject({ status: 404 });
    for (const key of [undefined, '', 'unknown:x', '../bull:email:1', { $gt: '' }]) await expect(ri.deleteCacheKey(key)).rejects.toMatchObject({ status: 400 });
  });

  it('page reads are computed once for simultaneous viewers, never cache a failure, and clear on writes', async () => {
    let n = 0;
    const read = ri._shared('memo-test', async (x) => {
      n += 1;
      return { x, n };
    });
    const results = await Promise.all(Array.from({ length: 50 }, () => read({ a: 1 })));
    expect(n).toBe(1);
    expect(new Set(results).size).toBe(1);
    await read({ a: 2 }); // different arguments, own entry
    expect(n).toBe(2);
    ri.clearMemo();
    await read({ a: 1 });
    expect(n).toBe(3);

    let fail = true;
    const flaky = ri._shared('memo-fail', async () => {
      if (fail) throw new Error('down');
      return 'up';
    });
    await expect(flaky()).rejects.toThrow('down');
    fail = false;
    await expect(flaky()).resolves.toBe('up');
  });

  it('key explorer rejects unknown groups and non-numeric cursors', async () => {
    await expect(ri.keys({ group: 'everything' })).rejects.toMatchObject({ status: 400 });
    await expect(ri.keys({ group: 'cache', cursor: '0 MATCH *' })).rejects.toMatchObject({ status: 400 });
  });

  it('rate-limit reset validates its input', async () => {
    const { ACTIONS } = require('../services/developer/sensitiveActions');
    const a = ACTIONS.rate_limit_reset;
    expect(a.selfService).toBe(true);
    await expect(a.prepare({ limiter: 'nope', client: '1.2.3.4' })).rejects.toThrow('Unknown rate limiter.');
    await expect(a.prepare({ limiter: 'api', client: '' })).rejects.toThrow();
    await expect(a.prepare({ limiter: 'api', client: 'x'.repeat(201) })).rejects.toThrow();
    expect(await a.prepare({ limiter: 'api', client: ' 1.2.3.4 ' })).toMatchObject({ limiter: 'api', client: '1.2.3.4' });
  });

  it('every Redis write route needs operations access; reads are developer-only', () => {
    const router = require('../routes/developer');
    const layers = router.stack.filter((l) => l.route?.path?.startsWith('/redis'));
    expect(layers.length).toBe(13);
    for (const l of layers) {
      const method = Object.keys(l.route.methods)[0];
      const handlers = l.route.stack.length;
      // GET: controller only. POST: requireAccess('operations') + controller.
      expect({ path: l.route.path, handlers }).toEqual({ path: l.route.path, handlers: method === 'get' ? 1 : 2 });
    }
    // The router-level guard (authenticate, requireDeveloper, limiter) runs before all of them.
    expect(router.stack.findIndex((l) => !l.route)).toBeLessThan(router.stack.findIndex((l) => l.route?.path === '/redis/overview'));
  });
});

describe('redisInsights — against a real Redis', () => {
  let up = false;
  let client;
  beforeAll(async () => {
    up = await reachable();
    if (up) client = require('../config/redis').getRedis();
  });
  afterAll(async () => {
    if (!up) return;
    await require('../services/queue').stopWorkers();
    const keys = await client.keys(`${process.env.REDIS_PREFIX}*`);
    if (keys.length) await client.del(...keys);
    await require('../config/redis').closeRedis();
  });
  const maybe = (name, fn, timeout = 20000) => it(name, async () => (up ? fn() : console.warn(`[skip] no Redis at ${URL_}`)), timeout);

  maybe('overview, memory, performance and config read the live server', async () => {
    const o = await ri.overview();
    expect(o).toMatchObject({ enabled: true, ok: true });
    expect(o.server.version).toMatch(/^\d+\./);
    expect(o.health.checks.length).toBeGreaterThan(0);
    const m = await ri.memory();
    expect(m.memory.used).toBeGreaterThan(0);
    expect(m.groups.map((g) => g.id)).toEqual(['cache', 'rateLimits', 'queues', 'sockets']);
    const p = await ri.performance();
    expect(p.commands.length).toBeGreaterThan(0);
    const c = await ri.config();
    expect(['set', 'not set']).toContain(c.url.password);
    expect(c.checks.map((x) => x.key)).toContain('maxmemory-policy');
  });

  maybe('cache manager: hits/misses, keys with TTL, selective invalidation', async () => {
    const cache = require('../utils/cache');
    const app = express();
    app.get('/a', cache.cacheJson('rm-test', 60), (req, res) => res.json({ n: 1 }));
    app.get('/b', cache.cacheJson('rm-test', 60), (req, res) => res.json({ n: 2 }));
    await request(app).get('/a');
    await request(app).get('/a');
    await request(app).get('/b');
    const info = await ri.cacheInfo();
    const ns = info.namespaces.find((n) => n.name === 'rm-test');
    expect(ns).toMatchObject({ ttlSec: 60, hits: 1, misses: 2 });
    expect(ns.keys.map((k) => k.key).sort()).toEqual(['rm-test:/a', 'rm-test:/b']);
    expect(ns.keys[0].ttlMs).toBeGreaterThan(50_000);

    await ri.deleteCacheKey('rm-test:/a');
    expect((await ri.cacheInfo()).namespaces.find((n) => n.name === 'rm-test').keys.map((k) => k.key)).toEqual(['rm-test:/b']);
    await ri.invalidateNamespace('rm-test');
    expect((await ri.cacheInfo()).namespaces.find((n) => n.name === 'rm-test').keys).toEqual([]);
  });

  maybe('key explorer lists only its prefix and treats the search as literal text', async () => {
    const P = process.env.REDIS_PREFIX;
    await client.set(`${P}:cache:x*y`, '1', 'EX', 60);
    await client.set(`${P}:cache:xay`, '1', 'EX', 60);
    await client.set(`other-app:cache:x*y`, '1', 'EX', 60);
    try {
      const r = await ri.keys({ group: 'cache', q: 'x*y' });
      expect(r.keys.map((k) => k.key)).toEqual([`${P}:cache:x*y`]);
      expect(r.keys[0]).toMatchObject({ type: 'string' });
      expect(r.keys[0].bytes).toBeGreaterThan(0);
      const all = await ri.keys({ group: 'cache' });
      expect(all.keys.every((k) => k.key.startsWith(`${P}:cache:`))).toBe(true);
      expect(JSON.stringify(all)).not.toContain('other-app');
    } finally {
      await client.del('other-app:cache:x*y');
    }
  });

  maybe('rate limit monitor shows the counter, marks it blocked, and the reset unblocks', async () => {
    const { makeLimiter } = require('../middleware/rateLimiter');
    const { ACTIONS } = require('../services/developer/sensitiveActions');
    const app = express();
    app.set('trust proxy', 'loopback');
    app.get('/x', makeLimiter('rm-test', { windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false, keyGenerator: () => 'client-1' }), (req, res) => res.json({ ok: true }));
    for (let i = 0; i < 2; i += 1) expect((await request(app).get('/x')).status).toBe(200);
    expect((await request(app).get('/x')).status).toBe(429);

    const r = await ri.rateLimits();
    const counter = r.counters.find((c) => c.limiter === 'rm-test');
    expect(counter).toMatchObject({ client: 'client-1', hits: 3, max: 2, blocked: true });
    expect(r.limiters.find((l) => l.name === 'rm-test')).toMatchObject({ windowMs: 60_000, max: 2 });

    const payload = await ACTIONS.rate_limit_reset.prepare({ limiter: 'rm-test', client: 'client-1' });
    await ACTIONS.rate_limit_reset.execute(payload);
    expect((await ri.rateLimits()).counters.find((c) => c.limiter === 'rm-test')).toBeUndefined();
    expect((await request(app).get('/x')).status).toBe(200);
  });

  maybe('workers: live workers, throughput and duration from real jobs', async () => {
    const queue = require('../services/queue');
    queue.startWorkers();
    for (let i = 0; i < 3; i += 1) await queue.enqueue('push', 'send', { userId: `u${i}`, message: { title: 't' } });
    const end = Date.now() + 10_000;
    let push;
    while (Date.now() < end) {
      push = (await ri.workers()).queues.find((q) => q.name === 'push');
      if (push.lastHour.completed >= 3) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(push.workers.length).toBeGreaterThanOrEqual(1);
    expect(push.here).toBe(true);
    expect(push.lastHour.completed).toBeGreaterThanOrEqual(3);
    expect(Math.max(...push.lastHour.perMinute)).toBeGreaterThanOrEqual(1);
    expect(push.avgMs).not.toBeNull();
  });

  maybe('alerts metrics read memory and backlog', async () => {
    const m = await ri.alertMetrics();
    expect(m).toMatchObject({ enabled: true, ok: true });
    expect(m.backlog.map((b) => b.name)).toEqual(['email', 'push', 'scheduler']);
  });
});
