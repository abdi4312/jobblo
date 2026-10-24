import { expect as baseExpect, test } from '@playwright/test';

// The Vite dev server compiles the (large, lazy) developer-console chunk on first request;
// with parallel workers that alone can take >5 s, the default expect timeout.
const expect = baseExpect.configure({ timeout: 20_000 });

/**
 * Developer console behind the authenticator gate, and the Queues page's dead-letter
 * actions. The API is mocked (shapes copied from a live /api/developer/queues response);
 * the backend's own enforcement is covered by backend/__tests__/mfa.test.js.
 */

const API = 'http://127.0.0.1:5017';
const DEV = { _id: 'dev-1', name: 'TEST Developer', email: 'dev@example.test', role: 'developer' };

const failedJob = (id) => ({
  id: String(id),
  name: 'otp',
  data: { to: 'q***@example.invalid', otpSealed: '[hidden]' },
  attemptsMade: 3,
  maxAttempts: 3,
  failedReason: 'connect ECONNREFUSED 127.0.0.1:1',
  createdAt: '2026-10-24T01:02:37.638Z',
  finishedAt: '2026-10-24T01:04:36.914Z',
});

const counts = (failed) => ({ waiting: 0, active: 0, delayed: 0, completed: 0, failed, paused: 0, prioritized: 0 });

async function mockApi(page, { mfa = { required: true, enabled: true, verified: true }, failed = [failedJob(25), failedJob(24)], access = 'operations' } = {}) {
  const calls = [];
  const state = { mfa: { ...mfa }, failed: [...failed] };
  await page.route(`${API}/api/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    calls.push({ method, pathname, body: request.postDataJSON?.() ?? null });
    const ok = (data) => route.fulfill({ json: { success: true, data } });

    if (pathname === '/api/auth/refresh-token') return route.fulfill({ json: { accessToken: 'at-dev' } });
    if (pathname === '/api/auth/profile') return route.fulfill({ json: DEV });
    if (pathname === '/api/auth/mfa' && method === 'GET') return route.fulfill({ json: state.mfa });
    if (pathname === '/api/auth/mfa/verify') {
      if (request.postDataJSON()?.code !== '123456') return route.fulfill({ status: 400, json: { message: 'That code is not right — try again.' } });
      state.mfa.verified = true;
      return route.fulfill({ json: { ok: true } });
    }
    // The backend refuses developer calls until the code is checked; so does this mock.
    if (pathname.startsWith('/api/developer/') && !state.mfa.verified) return route.fulfill({ status: 403, json: { code: 'MFA_REQUIRED' } });
    if (pathname === '/api/developer/me') {
      return ok({ ...DEV, environment: 'test', access, can: { triage: true, request: access !== 'readonly', execute: access === 'operations', approve: false } });
    }
    if (pathname === '/api/developer/queues') {
      return ok({
        broker: {
          mode: 'redis',
          redis: { enabled: true, ok: true, ms: 5 },
          redisState: { status: 'ready', lastError: null, lastErrorAt: null },
          inline: { ran: 0, failed: 0, lastError: null },
          queues: [
            { name: 'email', concurrency: 5, attempts: 5, counts: counts(state.failed.length), isPaused: false, workerHere: true, failed: state.failed, schedulers: [] },
            { name: 'push', concurrency: 10, attempts: 3, counts: counts(0), isPaused: false, workerHere: true, failed: [], schedulers: [] },
          ],
        },
        queues: [],
        scheduler: { enabled: true, jobs: [] },
        stuckAfterMinutes: 30,
        note: '',
      });
    }
    const retry = pathname.match(/^\/api\/developer\/queues\/(\w+)\/jobs\/(\w+)\/retry$/);
    const remove = method === 'DELETE' && pathname.match(/^\/api\/developer\/queues\/(\w+)\/jobs\/(\w+)$/);
    if (retry || remove) {
      const id = (retry || remove)[2];
      state.failed = state.failed.filter((j) => j.id !== id);
      return ok({ id });
    }
    if (pathname === '/api/rum') return route.fulfill({ json: { ok: true } });
    // Anything else the layout asks for: an empty, successful answer.
    return ok({});
  });
  return calls;
}

test('a developer must enter the authenticator code before the console loads', async ({ page }) => {
  const calls = await mockApi(page, { mfa: { required: true, enabled: true, verified: false } });
  await page.goto('/developer/queues');

  await expect(page.getByText('Two-factor sign-in')).toBeVisible();
  const input = page.getByLabel('Authenticator code');
  const verify = page.getByRole('button', { name: 'Verify' });
  await expect(verify).toBeDisabled();

  // Letters are dropped; a wrong code shows the server's message and clears the field.
  await input.fill('12ab34');
  await expect(input).toHaveValue('1234');
  await input.fill('000000');
  await verify.click();
  await expect(page.getByRole('alert')).toHaveText('That code is not right — try again.');
  await expect(input).toHaveValue('');
  expect(calls.some((c) => c.pathname === '/api/developer/queues')).toBe(false);

  await input.fill('123456');
  await verify.click();
  await expect(page.getByText('Failed (dead letters)')).toBeVisible();
  expect(calls.filter((c) => c.pathname === '/api/auth/mfa/verify').map((c) => c.body)).toEqual([{ code: '000000' }, { code: '123456' }]);
});

test('first sign-in shows the QR set-up instead of a code prompt', async ({ page }) => {
  await mockApi(page, { mfa: { required: true, enabled: false, verified: false } });
  await page.route(`${API}/api/auth/mfa/setup`, (route) =>
    route.fulfill({ json: { secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/Jobblo:dev@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Jobblo' } })
  );
  await page.goto('/developer/queues');
  await expect(page.getByText('Set up an authenticator app')).toBeVisible();
  await page.getByText("Can't scan? Enter this key instead").click();
  await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and turn on' })).toBeDisabled();
});

test('an ordinary user is sent away from /developer', async ({ page }) => {
  await mockApi(page);
  await page.route(`${API}/api/auth/profile`, (route) => route.fulfill({ json: { ...DEV, role: 'user' } }));
  await page.goto('/developer/queues');
  await expect(page).toHaveURL(/\/profile$/);
});

test('dead-letter jobs can be retried and removed from the Queues page', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/developer/queues');

  await expect(page.getByText('#25 otp · 3/3 attempts', { exact: false })).toBeVisible();
  await expect(page.getByText('#24 otp · 3/3 attempts', { exact: false })).toBeVisible();
  // Sealed OTPs never reach the page.
  await expect(page.getByText('[hidden]').first()).toBeAttached();

  await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
  await expect(page.getByText('Job #25 queued again')).toBeVisible();
  await expect(page.getByText('#25 otp', { exact: false })).toHaveCount(0);

  await page.getByRole('button', { name: 'Remove job' }).click();
  await expect(page.getByText('Job #24 removed')).toBeVisible();
  await expect(page.getByText('Failed (dead letters)')).toHaveCount(0);

  expect(calls.filter((c) => c.method !== 'GET' && c.pathname.startsWith('/api/developer/')).map((c) => `${c.method} ${c.pathname}`)).toEqual([
    'POST /api/developer/queues/email/jobs/25/retry',
    'DELETE /api/developer/queues/email/jobs/24',
  ]);
});

test('read-only developers see the dead letters but no buttons', async ({ page }) => {
  await mockApi(page, { access: 'readonly' });
  await page.goto('/developer/queues');
  await expect(page.getByText('Failed (dead letters)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove job' })).toHaveCount(0);
});
