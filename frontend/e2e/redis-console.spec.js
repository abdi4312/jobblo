import { expect as baseExpect, test } from '@playwright/test';

/**
 * Redis management pages (/developer/redis/*). The API is mocked with shapes taken from a
 * live Redis-mode server; the backend side is covered by backend/__tests__/redisManagement.test.js.
 */

// The developer-console chunk compiles on first request in the Vite dev server.
const expect = baseExpect.configure({ timeout: 20_000 });

const API = 'http://127.0.0.1:5017';
const DEV = { _id: 'dev-1', name: 'TEST Developer', email: 'dev@example.test', role: 'developer' };
const STATUS = { enabled: true, ok: true, error: null, ms: 1, state: { status: 'ready', lastError: null, lastErrorAt: null }, prefix: 'jobblo' };
const OFF = { ...STATUS, enabled: false, ok: false, ms: null, state: { status: 'off', lastError: null, lastErrorAt: null } };

const SECTIONS = [
  ['', 'Redis Overview'],
  ['memory', 'Memory'],
  ['cache', 'Cache Manager'],
  ['keys', 'Key Explorer'],
  ['queues', 'Queues & Background Jobs'],
  ['workers', 'Workers'],
  ['realtime', 'Realtime Chat'],
  ['rate-limits', 'Rate Limits'],
  ['performance', 'Performance'],
  ['alerts', 'Alerts'],
  ['config', 'Configuration'],
  ['audit', 'Audit Log'],
];

const memory = { used: 2_400_000, peak: 2_700_000, rss: 2_400_000, dataset: 1_200_000, luaAndScripts: 400_000, max: null, system: 16e9, pct: null, policy: 'noeviction', fragmentation: 1, allocator: 'libc', evictedKeys: 0, expiredKeys: 78 };

function payloads(state) {
  const base = state.redisOff ? OFF : STATUS;
  return {
    overview: { ...base, connections: [{ label: 'shared', status: 'ready' }], server: { version: '8.10.2', mode: 'standalone', os: 'Linux', uptimeSec: 3600, port: 6379 }, clients: { connected: 12, blocked: 3, maxclients: 10000 }, latency: { min: 0.3, avg: 0.8, max: 1.5 }, opsPerSec: 109, hitRate: 39, memory, keyspace: { db0: { keys: 71, expires: 5, avg_ttl: 0 } }, health: { score: 100, checks: [{ key: 'ping', ok: true, label: 'Ping 0.8 ms' }] } },
    memory: { ...base, memory, groups: [{ id: 'cache', label: 'Response cache', sampledKeys: 1, complete: true, bytes: 2680 }], dbsize: 71 },
    cache: { ...base, store: 'redis', localEntries: 0, namespaces: [{ name: 'categories', ttlSec: 300, hits: 9, misses: 1, hitRate: 90, keys: state.cacheKeys.map((key) => ({ key, type: 'string', ttlMs: 250_000, bytes: 2680 })) }] },
    keys: { ...base, group: 'cache', groups: [{ id: 'cache', label: 'Response cache', match: 'jobblo:cache:' }, { id: 'queues', label: 'BullMQ queues', match: 'jobblo:bull:' }], keys: [{ key: 'jobblo:cache:categories:/api/categories', type: 'string', ttlMs: 250_000, bytes: 2680 }], cursor: '0', complete: true, dbsize: 71 },
    queues: { broker: { mode: 'redis', redis: { enabled: true, ok: true, ms: 1 }, redisState: STATUS.state, inline: { ran: 0, failed: 0, lastError: null }, queues: [] }, queues: [], scheduler: { enabled: true, jobs: [] }, stuckAfterMinutes: 30, note: '' },
    workers: { ...base, mode: 'redis', inline: { ran: 0, failed: 0, lastError: null }, queues: [{ name: 'push', concurrency: 10, attempts: 3, paused: false, here: true, counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }, workers: [{ id: '11', name: 'push', addr: '10.0.0.4', ageSec: 800, idleSec: 1 }], lastHour: { completed: 20, failed: 0, perMinute: [0, 0, 20] }, total: { completed: 20, failed: 0 }, avgMs: 28, maxMs: 90 }] },
    realtime: { ...base, running: true, adapter: 'redis', local: { sockets: 4, rooms: 6, onlineUsers: 3 }, cluster: { servers: 2, sockets: 9, roundTripMs: 2 }, pubsub: { channels: [{ channel: 'jobblo:socket.io-request#/#', subscribers: 2 }], connections: [{ label: 'socket:pub', status: 'ready' }] } },
    'rate-limits': { ...base, store: 'redis', limiters: [{ name: 'auth', windowMs: 900_000, max: 20, failedOnly: true }], counters: state.counters, complete: true, blocked: { total: 1, byRoute: [{ route: '/api/auth/login', n: 1, last: '2026-10-24T01:00:00Z' }], byIp: [{ ip: '203.0.113.9', n: 1, last: '2026-10-24T01:00:00Z' }] } },
    performance: { ...base, opsPerSec: 109, totalCommands: 5000, inputKbps: 6, outputKbps: 9, connections: { connected: 12, blocked: 3, received: 40, rejected: 0 }, keyspace: { hits: 9, misses: 1 }, latency: { min: 0.3, avg: 0.8, max: 1.5 }, latencyEvents: [], commands: [{ command: 'INFO', calls: 28, usec: 34675, usecPerCall: 1238, failed: 0 }], slowlog: [{ id: 0, at: '2026-10-24T06:33:38Z', ms: 30.18, command: 'SET', key: 'jobblo:cache:x', args: 3, client: 'jobblo:shared', clientAddr: '10.0.0.4' }] },
    alerts: { enabled: true, metrics: { enabled: true, ok: true, memoryPct: null, evictedKeys: 0, policy: 'noeviction', backlog: [{ name: 'email', waiting: 0 }] }, rules: [{ key: 'redis_down', label: 'Redis unreachable', severity: 'critical', threshold: 'any failed ping', firing: [] }], incidents: [] },
    config: { ...base, url: { scheme: 'rediss', tls: true, host: 'cache.example.net', port: 6380, db: 0, user: 'default', password: 'set' }, environment: 'production', workersEnabled: true, settings: { 'maxmemory-policy': 'allkeys-lru', maxmemory: '0' }, configError: null, checks: [{ key: 'maxmemory-policy', value: 'allkeys-lru', expected: 'noeviction', ok: false, severity: 'critical', why: 'BullMQ requires noeviction.' }] },
    audit: { logs: [{ _id: 'a1', description: 'Redis cache: invalidated namespace categories', metadata: { area: 'developer.redis' }, createdAt: '2026-10-24T01:00:00Z', adminId: { name: 'TEST Developer', email: 'dev@example.test', role: 'developer' } }] },
  };
}

