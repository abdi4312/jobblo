import { expect, test } from '@playwright/test';

/**
 * The access token lives in memory only; nothing in localStorage is trusted as identity.
 *
 * `user-storage` used to persist the whole auth store — the access token for any XSS to
 * read, and `user` / `isAuthenticated` that the route guards trusted (editing `role` there
 * opened /dashboard). Now only notification preferences are stored, and every page load
 * restores the session from the httpOnly refresh cookie (simulated by the mock below).
 */

const API = 'http://127.0.0.1:5017';
const ALICE = { _id: 'alice', name: 'Alice', email: 'alice@example.test', role: 'user' };
const BOB = { _id: 'bob', name: 'Bob', email: 'bob@example.test', role: 'user' };

/** `server.session` = who the refresh cookie belongs to; mutate it to simulate changes. */
async function mockApi(page, server, { refreshDelayMs = 0 } = {}) {
  const calls = [];
  let n = 0;
  await page.route(`${API}/api/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const auth = request.headers().authorization || null;
    calls.push({ method: request.method(), pathname, auth });

    if (pathname === '/api/auth/refresh-token') {
      if (refreshDelayMs) await new Promise((r) => setTimeout(r, refreshDelayMs));
      if (!server.session) return route.fulfill({ status: 401, json: { error: 'Refresh token missing' } });
      n += 1;
      return route.fulfill({ json: { accessToken: `at-${server.session._id}-${n}` } });
    }
    if (pathname === '/api/auth/login') {
      server.session = ALICE;
      n += 1;
      return route.fulfill({ json: { user: ALICE, accessToken: `at-alice-${n}` } });
    }
    if (pathname === '/api/auth/profile') {
      const ok = server.session && auth?.startsWith(`Bearer at-${server.session._id}-`);
      if (!ok) return route.fulfill({ status: 401, json: { error: 'Invalid token' } });
      return route.fulfill({ json: server.session });
    }
    if (pathname === '/api/auth/logout') {
      server.session = null;
      return route.fulfill({ json: { message: 'ok' } });
    }
    return route.fulfill({ status: 404, json: { error: 'not mocked' } });
  });
  return calls;
}

const auth = (page) =>
  page.evaluate(() => {
    const { user, tokens, isAuthenticated, authReady } = window.__jobbloUserStore.getState();
    return { user, tokens, isAuthenticated, authReady };
  });
const storage = (page) => page.evaluate(() => ({ ...localStorage, ...sessionStorage }));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie-consent', 'rejected'));
});

test('password login works and the access token is never written to storage', async ({ page }) => {
  const server = { session: null };
  await mockApi(page, server);
  await page.goto('/login');
  await page.getByPlaceholder('deg@eksempel.no').fill('alice@example.test');
  await page.getByPlaceholder('Ditt passord').fill('Passord123');
  await page.locator('form button[type="submit"]').click();

  await expect.poll(async () => (await auth(page)).user?._id).toBe('alice');
  const state = await auth(page);
  expect(state.tokens.accessToken).toMatch(/^at-alice-/);
  const stored = JSON.stringify(await storage(page));
  expect(stored).not.toContain('at-alice');
  expect(stored).not.toMatch(/accessToken|refreshToken|"user"|isAuthenticated/);
  // The refresh cookie is httpOnly on the real server; the page can never see it.
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/refreshToken|accessToken/);
});

test('reload restores a legitimate session from the refresh cookie', async ({ page }) => {
  const server = { session: ALICE };
  await mockApi(page, server);
  await page.goto('/profile');
  await expect.poll(async () => (await auth(page)).user?._id).toBe('alice');
  await page.reload();
  await expect.poll(async () => (await auth(page)).user?._id).toBe('alice');
  expect(new URL(page.url()).pathname).toBe('/profile');
});

test('old persisted tokens are erased on first load; preferences and other keys survive', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(
      'user-storage',
      JSON.stringify({
        version: 0,
        state: {
          user: { _id: 'alice', role: 'superAdmin' },
          tokens: { accessToken: 'legacy-persisted-token' },
          isAuthenticated: true,
          notificationsEnabled: false,
          smsNotificationsEnabled: true,
        },
      })
    );
    localStorage.setItem('search_history_v2', '["maling"]');
  });
  await mockApi(page, { session: null });
  await page.goto('/home');
  await expect.poll(async () => (await auth(page)).authReady).toBe(true);

  const stored = JSON.parse((await storage(page))['user-storage']);
  expect(stored).toEqual({
    version: 1,
    state: {
      notificationsEnabled: false,
      browserNotificationsEnabled: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
    },
  });
  expect((await storage(page)).search_history_v2).toBe('["maling"]');
  expect((await auth(page)).isAuthenticated).toBe(false);
});

test('hand-edited storage cannot authenticate a visitor', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'user-storage',
      JSON.stringify({
        version: 1,
        state: { user: { _id: 'alice', role: 'user' }, tokens: { accessToken: 'tampered' }, isAuthenticated: true },
      })
    );
  });
  const calls = await mockApi(page, { session: null });
  await page.goto('/profile');
  await page.waitForURL('**/login');
  expect((await auth(page)).isAuthenticated).toBe(false);
  expect(calls.some((c) => c.auth?.includes('tampered'))).toBe(false);
});

test('a stored superAdmin role cannot open the admin dashboard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'user-storage',
      JSON.stringify({ version: 1, state: { user: { _id: 'alice', role: 'superAdmin' }, isAuthenticated: true } })
    );
  });
  await mockApi(page, { session: ALICE }); // server says: ordinary user
  await page.goto('/dashboard');
  await page.waitForURL('**/profile');
  expect((await auth(page)).user.role).toBe('user');
});

test('protected routes wait for the bootstrap instead of bouncing to /login', async ({ page }) => {
  await mockApi(page, { session: ALICE }, { refreshDelayMs: 1500 });
  await page.goto('/profile');
  await expect(page.getByRole('status')).toHaveText(/Laster/);
  expect(new URL(page.url()).pathname).toBe('/profile');
  await expect.poll(async () => (await auth(page)).user?._id).toBe('alice');
  expect(new URL(page.url()).pathname).toBe('/profile');
});

test('logout clears auth state; the next account does not inherit the previous profile', async ({ page }) => {
  const server = { session: ALICE };
  const calls = await mockApi(page, server);
  await page.goto('/profile');
  await expect.poll(async () => (await auth(page)).user?._id).toBe('alice');

  await page.evaluate(() => window.__jobbloUserStore.getState().logout());
  expect(await auth(page)).toMatchObject({ user: null, tokens: null, isAuthenticated: false });
  expect(calls.some((c) => c.pathname === '/api/auth/logout')).toBe(true);

  server.session = BOB; // someone else signs in on this browser
  await page.reload();
  await expect.poll(async () => (await auth(page)).user?._id).toBe('bob');
  expect((await auth(page)).tokens.accessToken).toMatch(/^at-bob-/);
});

test('an expired refresh session signs the browser out without a loop', async ({ page }) => {
  const server = { session: ALICE };
  const calls = await mockApi(page, server);
  await page.goto('/profile');
  await expect.poll(async () => (await auth(page)).user?._id).toBe('alice');

  server.session = null; // refresh cookie expired / revoked server-side
  await page.reload();
  await page.waitForURL('**/login');
  expect((await auth(page)).isAuthenticated).toBe(false);
  // Bounded: one bootstrap attempt after reload, no retry storm.
  const afterReload = calls.slice(calls.findLastIndex((c) => c.pathname === '/api/auth/profile') + 1);
  expect(afterReload.filter((c) => c.pathname === '/api/auth/refresh-token').length).toBeLessThanOrEqual(2);
});

test('no page URL ever carries a token', async ({ page }) => {
  const seen = [];
  page.on('framenavigated', (frame) => seen.push(frame.url()));
  await mockApi(page, { session: ALICE });
  await page.goto('/oauth-success');
  await page.waitForURL('**/home');
  expect(seen.filter((u) => /[?&#](token|access_token|accessToken)=/i.test(u))).toEqual([]);
});
