jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
}));
jest.mock('../models/StripeWebhookHealth', () => ({
  findOne: jest.fn(),
}));

const { getStripeConfiguration } = require('../config/stripe');
const StripeWebhookHealth = require('../models/StripeWebhookHealth');
const { getStripeWebhookReadiness } = require('../services/stripe/webhookReadiness');

const config = {
  testMode: false,
  mode: 'live',
  secretKey: 'sk_live_sample',
  webhookSecret: 'whsec_live_sample',
  keyModeValid: true,
  webhookSecretValid: true,
  fingerprint: 'fingerprint-live-a',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = 'production';
  getStripeConfiguration.mockResolvedValue(config);
  StripeWebhookHealth.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
});

describe('Stripe webhook readiness', () => {
  it('fails closed when Stripe mode cannot be read from the database', async () => {
    getStripeConfiguration.mockRejectedValue(new Error('database unavailable'));

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: false,
      status: 'configuration_unavailable',
      reason: 'stripe_mode_lookup_failed',
    });
  });

  it.each([
    [{ ...config, secretKey: null }, 'secret_missing'],
    [{ ...config, webhookSecret: null }, 'secret_missing'],
    [{ ...config, webhookSecret: 'not-a-signing-secret' }, 'invalid_configuration'],
    [{ ...config, keyModeValid: false }, 'invalid_configuration'],
  ])('fails closed for invalid selected Stripe configuration', async (selected, status) => {
    getStripeConfiguration.mockResolvedValue(selected);

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: false,
      status,
      mode: 'live',
    });
  });

  it('blocks production live checkout until a signed delivery has been processed', async () => {
    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: false,
      status: 'endpoint_unverified',
      mode: 'live',
    });
  });

  it('reports a healthy endpoint only for the current configuration fingerprint', async () => {
    const verifiedAt = new Date();
    StripeWebhookHealth.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        configurationFingerprint: config.fingerprint,
        status: 'healthy',
        lastVerifiedAt: verifiedAt,
        lastDeliveryAt: verifiedAt,
      }),
    });

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: true,
      status: 'healthy',
      lastVerifiedAt: verifiedAt,
    });
  });

  it('expires production readiness after 30 days without a verified delivery', async () => {
    const verifiedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    StripeWebhookHealth.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        configurationFingerprint: config.fingerprint,
        status: 'healthy',
        lastVerifiedAt: verifiedAt,
        lastDeliveryAt: verifiedAt,
      }),
    });

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: false,
      status: 'endpoint_unverified',
      reason: 'endpoint_verification_expired',
      lastVerifiedAt: verifiedAt,
    });
  });

  it('does not accept a future verification timestamp as healthy', async () => {
    StripeWebhookHealth.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        configurationFingerprint: config.fingerprint,
        status: 'healthy',
        lastVerifiedAt: new Date(Date.now() + 60_000),
      }),
    });

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: false,
      status: 'endpoint_unverified',
      reason: 'endpoint_verification_expired',
    });
  });

  it('invalidates readiness after API-key or webhook-secret rotation', async () => {
    StripeWebhookHealth.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        configurationFingerprint: 'old-fingerprint',
        status: 'healthy',
        lastVerifiedAt: new Date(),
      }),
    });

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: false,
      status: 'endpoint_unverified',
      lastVerifiedAt: null,
    });
  });

  it('surfaces verified delivery failures and blocks live checkout', async () => {
    StripeWebhookHealth.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        configurationFingerprint: config.fingerprint,
        status: 'delivery_problem',
        lastVerifiedAt: new Date(),
        lastFailureCode: 'verified_event_processing_failed',
      }),
    });

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: false,
      status: 'delivery_problem',
      lastFailureCode: 'verified_event_processing_failed',
    });
  });

  it('allows configured test mode while still reporting that endpoint verification is pending', async () => {
    process.env.NODE_ENV = 'test';
    getStripeConfiguration.mockResolvedValue({
      ...config,
      testMode: true,
      mode: 'test',
    });

    await expect(getStripeWebhookReadiness()).resolves.toMatchObject({
      ready: true,
      status: 'endpoint_unverified',
      mode: 'test',
    });
  });
});