async function mockApi(page, { access = 'operations', redisOff = false } = {}) {
  const calls = [];
  const state = { redisOff, cacheKeys: ['categories:/api/categories'], counters: [{ limiter: 'auth', client: '203.0.113.9', hits: 21, max: 20, resetInMs: 600_000, blocked: true }] };
  await page.route(`${API}/api/**`, async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const method = request.method();
    calls.push({ method, pathname, query: Object.fromEntries(searchParams), body: request.postDataJSON?.() ?? null, stepUp: request.headers()['x-step-up-token'] || null });
    const ok = (data) => route.fulfill({ json: { success: true, data } });

    if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'at-dev' } });
    if (pathname === '/api/auth/profile') return route.fulfill({ json: DEV });
    if (pathname === '/api/auth/mfa') return route.fulfill({ json: { required: true, enabled: true, verified: true } });
    if (pathname === '/api/developer/me') return ok({ ...DEV, environment: 'test', access, can: { triage: access !== 'readonly', request: access === 'operations', execute: false, approve: false } });
    if (pathname === '/api/developer/queues') return ok(payloads(state).queues);
    const read = pathname.match(/^\/api\/developer\/redis\/([\w-]+)$/);
    if (read && method === 'GET') return ok(payloads(state)[read[1]]);
    if (method === 'POST' && pathname === '/api/developer/redis/cache/categories/invalidate') {
      state.cacheKeys = [];
      return ok({ namespace: 'categories' });
    }
    if (pathname === '/api/developer/step-up/send') return ok({ sentTo: 'd***@example.test' });
    if (pathname === '/api/developer/step-up/verify') return ok({ token: 'st-1', expiresAt: new Date(Date.now() + 600_000).toISOString() });
    if (pathname === '/api/developer/actions/rate_limit_reset') {
      if (request.headers()['x-step-up-token'] !== 'st-1') return route.fulfill({ status: 401, json: { success: false, code: 'STEP_UP_REQUIRED', message: 'Confirm with a one-time code first.' } });
      state.counters = [];
      return ok({ executed: true, summary: 'Reset rate limit auth for 203.0.113.9', risk: null });
    }
    if (pathname === '/api/rum') return route.fulfill({ json: { ok: true } });
    return ok({});
  });
  return calls;
}

