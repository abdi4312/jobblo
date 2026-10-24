import { expect, test } from '@playwright/test';

const standardPlan = {
  _id: '6a0de8309d8348f34c9b0332',
  name: 'Standard',
  type: 'private',
  price: 0,
  isActive: true,
  freeViews: 5,
  pricePerExtraView: 49,
  features: ['5 contacts included'],
  featuresText: ['5 contacts included'],
  entitlements: { freeContact: 5 },
};
const plusPlan = {
  _id: '6a0de8309d8348f34c9b0333',
  name: 'Plus',
  type: 'private',
  price: 99,
  isActive: true,
  freeViews: 15,
  pricePerExtraView: 29,
  features: ['15 contacts included'],
  featuresText: ['15 contacts included'],
  entitlements: { freeContact: 15 },
};
const proPlan = {
  _id: '6a0de8309d8348f34c9b0334',
  name: 'Pro',
  type: 'private',
  price: 149,
  isActive: true,
  freeViews: 35,
  pricePerExtraView: 19,
  features: ['35 contacts included'],
  featuresText: ['35 contacts included'],
  entitlements: { freeContact: 35 },
};
const plans = [standardPlan, plusPlan, proPlan];
const defaultUser = {
  _id: 'e2e-customer',
  name: 'TEST Customer',
  email: 'customer@example.test',
  role: 'user',
  subscription: 'Standard',
};
const billingHistory = {
  payments: [],
  invoices: [{
    id: 'in_test_membership',
    number: 'INV-TEST-001',
    createdAt: '2026-10-19T00:00:00.000Z',
    amountPaid: 9900,
    amountDue: 0,
    currency: 'nok',
    status: 'paid',
    mode: 'test',
    hasPdf: false,
  }],
  paymentMethod: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
  billingAddress: null,
};

function subscription(overrides = {}) {
  return {
    plan: 'Plus',
    planId: plusPlan._id,
    planType: 'private',
    status: 'active',
    autoRenew: true,
    renewalDate: '2026-11-19T15:35:30.000Z',
    stripeSubscriptionId: 'sub_test_membership',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: '2026-11-19T15:35:30.000Z',
    stripeStatus: 'active',
    stripeMode: 'test',
    price: 99,
    billingInterval: 'month',
    pendingPlan: null,
    timeline: [],
    ...overrides,
  };
}

async function openMembership(page, initialSubscription = null) {
  let currentSubscription = initialSubscription
    ? structuredClone(initialSubscription)
    : null;
  const user = {
    ...defaultUser,
    subscription: currentSubscription?.plan || 'Standard',
  };
  const requests = [];
  const unexpectedRequests = [];

  // All app API calls and the Stripe Checkout navigation are fulfilled locally.
  await page.route('http://127.0.0.1:5017/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const rawBody = request.postData();
    const body = rawBody ? JSON.parse(rawBody) : null;
    requests.push({ method, pathname, body });
    let response;

    if (method === 'GET' && pathname === '/api/plans') {
      response = plans;
    } else if (method === 'GET' && pathname === '/api/stripe/subscription') {
      response = { subscription: currentSubscription };
    } else if (method === 'GET' && pathname === '/api/stripe/subscription/billing-history') {
      response = billingHistory;
    } else if (method === 'GET' && pathname === '/api/auth/profile') {
      response = user;
    } else if (method === 'GET' && pathname === '/api/auth/sessions') {
      response = [];
    } else if (method === 'POST' && pathname === '/api/auth/refresh-token') {
      response = { message: 'Token refreshed', accessToken: 'mock-access-token' };
    } else if (method === 'GET' && pathname === '/api/notifications/unread-count') {
      response = { count: 0 };
    } else if (method === 'GET' && pathname === '/api/notifications') {
      response = { success: true, total: 0, currentPage: 1, totalPages: 0, data: [] };
    } else if (method === 'GET' && pathname === '/api/chats/get') {
      response = [];
    } else if (method === 'POST' && pathname === '/api/stripe/subscription/change/preview') {
      response = {
        strategy: 'immediate',
        amountDueNow: 5000,
        currency: 'nok',
        currentPlan: currentSubscription?.plan,
        targetPlan: plans.find((plan) => plan._id === body?.planId)?.name,
      };
    } else if (method === 'POST' && pathname === '/api/stripe/subscription/change') {
      const targetPlan = plans.find((plan) => plan._id === body?.planId);
      if (!targetPlan) {
        await route.fulfill({ status: 400, json: { message: 'Unknown mock plan' } });
        return;
      }
      currentSubscription = {
        ...currentSubscription,
        plan: targetPlan.name,
        planId: targetPlan._id,
        price: targetPlan.price,
      };
      response = { message: 'Planendringen er sendt til Stripe' };
    } else if (method === 'POST' && pathname === '/api/stripe/subscription/cancel') {
      currentSubscription = {
        ...currentSubscription,
        status: 'canceling',
        autoRenew: false,
        cancelAtPeriodEnd: true,
      };
      response = { message: 'Abonnementet avsluttes ved periodens slutt' };
    } else if (method === 'POST' && pathname === '/api/stripe/subscription/resume') {
      currentSubscription = {
        ...currentSubscription,
        status: 'active',
        autoRenew: true,
        cancelAtPeriodEnd: false,
      };
      response = { message: 'Abonnementet fortsetter' };
    } else if (method === 'POST' && pathname === '/api/stripe/create-checkout-session') {
      response = { url: 'https://checkout.stripe.com/c/pay/cs_test_mocked' };
    } else if (method === 'POST' && pathname === '/api/stripe/subscription/portal') {
      response = { url: 'https://billing.stripe.test/mock-portal' };
    } else if (method === 'POST' && pathname === '/api/rum') {
      response = { ok: true }; // real-user monitoring beacon, not part of the flow under test
    } else {
      unexpectedRequests.push({ method, pathname });
      await route.fulfill({
        status: 501,
        json: { code: 'UNMOCKED_E2E_API_REQUEST', method, pathname },
      });
      return;
    }

    await route.fulfill({ status: 200, json: response });
  });
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Mock Stripe Checkout</title><main>Mocked Stripe TEST Checkout</main>',
    })
  );
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
  await page.goto('/membership');
  return { requests, unexpectedRequests };
}

