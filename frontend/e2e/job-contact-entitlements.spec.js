import { expect, test } from '@playwright/test';

const user = {
  _id: 'e2e-contact-user',
  name: 'TEST Customer',
  email: 'customer@example.test',
  role: 'user',
  subscription: 'Standard',
  monthlyContactUsage: 5,
};

const service = {
  _id: 'job-v2-contact',
  title: 'TEST oppdrag',
  description: 'E2E testoppdrag',
  status: 'open',
  price: 12000,
  paymentType: 'Fastpris',
  categories: ['Hjem'],
  images: [],
  location: { city: 'Oslo', coordinates: [10.75, 59.91] },
  userId: { _id: 'service-owner', name: 'TEST Oppdragsgiver', role: 'user' },
};

const plans = [{
  _id: 'legacy-standard',
  name: 'Standard',
  type: 'private',
  isActive: true,
  entitlements: { freeContact: 5, ContactUnlock: 30 },
}];

async function openJobDetail(page, {
  entitlements = { includedContacts: 35, consumedIncludedContacts: 1, remainingIncludedContacts: 34 },
  entitlementStatus = 200,
  requestsForCooldown = [],
  rejectApplication = false,
  extraContact,
  extraContactCalls = [],
} = {}) {
  const apiRequests = [];
  await page.route('http://127.0.0.1:5017/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    apiRequests.push({ method, pathname });

    if (method === 'GET' && pathname === '/api/auth/profile') {
      return route.fulfill({ json: user });
    }
    if (method === 'POST' && pathname === '/api/auth/refresh-token') {
      return route.fulfill({ json: { accessToken: 'mock-access-token' } });
    }
    if (method === 'GET' && pathname === '/api/plans') {
      return route.fulfill({ json: plans });
    }
    if (method === 'GET' && pathname === '/api/stripe/v2/entitlements') {
      return route.fulfill({
        status: entitlementStatus,
        json: entitlementStatus === 200
          ? entitlements
          : { code: 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED' },
      });
    }
    if (method === 'GET' && pathname === '/api/services/job-v2-contact') {
      return route.fulfill({ json: service });
    }
    if (method === 'GET' && pathname === '/api/orders/requests/my') {
      return route.fulfill({ json: requestsForCooldown });
    }
    if (method === 'GET' && pathname === '/api/connect/status') {
      return route.fulfill({ json: { payoutReady: true } });
    }
    if (method === 'POST' && pathname === '/api/orders/request' && rejectApplication) {
      return route.fulfill({
        status: 403,
        json: { code: 'CONTACT_LIMIT_REACHED', message: 'Contact limit reached', ...(extraContact && { extraContact }) },
      });
    }
    if (method === 'POST' && pathname === '/api/stripe/create-extra-contact-payment' && extraContact) {
      extraContactCalls.push(request.postDataJSON());
      // A local stand-in for Stripe's hosted Checkout page.
      return route.fulfill({ json: { url: 'http://127.0.0.1:5176/mock-stripe-checkout', sessionId: 'cs_test_mock' } });
    }
    if (pathname === '/api/orders/request' || pathname.includes('extra-contact')) {
      return route.fulfill({ status: 501, json: { code: 'UNEXPECTED_PAYMENT_OR_ORDER_REQUEST' } });
    }
    if (method === 'GET' && pathname === '/api/config/FREE_PRIVATE_JOBS_UNDER_10000') {
      return route.fulfill({ json: { value: false } });
    }
    return route.fulfill({ json: [] });
  });

  await page.addInitScript((state) => {
    localStorage.setItem('user-storage', JSON.stringify({ state, version: 0 }));
    localStorage.setItem('cookie-consent', 'rejected');
  }, {
    user,
    tokens: { accessToken: 'mock-access-token' },
    isAuthenticated: true,
    notificationsEnabled: true,
    browserNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
  });
  await page.goto('/jobs/job-v2-contact');
  // The job page is a lazy route. On a cold Vite dev server (two workers compiling at
  // once) its chunk can take longer than the 5s assertion timeout, and the failure
  // snapshot showed the route's "Laster …" fallback, not a wrong quota. Wait for the
  // page itself; the quota assertions below keep their normal timeout.
  await expect(page.getByRole('heading', { name: service.title })).toBeVisible({ timeout: 30_000 });
  return apiRequests;
}

