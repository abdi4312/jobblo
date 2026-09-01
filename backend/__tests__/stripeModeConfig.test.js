/**
 * Mode selection.
 *
 * Three failures being guarded here:
 *   - `Boolean('false')` is `true`, so a string written into the Mixed GlobalConfig
 *     value silently flipped production onto test keys and real charges stopped with
 *     no error anywhere.
 *   - Test mode fell back to the LIVE webhook secret when the test one was unset, so
 *     test-signed events failed verification and looked like forged requests.
 *   - The admin badge rendered from the toggle, not the key, so it displayed a
 *     confident LIVE while an `sk_test_` key was in the production slot.
 */

jest.mock('../models/GlobalConfig', () => ({ findOne: jest.fn() }));

const GlobalConfig = require('../models/GlobalConfig');
const {
  parseBool,
  isTestMode,
  getStripeWebhookSecret,
  getStripeModeReport,
  getStripe,
  STRIPE_API_VERSION,
  _resetStripeCache,
} = require('../config/stripe');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  _resetStripeCache();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_TEST_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_TEST_WEBHOOK_SECRET;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('parseBool', () => {
  it('treats the STRING "false" as false — Boolean() does not', () => {
    expect(Boolean('false')).toBe(true); // the bug
    expect(parseBool('false')).toBe(false); // the fix
  });

  it.each([
    [true, true],
    ['true', true],
    ['TRUE', true],
    [1, true],
    ['1', true],
    [false, false],
    ['false', false],
    ['0', false],
    [0, false],
    [null, false],
    [undefined, false],
    ['', false],
  ])('parseBool(%p) === %p', (input, expected) => {
    expect(parseBool(input)).toBe(expected);
  });
});

describe('isTestMode', () => {
  it('defaults to production when no config row exists', async () => {
    GlobalConfig.findOne.mockResolvedValue(null);
    expect(await isTestMode()).toBe(false);
  });

  it('does not flip to test mode because the value is the string "false"', async () => {
    GlobalConfig.findOne.mockResolvedValue({ value: 'false' });
    expect(await isTestMode()).toBe(false);
  });

  it('defaults to production if the lookup throws', async () => {
    GlobalConfig.findOne.mockRejectedValue(new Error('mongo down'));
    expect(await isTestMode()).toBe(false);
  });
});

describe('webhook secret selection', () => {
  it('never verifies a test event with the live secret', async () => {
    GlobalConfig.findOne.mockResolvedValue({ value: true });
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_LIVE';
    // STRIPE_TEST_WEBHOOK_SECRET deliberately unset.

    expect(await getStripeWebhookSecret()).toBeNull();
  });

  it('never verifies a live event with the test secret', async () => {
    GlobalConfig.findOne.mockResolvedValue({ value: false });
    process.env.STRIPE_TEST_WEBHOOK_SECRET = 'whsec_TEST';

    expect(await getStripeWebhookSecret()).toBeNull();
  });

  it('returns each mode its own secret', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_LIVE';
    process.env.STRIPE_TEST_WEBHOOK_SECRET = 'whsec_TEST';

    GlobalConfig.findOne.mockResolvedValue({ value: true });
    expect(await getStripeWebhookSecret()).toBe('whsec_TEST');

    GlobalConfig.findOne.mockResolvedValue({ value: false });
    expect(await getStripeWebhookSecret()).toBe('whsec_LIVE');
  });
});

describe('secret key selection', () => {
  it('throws a named error rather than falling back to the live key in test mode', async () => {
    GlobalConfig.findOne.mockResolvedValue({ value: true });
    process.env.STRIPE_SECRET_KEY = 'sk_live_realmoney';

    await expect(getStripe()).rejects.toThrow(/TEST mode.*STRIPE_TEST_SECRET_KEY/);
  });

  it('pins an explicit API version instead of following the account default', async () => {
    GlobalConfig.findOne.mockResolvedValue({ value: true });
    process.env.STRIPE_TEST_SECRET_KEY = 'sk_test_abc';

    const client = await getStripe();

    expect(STRIPE_API_VERSION).toBe('2025-12-15.clover');
    expect(client.getApiField('version')).toBe(STRIPE_API_VERSION);
  });
});

describe('mode reporting for the admin badge', () => {
  it('reports the real mode of the key, and flags the mismatch', async () => {
    // Toggle says LIVE, key is a test key — the case that used to render a green LIVE.
    GlobalConfig.findOne.mockResolvedValue({ value: false });
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_live';

    const report = await getStripeModeReport();

    expect(report.toggleTestMode).toBe(false);
    expect(report.keyMode).toBe('test');
    expect(report.mismatch).toBe(true);
    expect(report.webhookConfigured).toBe(true);
  });

  it('reports no mismatch when toggle and key agree', async () => {
    GlobalConfig.findOne.mockResolvedValue({ value: true });
    process.env.STRIPE_TEST_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_TEST_WEBHOOK_SECRET = 'whsec_test';

    const report = await getStripeModeReport();

    expect(report.keyMode).toBe('test');
    expect(report.mismatch).toBe(false);
  });

  it('flags a missing key and never returns the key itself', async () => {
    GlobalConfig.findOne.mockResolvedValue({ value: true });

    const report = await getStripeModeReport();

    expect(report.keyMode).toBe('missing');
    expect(report.mismatch).toBe(true);
    expect(report.webhookConfigured).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/sk_(test|live)_/);
  });
});