test('shows Pro, a scheduled Plus downgrade, and TEST billing history', async ({ page }) => {
  const { unexpectedRequests } = await openMembership(page, subscription({
    plan: 'Pro',
    planId: proPlan._id,
    price: 149,
    pendingPlan: { plan: 'Plus', effectiveAt: '2026-11-19T15:35:30.000Z' },
  }));

  await expect(page.getByText('Ditt abonnement')).toBeVisible();
  await expect(page.getByText('Planen endres til Plus')).toBeVisible();
  await expect(page.getByText('INV-TEST-001')).toBeVisible();
  await expect(page.getByText('TEST').first()).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});

test('cancels at period end through the mocked management API', async ({ page }) => {
  const { requests, unexpectedRequests } = await openMembership(page, subscription());
  page.on('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: 'Si opp abonnementet' }).click();

  await expect(page.getByText('Avsluttes ved periodens slutt', { exact: true })).toBeVisible();
  expect(requests.filter((request) => request.pathname === '/api/stripe/subscription/cancel')).toHaveLength(1);
  expect(unexpectedRequests).toEqual([]);
});

test('resumes a cancellation through the mocked management API', async ({ page }) => {
  const { requests, unexpectedRequests } = await openMembership(page, subscription({
    status: 'canceling',
    autoRenew: false,
    cancelAtPeriodEnd: true,
  }));

  await page.getByRole('button', { name: 'Gjenoppta abonnementet' }).click();

  await expect(page.getByText('Aktiv')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Si opp abonnementet' })).toBeVisible();
  expect(requests.filter((request) => request.pathname === '/api/stripe/subscription/resume')).toHaveLength(1);
  expect(unexpectedRequests).toEqual([]);
});

test('previews and confirms a paid plan change with mocked responses', async ({ page }) => {
  const { requests, unexpectedRequests } = await openMembership(page, subscription());
  await page.locator('label').filter({
    has: page.locator(`input[name="plan"][value="${proPlan._id}"]`),
  }).click();

  const confirmChange = page.getByRole('button', { name: 'Bekreft planendring' });
  await expect(confirmChange).toBeEnabled();
  await confirmChange.click();

  await expect(page.getByText('Planendringen er sendt til Stripe')).toBeVisible();
  await expect(page.locator('input[name="plan"][value="' + proPlan._id + '"]')).toBeChecked();
  expect(requests.filter((request) => request.pathname === '/api/stripe/subscription/change/preview'))
    .toContainEqual(expect.objectContaining({
      method: 'POST',
      body: { planId: proPlan._id },
    }));
  expect(requests.filter((request) => request.pathname === '/api/stripe/subscription/change')).toHaveLength(1);
  expect(unexpectedRequests).toEqual([]);
});

test('starts checkout using a mocked Stripe Checkout page', async ({ page }) => {
  const { requests, unexpectedRequests } = await openMembership(page);
  await page.locator('label').filter({
    has: page.locator(`input[name="plan"][value="${plusPlan._id}"]`),
  }).click();
  await page.getByRole('button', { name: 'Start abonnement' }).click();

  await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_mocked/);
  await expect(page.getByText('Mocked Stripe TEST Checkout')).toBeVisible();
  expect(requests.find((request) => request.pathname === '/api/stripe/create-checkout-session'))
    .toMatchObject({ method: 'POST', body: { planId: plusPlan._id } });
  expect(unexpectedRequests).toEqual([]);
});