test('displays V2 quota values instead of stale V1 usage and cooldown', async ({ page }) => {
  const recentLegacyRequest = {
    serviceId: { _id: 'different-job' },
    customerId: { _id: user._id },
    status: 'declined',
    createdAt: new Date().toISOString(),
  };
  const requests = await openJobDetail(page, { requestsForCooldown: [recentLegacyRequest] });

  await expect(page.getByTestId('contact-usage-summary'))
    .toHaveText('Kontakter denne perioden: 1 brukt av 35 · 34 igjen');
  await expect(page.getByText(/Åpner for deg om/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kjøp ekstra kontakter' })).toHaveCount(0);
  expect(requests.some(({ pathname }) => pathname.includes('extra-contact'))).toBe(false);
});

test('shows upgrade guidance when an application is rejected at the V2 quota limit', async ({ page }) => {
  const requests = await openJobDetail(page, {
    entitlements: { includedContacts: 35, consumedIncludedContacts: 35, remainingIncludedContacts: 0 },
    rejectApplication: true,
  });

  await expect(page.getByTestId('contact-usage-summary'))
    .toHaveText('Kontakter denne perioden: 35 brukt av 35 · 0 igjen');
  await page.getByRole('button', { name: 'Send forespørsel', exact: true }).first().click();
  await page.getByRole('button', { name: 'Send forespørsel', exact: true }).last().click();
  await expect(page.getByText('Oppgrader for mer tilgang')).toBeVisible();
  expect(requests.some(({ pathname }) => pathname.includes('extra-contact'))).toBe(false);
});

test('retains the legacy cooldown only when V2 entitlements are explicitly disabled', async ({ page }) => {
  const requests = await openJobDetail(page, {
    entitlementStatus: 503,
    requestsForCooldown: [{
      serviceId: { _id: 'different-job' },
      customerId: { _id: user._id },
      status: 'declined',
      createdAt: new Date().toISOString(),
    }],
  });

  await expect(page.getByText(/Åpner for deg om/)).toBeVisible();
  expect(requests.some(({ pathname }) => pathname.includes('extra-contact'))).toBe(false);
});

const offer = (over = {}) => ({
  available: true, reason: null, priceNok: 29, maxPerPeriod: 3, usedThisPeriod: 0, unlockAt: null, ...over,
});

test('offers a paid extra contact for this job at the plan price and starts Stripe Checkout', async ({ page }) => {
  const calls = [];
  await openJobDetail(page, {
    entitlements: { includedContacts: 15, consumedIncludedContacts: 15, remainingIncludedContacts: 0 },
    rejectApplication: true,
    extraContact: offer(),
    extraContactCalls: calls,
  });
  await page.getByRole('button', { name: 'Send forespørsel', exact: true }).first().click();
  await page.getByRole('button', { name: 'Send forespørsel', exact: true }).last().click();
  await expect(page.getByText('Du har brukt alle inkluderte kontakter denne perioden.')).toBeVisible();
  const buy = page.getByRole('button', { name: 'Kjøp 1 ekstra kontakt – 29 kr' });
  await expect(buy).toBeVisible();
  await buy.click();
  await page.waitForURL('**/mock-stripe-checkout');
  expect(calls).toEqual([{ serviceId: 'job-v2-contact' }]);
});

test('during the ContactUnlock cooldown it says when the next extra contact opens, without a buy button', async ({ page }) => {
  await openJobDetail(page, {
    entitlements: { includedContacts: 15, consumedIncludedContacts: 15, remainingIncludedContacts: 0 },
    rejectApplication: true,
    extraContact: offer({ available: false, reason: 'cooldown', unlockAt: new Date(Date.now() + 45 * 60_000).toISOString() }),
  });
  await page.getByRole('button', { name: 'Send forespørsel', exact: true }).first().click();
  await page.getByRole('button', { name: 'Send forespørsel', exact: true }).last().click();
  await expect(page.getByTestId('extra-contact-note')).toContainText('Neste ekstra kontakt åpner');
  await expect(page.getByRole('button', { name: /Kjøp 1 ekstra kontakt/ })).toHaveCount(0);
});
