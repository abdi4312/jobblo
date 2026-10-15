jest.mock('../models/User', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/stripeConnectReadiness', () => ({
  getConnectReadiness: jest.fn(),
}));

const User = require('../models/User');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const { getConnectReadiness } = require('../services/stripeConnectReadiness');
const controller = require('../controllers/stripeConnectController');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

let stripe;
beforeEach(() => {
  jest.clearAllMocks();
  getStripeConfiguration.mockResolvedValue({ testMode: true });
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: 'worker',
      stripeConnectAccountIdTest: 'acct_test_123456',
      name: 'Worker',
      email: 'worker@example.test',
    }),
  });
  User.updateOne.mockResolvedValue({ matchedCount: 1 });
  getStripeConfiguration.mockResolvedValue({
    testMode: true,
    mode: 'test',
    keyModeValid: true,
  });
  stripe = {
    accounts: {
      create: jest.fn().mockResolvedValue({
        id: 'acct_test_created',
        details_submitted: false,
        payouts_enabled: false,
        charges_enabled: false,
        metadata: { jobbloUserId: 'worker' },
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'acct_test_123456',
        details_submitted: false,
        payouts_enabled: false,
        charges_enabled: false,
        metadata: { jobbloUserId: 'worker' },
      }),
      createLoginLink: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.test/dashboard' }),
    },
    accountLinks: {
      create: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.test/onboarding' }),
    },
  };
  getStripeForMode.mockResolvedValue(stripe);
});

it('opens the Express dashboard for a verified account', async () => {
  getConnectReadiness.mockResolvedValue({ ready: true });
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(stripe.accounts.createLoginLink).toHaveBeenCalledWith('acct_test_123456');
  expect(stripe.accountLinks.create).not.toHaveBeenCalled();
  expect(res.body.url).toBe('https://connect.stripe.test/dashboard');
});

it('keeps incomplete accounts on the existing hosted onboarding flow', async () => {
  getConnectReadiness.mockResolvedValue({ ready: false });
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(stripe.accounts.createLoginLink).not.toHaveBeenCalled();
  expect(stripe.accountLinks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      account: 'acct_test_123456',
      type: 'account_onboarding',
    })
  );
});

it('uses only the selected live account ID and API client', async () => {
  getStripeConfiguration.mockResolvedValue({ testMode: false, mode: 'live', keyModeValid: true });
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: 'worker',
      stripeConnectAccountId: 'acct_live_123',
      stripeConnectAccountIdTest: 'acct_test_123456',
      name: 'Worker',
      email: 'worker@example.test',
    }),
  });
  stripe.accounts.retrieve.mockResolvedValue({
    id: 'acct_live_123',
    details_submitted: true,
    payouts_enabled: true,
    charges_enabled: true,
    metadata: { jobbloUserId: 'worker' },
  });
  getConnectReadiness.mockResolvedValue({ ready: true });
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(getStripeForMode).toHaveBeenCalledWith(false);
  expect(stripe.accounts.retrieve).toHaveBeenCalledWith('acct_live_123');
  expect(stripe.accounts.create).not.toHaveBeenCalled();
  expect(stripe.accounts.createLoginLink).toHaveBeenCalledWith('acct_live_123');
});

it('creates a missing selected-mode account with stable mode-scoped idempotency and persists only that mode ID', async () => {
  const user = {
    _id: 'worker',
    stripeConnectAccountId: 'acct_live_existing',
    stripeConnectAccountIdTest: null,
    name: 'Worker',
    email: 'worker@example.test',
  };
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  getConnectReadiness.mockResolvedValue({ ready: false });
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  const [params, options] = stripe.accounts.create.mock.calls[0];
  expect(params).toMatchObject({
    type: 'express',
    country: 'NO',
    metadata: { jobbloUserId: 'worker' },
  });
  expect(options.idempotencyKey).toMatch(/^jobblo_connect_test_[a-f0-9]{64}$/);
  expect(User.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({ _id: 'worker' }),
    expect.objectContaining({
      $set: expect.objectContaining({
        stripeConnectAccountIdTest: 'acct_test_created',
      }),
    })
  );
  expect(User.updateOne.mock.calls[0][1].$set).not.toHaveProperty('stripeConnectAccountId');
  expect(res.body.url).toBe('https://connect.stripe.test/onboarding');
});

it('returns an actionable platform setup response for Stripe loss-liability rejection', async () => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: 'worker',
      name: 'Worker',
      email: 'worker@example.test',
    }),
  });
  stripe.accounts.create.mockRejectedValue(Object.assign(new Error(
    'Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.'
  ), {
    type: 'StripeInvalidRequestError',
    statusCode: 400,
    requestId: 'req_safe_test',
  }));
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({
    code: 'STRIPE_CONNECT_PLATFORM_SETUP_REQUIRED',
    error: 'Stripe Connect-oppsettet må fullføres av plattformadministratoren.',
  });
});

