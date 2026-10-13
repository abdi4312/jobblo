jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));

const User = require('../models/User');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const {
  getConnectReadiness,
  StripeConnectUnavailableError,
} = require('../services/stripeConnectReadiness');
let retrieveAccount;

const account = (overrides = {}) => ({
  id: 'acct_test',
  deleted: false,
  payouts_enabled: true,
  charges_enabled: true,
  details_submitted: true,
  capabilities: { transfers: 'active' },
  requirements: {
    currently_due: [],
    past_due: [],
    pending_verification: [],
    disabled_reason: null,
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  getStripeConfiguration.mockResolvedValue({ testMode: true, mode: 'test' });
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      stripeConnectAccountIdTest: 'acct_test',
      stripeConnectAccountId: 'acct_live',
    }),
  });
  retrieveAccount = jest.fn().mockResolvedValue(account());
  getStripeForMode.mockResolvedValue({ accounts: { retrieve: retrieveAccount } });
});

it('accepts only a fully onboarded payout-ready account in the selected test mode', async () => {
  const result = await getConnectReadiness('worker');

  expect(getStripeForMode).toHaveBeenCalledWith(true);
  expect(retrieveAccount).toHaveBeenCalledWith('acct_test');
  expect(result).toMatchObject({
    ready: true,
    mode: 'test',
    accountId: 'acct_test',
    payoutEnabled: true,
    transfersEnabled: true,
    chargesEnabled: true,
  });
});

it('rejects missing accounts and incomplete or revoked capabilities', async () => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ stripeConnectAccountIdTest: null }),
  });
  expect(await getConnectReadiness('worker')).toMatchObject({
    ready: false,
    reason: 'no_account',
  });

  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ stripeConnectAccountIdTest: 'acct_test' }),
  });
  const retrieve = jest.fn().mockResolvedValue(
    account({ requirements: { currently_due: ['individual.address.line1'] } })
  );
  getStripeForMode.mockResolvedValue({ accounts: { retrieve } });
  expect((await getConnectReadiness('worker')).ready).toBe(false);

  retrieve.mockResolvedValue(
    account({ requirements: { pending_verification: ['individual.verification.document'] } })
  );
  expect((await getConnectReadiness('worker')).ready).toBe(false);

  retrieve.mockResolvedValue(account({ capabilities: { transfers: 'inactive' } }));
  expect((await getConnectReadiness('worker')).ready).toBe(false);

  retrieve.mockResolvedValue(
    account({
      requirements: {
        currently_due: [],
        past_due: ['individual.verification.document'],
        pending_verification: [],
        disabled_reason: 'requirements.past_due',
      },
    })
  );
  expect(await getConnectReadiness('worker')).toMatchObject({
    ready: false,
    payoutOnboardingStatus: 'restricted',
  });
});

it('uses only the live account ID when live mode is configured', async () => {
  getStripeConfiguration.mockResolvedValue({ testMode: false, mode: 'live' });
  const retrieve = jest.fn().mockResolvedValue(account({ id: 'acct_live' }));
  getStripeForMode.mockResolvedValue({ accounts: { retrieve } });

  const result = await getConnectReadiness('worker');

  expect(getStripeForMode).toHaveBeenCalledWith(false);
  expect(retrieve).toHaveBeenCalledWith('acct_live');
  expect(result.mode).toBe('live');
});

it('fails closed with a distinct error when Stripe cannot verify the account', async () => {
  getStripeForMode.mockResolvedValue({
    accounts: { retrieve: jest.fn().mockRejectedValue(new Error('network error')) },
  });

  await expect(getConnectReadiness('worker')).rejects.toBeInstanceOf(
    StripeConnectUnavailableError
  );
});
