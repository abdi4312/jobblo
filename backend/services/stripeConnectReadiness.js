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

/**
 * Pure: is this Stripe account allowed to receive SafePay payouts? The one definition used by
 * the payout gate (getConnectReadiness) and the developer Connect Health Center.
 */
function readinessFromAccount(account) {
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
    ready,
    payoutEnabled: account.payouts_enabled === true,
    transfersEnabled,
    detailsSubmitted: account.details_submitted === true,
    chargesEnabled: account.charges_enabled === true,
    disabledReason: requirements.disabled_reason || null,
    currentlyDue,
    pastDue,
    pendingVerification,
    eventuallyDue: requirements.eventually_due || [],
    currentDeadline: requirements.current_deadline ? new Date(requirements.current_deadline * 1000) : null,
    errors: (requirements.errors || []).map((e) => ({ requirement: e.requirement, code: e.code, reason: e.reason })),
    payoutOnboardingStatus: ready
      ? 'enabled'
      : requirements.disabled_reason
        ? 'restricted'
        : pendingVerification.length > 0
          ? 'pending_verification'
          : 'started',
  };
}

async function getConnectReadiness(userId, selectedConfig) {
  try {
    const config = selectedConfig || await getStripeConfiguration();
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
    if (
      account.id !== accountId ||
      (account.metadata?.jobbloUserId &&
        account.metadata.jobbloUserId !== String(userId))
    ) {
      const error = new Error('Connected account does not match the stored Jobblo provider.');
      error.code = 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH';
      throw error;
    }
    const r = readinessFromAccount(account);
    return {
      ...base,
      ready: r.ready,
      reason: r.ready ? null : 'onboarding_incomplete',
      payoutEnabled: r.payoutEnabled,
      transfersEnabled: r.transfersEnabled,
      detailsSubmitted: r.detailsSubmitted,
      chargesEnabled: r.chargesEnabled,
      payoutOnboardingStatus: r.payoutOnboardingStatus,
    };
  } catch (error) {
    if (
      error.type === 'StripeInvalidRequestError' &&
      (error.code === 'resource_missing' || error.statusCode === 404)
    ) {
      const missing = new Error('Stored Stripe Connect account was not found in the selected mode.');
      missing.code = 'STRIPE_CONNECT_ACCOUNT_NOT_FOUND';
      missing.cause = error;
      throw missing;
    }
    if (error.type === 'StripeInvalidRequestError' && error.code === 'account_invalid') {
      const mismatch = new Error('Stored Stripe Connect account does not match the selected mode.');
      mismatch.code = 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH';
      mismatch.cause = error;
      throw mismatch;
    }
    if (['USER_NOT_FOUND', 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH'].includes(error.code)) {
      throw error;
    }
    if (error.code === 'STRIPE_CONNECT_ACCOUNT_NOT_FOUND') throw error;
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
  readinessFromAccount,
  sendConnectReadinessFailure,
  StripeConnectUnavailableError,
  REQUIRED_MESSAGE,
};
