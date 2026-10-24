const mongoose = require('mongoose');

/**
 * Synthetic monitoring: probe the API, realtime endpoint, web app and (optionally) a full
 * login journey on a timer, the way a user would, and record uptime and latency.
 *
 * ponytail: probes run from this same server, so they catch broken routes, slow
 * dependencies and a dead web app — but not "the whole server is down". Point an external
 * uptime monitor (UptimeRobot, Better Stack…) at the API root for that.
 *
 * Probe base URLs:
 *   SYNTHETIC_API_URL  default http://127.0.0.1:$PORT — set to the public https URL to cover nginx + TLS
 *   SYNTHETIC_WEB_URL  default PUBLIC_SITE_URL || FRONTEND_URL — omitted when neither is set
 *   SYNTHETIC_USER_EMAIL / SYNTHETIC_USER_PASSWORD — a dedicated, unprivileged account for the login journey
 * Custom checks may only target these hosts plus SYNTHETIC_ALLOWED_HOSTS (comma-separated),
 * so the dashboard cannot be used to make the server request arbitrary internal URLs.
 */

const MINUTE = 60 * 1000;
const STEP_TIMEOUT_MS = 10_000;
const UA = 'JobbloSynthetic/1.0';

const trimSlash = (u) => (u ? String(u).replace(/\/+$/, '') : null);
const bases = () => ({
  api: trimSlash(process.env.SYNTHETIC_API_URL) || `http://127.0.0.1:${process.env.PORT || 5001}`,
  web: trimSlash(process.env.SYNTHETIC_WEB_URL || process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL),
});

function allowedHosts() {
  const { api, web } = bases();
  const hosts = new Set((process.env.SYNTHETIC_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
  for (const u of [api, web, process.env.FRONTEND_URL, process.env.PUBLIC_SITE_URL]) {
    try {
      if (u) hosts.add(new URL(u).host.toLowerCase());
    } catch {
      /* not a URL */
    }
  }
  return hosts;
}

/** Pure-ish: is this URL a permitted custom probe target? Unit-tested. */
function checkUrlAllowed(raw, hosts = allowedHosts()) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return 'Not a valid URL.';
  }
  if (!['http:', 'https:'].includes(u.protocol)) return 'Only http and https URLs are allowed.';
  if (u.username || u.password) return 'URLs with credentials are not allowed.';
  if (!hosts.has(u.host.toLowerCase())) return `Host ${u.host} is not allowed. Allowed: ${[...hosts].join(', ') || 'none'} (extend with SYNTHETIC_ALLOWED_HOSTS).`;
  return null;
}

/** One HTTP step. Never follows redirects (a redirect could leave the allowed hosts). */
async function step(name, url, { method = 'GET', headers = {}, body, expectStatus = 200, expect } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'application/json, text/html;q=0.9', ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
    });
    const text = method === 'HEAD' ? '' : await res.text();
    const ms = Date.now() - started;
    if (res.status !== expectStatus) return { name, ok: false, status: res.status, ms, error: `Expected ${expectStatus}, got ${res.status}` };
    const problem = expect ? expect(text, res) : null;
    return problem ? { name, ok: false, status: res.status, ms, error: problem } : { name, ok: true, status: res.status, ms, text, res };
  } catch (e) {
    return { name, ok: false, status: null, ms: Date.now() - started, error: e.name === 'TimeoutError' ? `Timed out after ${STEP_TIMEOUT_MS / 1000}s` : e.cause?.code || e.message };
  }
}

const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
const isJson = (text) => (json(text) === undefined ? 'Response is not JSON' : null);

