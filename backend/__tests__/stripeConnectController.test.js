jest.mock('../models/User', () => ({ findById: jest.fn() }));
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
      stripeConnectAccountIdTest: 'acct_test_123456',
      name: 'Worker',
      email: 'worker@example.test',
    }),
  });
  stripe = {
    accounts: {
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