it('does not create an account when the selected-mode API key is invalid', async () => {
  getStripeConfiguration.mockResolvedValue({ testMode: false, mode: 'live', keyModeValid: false });
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(res.statusCode).toBe(503);
  expect(res.body.code).toBe('STRIPE_API_KEY_MISSING_OR_INVALID');
  expect(getStripeForMode).not.toHaveBeenCalled();
});

it('does not silently replace an account missing from the selected Stripe mode', async () => {
  stripe.accounts.retrieve.mockRejectedValue(Object.assign(new Error('No such account'), {
    type: 'StripeInvalidRequestError',
    code: 'resource_missing',
    statusCode: 404,
  }));
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('STRIPE_CONNECT_ACCOUNT_NOT_FOUND');
  expect(stripe.accounts.create).not.toHaveBeenCalled();
});

it('refuses invalid production onboarding URLs before creating an account', async () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.FRONTEND_URL = 'http://jobblo.no';
  process.env.NODE_ENV = 'production';
  const res = makeRes();

  try {
    await controller.createAccountLink({ userId: 'worker' }, res);
  } finally {
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontendUrl;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }

  expect(res.statusCode).toBe(503);
  expect(res.body.code).toBe('STRIPE_CONNECT_RETURN_URL_INVALID');
  expect(stripe.accounts.create).not.toHaveBeenCalled();
});

it('rejects an existing connected account owned by a different Jobblo user', async () => {
  stripe.accounts.retrieve.mockResolvedValue({
    id: 'acct_test_123456',
    metadata: { jobbloUserId: 'another-user' },
  });
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('STRIPE_CONNECT_ACCOUNT_OWNER_MISMATCH');
  expect(stripe.accountLinks.create).not.toHaveBeenCalled();
});

it('uses one idempotency key for concurrent account creation requests', async () => {
  const user = () => ({
    _id: 'worker',
    stripeConnectAccountIdTest: null,
    name: 'Worker',
    email: 'worker@example.test',
  });
  User.findById
    .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(user()) })
    .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(user()) });
  getConnectReadiness.mockResolvedValue({ ready: false });

  await Promise.all([
    controller.createAccountLink({ userId: 'worker' }, makeRes()),
    controller.createAccountLink({ userId: 'worker' }, makeRes()),
  ]);

  expect(stripe.accounts.create).toHaveBeenCalledTimes(2);
  expect(stripe.accounts.create.mock.calls[0][1].idempotencyKey)
    .toBe(stripe.accounts.create.mock.calls[1][1].idempotencyKey);
});

it('reuses Stripe idempotency after account creation succeeds but persistence fails', async () => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: 'worker',
      stripeConnectAccountIdTest: null,
      name: 'Worker',
      email: 'worker@example.test',
    }),
  });
  User.updateOne.mockRejectedValueOnce(new Error('database write failed'));
  getConnectReadiness.mockResolvedValue({ ready: false });
  const first = makeRes();
  await controller.createAccountLink({ userId: 'worker' }, first);

  const second = makeRes();
  await controller.createAccountLink({ userId: 'worker' }, second);

  expect(first.statusCode).toBe(500);
  expect(second.body.url).toBe('https://connect.stripe.test/onboarding');
  expect(stripe.accounts.create.mock.calls[0][1].idempotencyKey)
    .toBe(stripe.accounts.create.mock.calls[1][1].idempotencyKey);
});

it('returns a retryable response when Stripe is unavailable', async () => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: 'worker',
      name: 'Worker',
      email: 'worker@example.test',
    }),
  });
  stripe.accounts.create.mockRejectedValue(Object.assign(new Error('timeout'), {
    type: 'StripeConnectionError',
  }));
  const res = makeRes();

  await controller.createAccountLink({ userId: 'worker' }, res);

  expect(res.statusCode).toBe(503);
  expect(res.body.code).toBe('STRIPE_CONNECT_TEMPORARILY_UNAVAILABLE');
});

it('returns the selected-mode readiness and account reference to the signed-in user', async () => {
  getConnectReadiness.mockResolvedValue({
    mode: 'test',
    ready: false,
    hasAccount: true,
    accountId: 'acct_test_123456',
    payoutOnboardingStatus: 'pending_verification',
    payoutEnabled: false,
    transfersEnabled: false,
    chargesEnabled: false,
    detailsSubmitted: true,
    connectedAt: new Date('2026-01-01T00:00:00Z'),
    lastRefreshed: null,
  });
  const res = makeRes();

  await controller.getStatus({ userId: 'worker' }, res);

  expect(res.body).toMatchObject({
    mode: 'test',
    payoutReady: false,
    hasAccount: true,
    accountId: 'acct_test_123456',
    payoutOnboardingStatus: 'pending_verification',
    transfersEnabled: false,
  });
});
