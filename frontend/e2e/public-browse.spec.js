import { expect, test } from '@playwright/test';

/**
 * Real end-to-end: no mocks. The isolated backend (playwright.config.js, port 5017,
 * local TEST database) serves the public job list and detail, so this catches a broken
 * API contract between backend and frontend, not just UI regressions.
 */

const API = 'http://127.0.0.1:5017';

test('a visitor browses public jobs and opens one', async ({ page, request }) => {
  const res = await request.get(`${API}/api/services?limit=12`);
  expect(res.ok()).toBe(true);
  const jobs = (await res.json()).data;
  test.skip(!jobs?.length, 'The local TEST database has no public jobs.');

  const serverErrors = [];
  page.on('response', (r) => {
    if (r.url().startsWith(API) && r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
  });

  await page.goto('/search');
  await page.getByRole('button', { name: 'Bare nødvendige' }).click(); // cookie banner covers the page
  const card = page.getByText(jobs[0].title, { exact: true }).first();
  await expect(card).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(new RegExp(`/job-listing/${jobs[0]._id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(jobs[0].title);
  expect(serverErrors).toEqual([]);
});

test('an unknown job shows a not-found state, not a crash', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto('/job-listing/000000000000000000000000');
  await expect(page.getByText('Oppdraget finnes ikke')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('the public API refuses what the UI must never send', async ({ request }) => {
  // Break-it checks from the browser's side of the trust boundary.
  expect((await request.get(`${API}/api/services/not-an-id`)).status()).toBe(400);
  expect((await request.get(`${API}/api/developer/queues`)).status()).toBe(401);
  expect((await request.post(`${API}/api/services`, { data: { title: 'x' }, headers: { Origin: 'http://127.0.0.1:5176' } })).status()).toBe(401);
  const big = await request.get(`${API}/api/services?limit=100000`);
  expect(big.ok()).toBe(true);
  expect((await big.json()).data.length).toBeLessThanOrEqual(100);
});
