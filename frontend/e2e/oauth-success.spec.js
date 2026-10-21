import { expect, test } from '@playwright/test';

/**
 * Web OAuth arrival page (/oauth-success).
 *
 * It used to store whatever `?token=` it was handed, so a link carrying an attacker's
 * access token logged the victim into the attacker's account (login CSRF). It now
 * ignores the URL and relies on the page-load bootstrap, which trades the httpOnly
 * session cookie the OAuth callback set (POST /api/auth/refresh-token, simulated here)
 * for an in-memory access token.
 *
 * `cookieSession` in the mock is who the browser's refresh cookie belongs to.
 */

const API = 'http://127.0.0.1:5017';
const VICTIM = { _id: 'victim', name: 'Victim', email: 'victim@example.test', role: 'user' };
const NEW_USER = { _id: 'oauth-user', name: 'OAuth', email: 'oauth@example.test', role: 'user' };
const ATTACKER_TOKEN = 'attacker.forged.token';

async function mockApi(page, { cookieSession, profileFailsOnce = false } = {}) {
  const calls = [];
  let profileCalls = 0;
  let refreshCount = 0;
  await page.addInitScript(() => localStorage.setItem('cookie-consent', 'rejected'));
  await page.route(`${API}/api/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const auth = request.headers().authorization || null;
    calls.push({ method: request.method(), pathname, auth });

    if (pathname === '/api/auth/refresh-token') {
      if (!cookieSession) return route.fulfill({ status: 401, json: { error: 'Refresh token missing' } });
      refreshCount += 1;
      return route.fulfill({ json: { accessToken: `at-${cookieSession._id}-${refreshCount}` } });
    }
    if (pathname === '/api/auth/profile') {
      profileCalls += 1;
      const expected = cookieSession && auth?.startsWith(`Bearer at-${cookieSession._id}-`);
      if (!expected || (profileFailsOnce && profileCalls === 1)) {
        return route.fulfill({ status: 401, json: { error: 'Token expired', code: 'TOKEN_EXPIRED' } });
      }
      return route.fulfill({ json: cookieSession });
    }
    if (pathname === '/api/auth/logout') return route.fulfill({ json: { message: 'ok' } });
    return route.fulfill({ status: 404, json: { error: 'not mocked' } });
  });
  return calls;
}

/** In-memory auth state (dev-only window hook from main.tsx). */
const auth = (page) =>
  page.evaluate(() => {
    const { user, tokens, isAuthenticated, authReady } = window.__jobbloUserStore.getState();
    return { user, tokens, isAuthenticated, authReady };
  });

test('a forged ?token= cannot sign in a visitor who has no session', async ({ page }) => {
  const calls = await mockApi(page, { cookieSession: null });
  await page.goto(`/oauth-success?token=${ATTACKER_TOKEN}`);

  await expect(page.getByText('Innloggingen mislyktes')).toBeVisible();
  expect(new URL(page.url()).search).not.toContain('token');
  const state = await auth(page);
  expect(state.isAuthenticated).toBe(false);
  expect(JSON.stringify(state)).not.toContain(ATTACKER_TOKEN);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(ATTACKER_TOKEN);
  expect(calls.some((c) => c.auth?.includes(ATTACKER_TOKEN))).toBe(false);
});

test("a forged ?token= does not switch a signed-in victim to the attacker's account", async ({ page }) => {
  const calls = await mockApi(page, { cookieSession: VICTIM });
  await page.goto(`/oauth-success?token=${ATTACKER_TOKEN}`);

  await expect(page.getByText('Velkommen tilbake!')).toBeVisible();
  const state = await auth(page);
  expect(state.user._id).toBe('victim');
  expect(state.tokens.accessToken).toMatch(/^at-victim-/);
  expect(calls.some((c) => c.auth?.includes(ATTACKER_TOKEN))).toBe(false);
});

test('a real OAuth sign-in (cookie session) is completed from the server session', async ({ page }) => {
  const calls = await mockApi(page, { cookieSession: NEW_USER });
  await page.goto('/oauth-success');

  await expect(page.getByText('Velkommen tilbake!')).toBeVisible();
  const state = await auth(page);
  expect(state.isAuthenticated).toBe(true);
  expect(state.user._id).toBe('oauth-user');
  // One cookie-only bootstrap refresh for the page, shared with OAuthSuccess.
  expect(calls.filter((c) => c.pathname === '/api/auth/refresh-token' && !c.auth)).toHaveLength(1);
  await page.waitForURL('**/home');

  // Reload: the session comes back from the refresh cookie, not from storage.
  await page.reload();
  await expect.poll(async () => (await auth(page)).user?._id).toBe('oauth-user');
});

test('an ?error= callback leaves the current account untouched', async ({ page }) => {
  await mockApi(page, { cookieSession: VICTIM });
  await page.goto('/oauth-success?error=google_invalid_state');

  await expect(page.getByText('Innloggingen mislyktes')).toBeVisible();
  await expect.poll(async () => (await auth(page)).user?._id).toBe('victim');
});

test('an expired access token is refreshed and the newest token is used', async ({ page }) => {
  const calls = await mockApi(page, { cookieSession: NEW_USER, profileFailsOnce: true });
  await page.goto('/oauth-success');

  await expect(page.getByText('Velkommen tilbake!')).toBeVisible();
  const state = await auth(page);
  expect(state.user._id).toBe('oauth-user');
  const profiles = calls.filter((c) => c.pathname === '/api/auth/profile');
  expect(profiles.at(-1).auth).toBe(`Bearer ${state.tokens.accessToken}`);
});

test('a session the server no longer honours leaves the browser signed out', async ({ page }) => {
  await mockApi(page, { cookieSession: null });
  await page.goto('/oauth-success');

  await expect(page.getByText('Innloggingen mislyktes')).toBeVisible();
  const state = await auth(page);
  expect(state.isAuthenticated).toBe(false);
  expect(state.tokens).toBeNull();
});
