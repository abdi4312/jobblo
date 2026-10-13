const User = require('../models/User');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');

const REQUIRED_MESSAGE =
  'Du må fullføre og verifisere Stripe Connect-kontoen din før du kan sende forespørsler eller starte oppdrag.';

class StripeConnectUnavailableError extends Error {
  constructor(cause) {
    super('Kunne ikke bekrefte Stripe Connect-status.');
    this.name = 'StripeConnectUnavailableError';
    this.code = 'STRIPE_CONNECT_STATUS_UNAVAILABLE';
    this.cause = cause;
  }
}

async function getConnectReadiness(userId) {
  try {
    const config = await getStripeConfiguration();
    const accountField = config.testMode
      ? 'stripeConnectAccountIdTest'
      : 'stripeConnectAccountId';
    const user = await User.findById(userId).select(
      'stripeConnectAccountId stripeConnectAccountIdTest payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted connectAccountCreatedAt payoutOnboardingLastRefreshedAt'
    );
    if (!user) {
      const error = new Error('Bruker ikke funnet');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    const accountId = user[accountField];
    const base = {
      mode: config.mode,
      hasAccount: Boolean(accountId),
      accountId: accountId || null,
      payoutEnabled: false,
      transfersEnabled: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      payoutOnboardingStatus: accountId ? 'started' : 'none',
      connectedAt: user.connectAccountCreatedAt || null,
      lastRefreshed: user.payoutOnboardingLastRefreshedAt || null,
    };
    if (!accountId) return { ...base, ready: false, reason: 'no_account' };

    const stripe = await getStripeForMode(config.testMode);
    const account = await stripe.accounts.retrieve(accountId);
    const requirements = account.requirements || {};
    const currentlyDue = requirements.currently_due || [];
    const pastDue = requirements.past_due || [];
    const pendingVerification = requirements.pending_verification || [];
    const transfersEnabled = account.capabilities?.transfers === 'active';
    const ready =
      !account.deleted &&
      account.payouts_enabled === true &&
      transfersEnabled &&
      account.details_submitted === true &&
      !requirements.disabled_reason &&
      currentlyDue.length === 0 &&
      pastDue.length === 0 &&
      pendingVerification.length === 0;

    return {
      ...base,
      ready,
      reason: ready ? null : 'onboarding_incomplete',
      payoutEnabled: account.payouts_enabled === true,
      transfersEnabled,
      detailsSubmitted: account.details_submitted === true,
      chargesEnabled: account.charges_enabled === true,
      payoutOnboardingStatus: ready
        ? 'enabled'
        : requirements.disabled_reason
          ? 'restricted'
          : pendingVerification.length > 0
            ? 'pending_verification'
            : 'started',
    };
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') throw error;
    throw new StripeConnectUnavailableError(error);
  }
}

function sendConnectReadinessFailure(res, errorOrReadiness) {
  if (errorOrReadiness?.code === 'STRIPE_CONNECT_STATUS_UNAVAILABLE') {
    return res.status(503).json({
      error: 'Stripe Connect-status er midlertidig utilgjengelig. Prøv igjen senere.',
      code: 'STRIPE_CONNECT_STATUS_UNAVAILABLE',
    });
  }
  return res.status(403).json({
    error: REQUIRED_MESSAGE,
    code: 'STRIPE_CONNECT_REQUIRED',
  });
}

module.exports = {
  getConnectReadiness,
  sendConnectReadinessFailure,
  StripeConnectUnavailableError,
  REQUIRED_MESSAGE,
};
