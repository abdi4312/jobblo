/**
 * Simulate many users at once against a running API and report latency and errors.
 *
 *   node scripts/load-test.js --url http://localhost:5001 --users 50 --seconds 30
 *   node scripts/load-test.js --users 200 --seconds 60 --scenario browse
 *
 * Every virtual user gets its own client IP (X-Forwarded-For, trusted only from loopback —
 * see app.js `trust proxy`), so per-IP rate limits treat them as different people, like
 * real traffic. Run it against a local or staging API only, never production.
 *
 * Scenarios:
 *   browse  — the public site: job list (paged, searched, by category), job detail,
 *             categories, filter options, location tree, nearby jobs.
 *   abuse   — "break it": garbage ids, huge limits, injection-looking queries, bad JSON,
 *             oversized bodies. Every answer must be a clean 4xx, never a 5xx or a hang.
 *
 * Exit code 1 when any 5xx, network error or the p95 budget is broken.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), [])
);
const BASE = (args.url || 'http://localhost:5001').replace(/\/$/, '');
const USERS = Number(args.users || 50);
const SECONDS = Number(args.seconds || 30);
const SCENARIO = args.scenario || 'browse';
const P95_BUDGET_MS = Number(args.p95 || 300);
const ORIGIN = args.origin || 'http://localhost:5173';

/** Pure: percentile of a sorted array. */
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null);