/** Built-in probes. Each returns the list of steps it ran (stops at the first failure). */
const BUILT_IN = [
  { key: 'api', name: 'API root', describe: 'GET / answers with JSON', run: ({ api }) => [step('GET /', `${api}/`, { expect: isJson })] },
  { key: 'services', name: 'Job listing', describe: 'GET /api/services returns JSON', run: ({ api }) => [step('GET /api/services', `${api}/api/services?limit=1`, { expect: isJson })] },
  { key: 'categories', name: 'Categories', describe: 'GET /api/categories returns JSON', run: ({ api }) => [step('GET /api/categories', `${api}/api/categories`, { expect: isJson })] },
  {
    key: 'realtime',
    name: 'Realtime (socket.io)',
    describe: 'socket.io polling handshake opens a session',
    run: ({ api }) => [step('socket.io handshake', `${api}/socket.io/?EIO=4&transport=polling`, { expect: (t) => (t.startsWith('0{') ? null : 'Unexpected handshake payload') })],
  },
  {
    key: 'web',
    name: 'Web app',
    describe: 'Home page serves the React shell',
    enabled: ({ web }) => Boolean(web),
    run: ({ web }) => [step('GET web /', `${web}/`, { expect: (t) => (/<div id="root"/.test(t) ? null : 'Page does not contain the app root') })],
  },
  {
    key: 'geonorge',
    name: 'Geocoding (Geonorge)',
    describe: 'Kartverket address search used by the app answers',
    enabled: () => process.env.SYNTHETIC_GEO !== 'false',
    run: () => [step('GET ws.geonorge.no/adresser/v1/sok', 'https://ws.geonorge.no/adresser/v1/sok?sok=Karl%20Johans%20gate%201&treffPerSide=1', { expect: (t) => (Array.isArray(json(t)?.adresser) ? null : 'No address list in response') })],
  },
  {
    key: 'login',
    name: 'Login journey',
    describe: 'Log in → load profile → log out, with the synthetic account',
    enabled: () => Boolean(process.env.SYNTHETIC_USER_EMAIL && process.env.SYNTHETIC_USER_PASSWORD),
    run: async ({ api }) => {
      const login = await step('POST /api/auth/login', `${api}/api/auth/login`, {
        method: 'POST',
        body: { email: process.env.SYNTHETIC_USER_EMAIL, password: process.env.SYNTHETIC_USER_PASSWORD },
        expect: (t) => (json(t)?.accessToken ? null : 'No access token in response'),
      });
      if (!login.ok) return [login];
      const auth = { Authorization: `Bearer ${json(login.text).accessToken}` };
      const profile = await step('GET /api/auth/profile', `${api}/api/auth/profile`, { headers: auth, expect: isJson });
      // Always end the session, even when the profile step failed.
      const logout = await step('POST /api/auth/logout', `${api}/api/auth/logout`, { method: 'POST', headers: auth });
      return [login, profile, logout];
    },
  },
];

const customProbe = (c) => ({
  key: String(c._id),
  name: c.name,
  custom: true,
  describe: `${c.method} ${c.url} → ${c.expectStatus}${c.expectText ? ` containing "${c.expectText}"` : ''}`,
  run: () => {
    const blocked = checkUrlAllowed(c.url);
    if (blocked) return [{ name: `${c.method} ${c.url}`, ok: false, status: null, ms: 0, error: blocked }];
    return [step(`${c.method} ${c.url}`, c.url, { method: c.method, expectStatus: c.expectStatus, expect: c.expectText ? (t) => (t.includes(c.expectText) ? null : `Body does not contain "${c.expectText}"`) : null })];
  },
});

async function probes() {
  const b = bases();
  const SyntheticCheck = require('../../models/SyntheticCheck');
  const custom = await SyntheticCheck.find({ enabled: true }).lean();
  return [...BUILT_IN.filter((p) => !p.enabled || p.enabled(b)), ...custom.map(customProbe)];
}

async function runProbe(p, trigger = 'schedule') {
  const steps = await Promise.all(await p.run(bases()));
  const failed = steps.find((s) => !s.ok);
  const doc = {
    key: p.key,
    name: p.name,
    at: new Date(),
    ok: !failed,
    latencyMs: steps.reduce((a, s) => a + (s.ms || 0), 0),
    status: (failed || steps[steps.length - 1])?.status ?? null,
    error: failed?.error ? String(failed.error).slice(0, 500) : null,
    steps: steps.map(({ name, ok, status, ms, error }) => ({ name, ok, status, ms, error })),
    trigger,
  };
  await require('../../models/SyntheticRun').create(doc);
  return doc;
}

let running = false;
async function runAll({ key = null, trigger = 'schedule' } = {}) {
  if (mongoose.connection.readyState !== 1) return [];
  const list = (await probes()).filter((p) => !key || p.key === key);
  return Promise.all(list.map((p) => runProbe(p, trigger).catch((e) => ({ key: p.key, name: p.name, ok: false, error: e.message }))));
}

function startSynthetic() {
  if (process.env.ENABLE_SYNTHETIC === 'false' || process.env.NODE_ENV === 'test') return;
  const every = Math.max(1, Number(process.env.SYNTHETIC_INTERVAL_MIN) || 5) * MINUTE;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runAll();
    } catch (e) {
      console.error('[synthetic] run failed:', e.message);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 30_000).unref();
  setInterval(tick, every).unref();
}

module.exports = { BUILT_IN, bases, allowedHosts, checkUrlAllowed, probes, runAll, startSynthetic };