test('the sidebar has the 12 Redis pages and each one opens', async ({ page }) => {
  test.setTimeout(90_000); // 12 pages, each a cold dev-server compile on the first run
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await mockApi(page);
  await page.goto('/developer/redis');
  await expect(page.getByRole('heading', { level: 1, name: 'Redis Overview' })).toBeVisible();
  for (const [path, title] of SECTIONS) {
    const label = title === 'Queues & Background Jobs' ? 'Queue Manager' : title;
    await page.getByRole('link', { name: label, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/developer/redis${path ? `/${path}` : ''}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});

test('an unknown section goes back to the overview', async ({ page }) => {
  await mockApi(page);
  await page.goto('/developer/redis/flushall');
  await expect(page).toHaveURL(/\/developer\/redis$/);
});

test('without REDIS_URL the pages say so instead of showing empty numbers', async ({ page }) => {
  await mockApi(page, { redisOff: true });
  await page.goto('/developer/redis');
  await expect(page.getByText('Redis is not configured')).toBeVisible();
  await expect(page.getByText('Running in-process')).toBeVisible();
});

test('configuration shows the host but never the password, and flags a dangerous policy', async ({ page }) => {
  await mockApi(page);
  await page.goto('/developer/redis/config');
  await expect(page.getByText('cache.example.net:6380')).toBeVisible();
  await expect(page.getByText('default / set')).toBeVisible();
  await expect(page.getByText(/Now allkeys-lru, expected noeviction/)).toBeVisible();
});

test('a namespace can be invalidated after confirming', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/developer/redis/cache');
  await expect(page.getByText('categories:/api/categories')).toBeVisible();

  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Invalidate namespace' }).click();
  const writes = () => calls.filter((c) => c.method === 'POST' && c.pathname.startsWith('/api/developer/redis'));
  expect(writes()).toEqual([]); // cancelled: nothing sent

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Invalidate namespace' }).click();
  await expect(page.getByText('Cache "categories" invalidated')).toBeVisible();
  await expect(page.getByText('Nothing cached right now')).toBeVisible();
  expect(writes().map((c) => c.pathname)).toEqual(['/api/developer/redis/cache/categories/invalidate']);
});

test('a blocked client is reset only with a reason and a one-time code', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/developer/redis/rate-limits');
  await expect(page.getByText('203.0.113.9').first()).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();

  const confirm = page.getByRole('button', { name: 'Reset rate limit' });
  await expect(confirm).toBeDisabled(); // a reason is required
  await page.getByLabel('Reason').fill('Office locked out after password change');
  await confirm.click();

  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByPlaceholder('123456').fill('123456');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('Done: Reset rate limit auth for 203.0.113.9')).toBeVisible();
  await expect(page.getByText('No active counters')).toBeVisible();
  const action = calls.filter((c) => c.pathname === '/api/developer/actions/rate_limit_reset').at(-1);
  expect(action).toMatchObject({ stepUp: 'st-1', body: { input: { limiter: 'auth', client: '203.0.113.9' }, reason: 'Office locked out after password change' } });
});

test('read-only developers see Redis data but no write buttons', async ({ page }) => {
  await mockApi(page, { access: 'readonly' });
  await page.goto('/developer/redis/cache');
  await expect(page.getByText('categories:/api/categories')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invalidate namespace' })).toHaveCount(0);
  await page.goto('/developer/redis/rate-limits');
  await expect(page.getByText('203.0.113.9').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0);
});

test('the key explorer sends the search as plain text and pages with the cursor', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/developer/redis/keys');
  await expect(page.getByText('jobblo:cache:categories:/api/categories')).toBeVisible();
  await page.getByLabel('Search keys').fill('x*y');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => calls.filter((c) => c.pathname === '/api/developer/redis/keys').at(-1)?.query).toMatchObject({ group: 'cache', q: 'x*y', cursor: '0' });
  await page.getByRole('tab', { name: 'BullMQ queues' }).click();
  await expect.poll(() => calls.filter((c) => c.pathname === '/api/developer/redis/keys').at(-1)?.query).toMatchObject({ group: 'queues' });
});