/** Pure: summarize samples [{ name, status, ms, error }]. Exported for the test. */
function summarize(samples, seconds) {
  const by = new Map();
  for (const s of samples) {
    const r = by.get(s.name) || { name: s.name, n: 0, ms: [], statuses: {}, errors: 0 };
    r.n += 1;
    r.ms.push(s.ms);
    r.statuses[s.status || 'ERR'] = (r.statuses[s.status || 'ERR'] || 0) + 1;
    if (!s.status || s.status >= 500) r.errors += 1;
    by.set(s.name, r);
  }
  const rows = [...by.values()].map((r) => {
    const sorted = r.ms.sort((a, b) => a - b);
    return { name: r.name, n: r.n, p50: pct(sorted, 50), p95: pct(sorted, 95), p99: pct(sorted, 99), max: sorted.at(-1), errors: r.errors, statuses: r.statuses };
  });
  const all = samples.map((s) => s.ms).sort((a, b) => a - b);
  return { total: samples.length, rps: Math.round(samples.length / seconds), p50: pct(all, 50), p95: pct(all, 95), p99: pct(all, 99), errors: rows.reduce((a, r) => a + r.errors, 0), rows: rows.sort((a, b) => b.n - a.n) };
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

async function call(vu, name, path, init = {}) {
  const started = performance.now();
  try {
    const res = await fetch(BASE + path, {
      ...init,
      headers: { 'X-Forwarded-For': vu.ip, Origin: ORIGIN, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    return { name, status: res.status, ms: Math.round(performance.now() - started), body: text };
  } catch (err) {
    return { name, status: 0, ms: Math.round(performance.now() - started), error: err.name === 'TimeoutError' ? 'timeout' : err.message };
  }
}

async function seed() {
  const r = await fetch(`${BASE}/api/services?limit=50`);
  const j = await r.json().catch(() => ({}));
  const ids = (j.data || []).map((s) => s._id);
  const cats = await fetch(`${BASE}/api/categories`).then((x) => x.json()).catch(() => []);
  return { ids, categories: (Array.isArray(cats) ? cats : []).map((c) => c.name) };
}

const SCENARIOS = {
  browse: (vu, ctx) =>
    pick([
      () => call(vu, 'GET /api/services (page 1)', '/api/services?limit=20'),
      () => call(vu, 'GET /api/services (page n)', `/api/services?limit=20&page=${1 + Math.floor(Math.random() * 3)}`),
      () => call(vu, 'GET /api/services (search)', `/api/services?limit=20&search=${encodeURIComponent(pick(['hage', 'flytting', 'maling', 'rengjøring', 'zzz']))}`),
      () => ctx.categories.length && call(vu, 'GET /api/services (category)', `/api/services?limit=20&category=${encodeURIComponent(pick(ctx.categories))}`),
      () => ctx.ids.length && call(vu, 'GET /api/services/:id', `/api/services/${pick(ctx.ids)}`),
      () => call(vu, 'GET /api/categories', '/api/categories'),
      () => call(vu, 'GET /api/filter/options', '/api/filter/options'),
      () => call(vu, 'GET /api/location-filter/tree', '/api/location-filter/tree'),
      () => call(vu, 'GET /api/services/nearby', `/api/services/nearby?lat=${59 + Math.random()}&lng=${10 + Math.random()}&radius=25000`),
    ])(),
  abuse: (vu) =>
    pick([
      () => call(vu, 'bad id', '/api/services/not-an-id'),
      () => call(vu, 'unknown id', '/api/services/000000000000000000000000'),
      () => call(vu, 'huge limit', '/api/services?limit=100000000'),
      () => call(vu, 'regex bomb search', `/api/services?search=${encodeURIComponent('(a+)+$'.repeat(20))}`),
      () => call(vu, 'operator injection', '/api/services?userId[$ne]=null&category[$gt]='),
      () => call(vu, 'nearby garbage', '/api/services/nearby?lat=abc&lng=1e999&radius=-5'),
      () => call(vu, 'bad json login', '/api/auth/login', { method: 'POST', body: '{"email":' }),
      () => call(vu, 'oversized body', '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(13 * 1024 * 1024) }) }),
      () => call(vu, 'no auth', '/api/orders'),
      () => call(vu, 'forged token', '/api/users/me', { headers: { Authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJpZCI6IjEifQ.' } }),
      () => call(vu, 'developer api as anonymous', '/api/developer/overview'),
      () => call(vu, 'path traversal', '/api/upload/..%2f..%2f.env'),
    ])(),
};

async function main() {
  const ctx = await seed();
  console.log(`[load] ${USERS} users × ${SECONDS}s, scenario "${SCENARIO}" → ${BASE} (${ctx.ids.length} jobs, ${ctx.categories.length} categories)`);
  const samples = [];
  const until = Date.now() + SECONDS * 1000;
  await Promise.all(
    Array.from({ length: USERS }, async (_, i) => {
      const vu = { ip: `10.${100 + Math.floor(i / 250)}.${Math.floor((i % 250) / 1)}.${1 + (i % 250)}` };
      while (Date.now() < until) {
        const r = await SCENARIOS[SCENARIO](vu, ctx);
        if (r) samples.push(r);
        await new Promise((res) => setTimeout(res, 50 + Math.random() * 250)); // think time
      }
    })
  );
  const s = summarize(samples, SECONDS);
  console.log(`[load] ${s.total} requests, ${s.rps} req/s, p50 ${s.p50} ms, p95 ${s.p95} ms, p99 ${s.p99} ms, 5xx/network errors: ${s.errors}`);
  for (const r of s.rows) console.log(`  ${r.name.padEnd(34)} n=${String(r.n).padEnd(5)} p50=${String(r.p50).padEnd(5)} p95=${String(r.p95).padEnd(5)} p99=${String(r.p99).padEnd(5)} max=${String(r.max).padEnd(6)} ${JSON.stringify(r.statuses)}`);
  const bad = samples.filter((x) => !x.status || x.status >= 500).slice(0, 5);
  for (const b of bad) console.log(`  ✗ ${b.name}: ${b.status || b.error} ${String(b.body || '').slice(0, 160)}`);
  const failed = s.errors > 0 || (SCENARIO === 'browse' && s.p95 > P95_BUDGET_MS);
  console.log(failed ? `[load] FAIL (budget p95 ≤ ${P95_BUDGET_MS} ms, 0 errors)` : '[load] PASS');
  process.exitCode = failed ? 1 : 0;
}

if (require.main === module) main();
module.exports = { summarize, pct };
