const { getStripeConfiguration } = require('../../config/stripe');
const StripeWebhookHealth = require('../../models/StripeWebhookHealth');

const VERIFICATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function getStripeWebhookReadiness(providedConfig) {
  let config;
  try {
    config = providedConfig || (await getStripeConfiguration());
  } catch (_err) {
    return {
      ready: false,
      status: 'configuration_unavailable',
      mode: null,
      reason: 'stripe_mode_lookup_failed',
    };
  }

  if (!config.secretKey) {
    return {
      ready: false,
      status: 'secret_missing',
      mode: config.mode,
      reason: 'stripe_api_key_missing',
    };
  }
  if (!config.webhookSecret) {
    return {
      ready: false,
      status: 'secret_missing',
      mode: config.mode,
      reason: 'webhook_secret_missing',
    };
  }
  if (
    !config.keyModeValid ||
    !config.webhookSecretValid ||
    !/^whsec_.+/.test(config.webhookSecret)
  ) {
    return {
      ready: false,
      status: 'invalid_configuration',
      mode: config.mode,
      reason: !config.keyModeValid
        ? 'stripe_api_key_mode_mismatch'
        : 'webhook_secret_invalid',
    };
  }

  let health;
  try {
    health = await StripeWebhookHealth.findOne({ _id: config.mode }).lean();
  } catch (_err) {
    return {
      ready: false,
      status: 'configuration_unavailable',
      mode: config.mode,
      reason: 'webhook_health_lookup_failed',
    };
  }

  const current = health?.configurationFingerprint === config.fingerprint;
  const production = process.env.NODE_ENV === 'production';
  const verifiedAt = health?.lastVerifiedAt ? new Date(health.lastVerifiedAt).getTime() : NaN;
  const verificationAge = Date.now() - verifiedAt;
  const endpointVerified =
    current &&
    Number.isFinite(verifiedAt) &&
    verificationAge >= 0 &&
    verificationAge <= VERIFICATION_MAX_AGE_MS;
  let status = 'endpoint_unverified';
  if (current && health.status === 'delivery_problem') status = 'delivery_problem';
  else if (endpointVerified) status = 'healthy';

  return {
    ready: !production || status === 'healthy',
    status,
    mode: config.mode,
    reason:
      current && health?.lastVerifiedAt && !endpointVerified
        ? 'endpoint_verification_expired'
        : undefined,
    lastVerifiedAt: current ? health.lastVerifiedAt : null,
    lastDeliveryAt: current ? health.lastDeliveryAt : null,
    lastFailureAt: current ? health.lastFailureAt : null,
    lastFailureCode: current ? health.lastFailureCode : null,
  };
}

async function recordVerifiedDelivery(config, eventId) {
  await StripeWebhookHealth.findOneAndUpdate(
    { _id: config.mode },
    {
      $set: {
        mode: config.mode,
        configurationFingerprint: config.fingerprint,
        status: 'healthy',
        lastVerifiedAt: new Date(),
        lastDeliveryAt: new Date(),
        lastEventId: eventId,
        lastFailureAt: null,
        lastFailureCode: null,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
}

async function recordDeliveryProblem(config, eventId, code) {
  await StripeWebhookHealth.findOneAndUpdate(
    { _id: config.mode },
    {
      $set: {
        mode: config.mode,
        configurationFingerprint: config.fingerprint,
        status: 'delivery_problem',
        lastDeliveryAt: new Date(),
        lastEventId: eventId,
        lastFailureAt: new Date(),
        lastFailureCode: code,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
}

module.exports = {
  getStripeWebhookReadiness,
  recordVerifiedDelivery,
  recordDeliveryProblem,
  VERIFICATION_MAX_AGE_MS,
};
