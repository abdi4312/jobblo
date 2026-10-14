/**
 * Stripe Connect — provider onboarding endpoints.
 *
 * Routes (all require authenticate middleware):
 *   POST /api/connect/account          — create or retrieve connected account
 *   POST /api/connect/account-link     — create hosted onboarding link
 *   POST /api/connect/refresh          — refresh account status from Stripe
 *   GET  /api/connect/status           — get current connect status for UI
 */

const User = require('../models/User');
const crypto = require('crypto');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const { getConnectReadiness } = require('../services/stripeConnectReadiness');

function accountFieldForMode(testMode) {
  return testMode ? 'stripeConnectAccountIdTest' : 'stripeConnectAccountId';
}

function accountCreateParams(user, userId) {
  return {
    type: 'express',
    country: 'NO',
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: { jobbloUserId: String(userId) },
  };
}

function accountCreateIdempotencyKey(userId, testMode) {
  const userHash = crypto.createHash('sha256').update(String(userId)).digest('hex');
  return `jobblo_connect_${testMode ? 'test' : 'live'}_${userHash}`;
}

function getFrontendBaseUrl() {
  const value = (
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173')
  ).trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    const error = new Error('Invalid Stripe Connect return URL.');
    error.code = 'STRIPE_CONNECT_RETURN_URL_INVALID';
    throw error;
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
  ) {
    const error = new Error('Invalid Stripe Connect return URL.');
    error.code = 'STRIPE_CONNECT_RETURN_URL_INVALID';
    throw error;
  }
  return url.toString().replace(/\/+$/, '');
}

function validateAccountOwner(account, userId) {
  if (
    account.metadata?.jobbloUserId &&
    account.metadata.jobbloUserId !== String(userId)
  ) {
    const error = new Error('Connected account owner does not match.');
    error.code = 'STRIPE_CONNECT_ACCOUNT_OWNER_MISMATCH';
    throw error;
  }
}

async function persistConnectAccount(user, account, testMode) {
  const accountField = accountFieldForMode(testMode);
  const onboardingStatus = account.details_submitted
    ? account.payouts_enabled ? 'enabled' : 'pending_verification'
    : 'started';
  const result = await User.updateOne(
    {
      _id: user._id,
      $or: [
        { [accountField]: { $exists: false } },
        { [accountField]: null },
        { [accountField]: account.id },
      ],
    },
    {
      $set: {
        [accountField]: account.id,
        payoutOnboardingStatus: onboardingStatus,
        payoutEnabled: account.payouts_enabled === true,
        chargesEnabled: account.charges_enabled === true,
        detailsSubmitted: account.details_submitted === true,
        payoutOnboardingLastRefreshedAt: new Date(),
      },
    }
  );
  if (result.matchedCount === 0 || result.n === 0) {
    const error = new Error('Connected account changed concurrently.');
    error.code = 'STRIPE_CONNECT_ACCOUNT_CONFLICT';
    throw error;
  }
}

async function getOrCreateConnectAccount(user, userId, stripe, testMode) {
  const accountField = accountFieldForMode(testMode);
  let account;
  if (user[accountField]) {
    account = await stripe.accounts.retrieve(user[accountField]);
    if (account.id !== user[accountField]) {
      const error = new Error('Stripe returned a different connected account.');
      error.code = 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH';
      throw error;
    }
    if (account.deleted) {
      const error = new Error('Connected account is deleted in the selected Stripe mode.');
      error.type = 'StripeInvalidRequestError';
      error.code = 'resource_missing';
      error.statusCode = 404;
      throw error;
    }
  } else {
    account = await stripe.accounts.create(accountCreateParams(user, userId), {
      idempotencyKey: accountCreateIdempotencyKey(userId, testMode),
    });
  }
  validateAccountOwner(account, userId);
  await persistConnectAccount(user, account, testMode);
  return account;
}

function sendConnectError(res, error) {
  const stripeError = error.cause || error;
  const message = String(stripeError.message || '');
  console.error('Stripe Connect request failed:', {
    type: stripeError.type,
    code: stripeError.code,
    requestId: stripeError.requestId || stripeError.raw?.requestId,
    statusCode: stripeError.statusCode || stripeError.raw?.statusCode,
    param: stripeError.param,
  });

  if (error.code === 'STRIPE_CONNECT_PLATFORM_SETUP_REQUIRED' ||
      stripeError.type === 'StripePermissionError' ||
      stripeError.code === 'connect_not_enabled' ||
      /review the responsibilities of managing losses|negative balance liability|settings\/connect\/platform-profile/i.test(message)) {
    return res.status(503).json({
      code: 'STRIPE_CONNECT_PLATFORM_SETUP_REQUIRED',
      error: 'Stripe Connect-oppsettet må fullføres av plattformadministratoren.',
    });
  }
  if (error.code === 'STRIPE_CONNECT_ACCOUNT_OWNER_MISMATCH') {
    return res.status(409).json({
      code: error.code,
      error: 'Den lagrede Stripe-kontoen er ikke knyttet til denne brukeren. Kontakt kundestøtte.',
    });
  }
  if (error.code === 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH') {
    return res.status(409).json({
      code: error.code,
      error: 'Den lagrede Stripe-kontoen samsvarer ikke med denne brukeren eller valgt modus. Kontakt kundestøtte.',
    });
  }
  if (error.code === 'STRIPE_CONNECT_ACCOUNT_CONFLICT') {
    return res.status(409).json({
      code: error.code,
      error: 'Stripe-kontoen ble endret samtidig. Last inn siden og prøv igjen.',
    });
  }
  if (error.code === 'STRIPE_CONNECT_RETURN_URL_INVALID') {
    return res.status(503).json({
      code: error.code,
      error: 'Stripe Connect-returadressen mangler eller er ugyldig. Kontakt kundestøtte.',
    });
  }
  if (/Stripe secret key is missing or invalid|Stripe mode configuration is invalid/i.test(message)) {
    return res.status(503).json({
      code: 'STRIPE_API_KEY_MISSING_OR_INVALID',
      error: 'Stripe API-nøkkelen mangler eller samsvarer ikke med valgt modus.',
    });
  }
  if (stripeError.type === 'StripeAuthenticationError') {
    return res.status(503).json({
      code: 'STRIPE_API_KEY_INVALID',
      error: 'Stripe avviste plattformens API-nøkkel. Kontakt kundestøtte.',
    });
  }
  if (
    stripeError.type === 'StripeInvalidRequestError' &&
    (stripeError.code === 'resource_missing' ||
      stripeError.code === 'account_invalid' ||
      stripeError.statusCode === 404)
  ) {
    return res.status(409).json({
      code: stripeError.code === 'account_invalid'
        ? 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH'
        : 'STRIPE_CONNECT_ACCOUNT_NOT_FOUND',
      error: 'Stripe-kontoen finnes ikke i valgt modus. Test- og live-kontoer kan ikke brukes om hverandre.',
    });
  }
  if (stripeError.param === 'refresh_url' || stripeError.param === 'return_url' ||
      error.code === 'STRIPE_CONNECT_RETURN_URL_INVALID') {
    return res.status(503).json({
      code: 'STRIPE_CONNECT_RETURN_URL_INVALID',
      error: 'Stripe Connect-returadressen mangler eller er ugyldig. Kontakt kundestøtte.',
    });
  }
  if (
    ['StripeAPIError', 'StripeConnectionError', 'StripeRateLimitError'].includes(stripeError.type)
  ) {
    return res.status(503).json({
      code: 'STRIPE_CONNECT_TEMPORARILY_UNAVAILABLE',
      error: 'Stripe er midlertidig utilgjengelig. Prøv igjen senere.',
    });
  }
  return res.status(500).json({
    code: 'STRIPE_CONNECT_UNEXPECTED_ERROR',
    error: 'Kunne ikke fullføre Stripe Connect-oppsettet. Prøv igjen senere.',
  });
}

// ── create or retrieve account ──────────────────────────────────────────────
exports.createOrGetAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const stripeConfig = await getStripeConfiguration();
    if (stripeConfig.keyModeValid === false) {
      const error = new Error('Stripe mode configuration is invalid.');
      throw error;
    }
    const user = await User.findById(userId).select(
      'name email stripeConnectAccountId stripeConnectAccountIdTest payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted'
    );
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' });

    const stripe = await getStripeForMode(stripeConfig.testMode);
    const account = await getOrCreateConnectAccount(user, userId, stripe, stripeConfig.testMode);
    res.json({
      accountId: account.id,
      status: account.details_submitted
        ? account.payouts_enabled ? 'enabled' : 'pending_verification'
        : 'started',
    });
  } catch (err) {
    return sendConnectError(res, err);
  }
};

// ── create onboarding link ────────────────────────────────────────────────────
exports.createAccountLink = async (req, res) => {
  try {
    const userId = req.userId;
    const stripeConfig = await getStripeConfiguration();
    if (stripeConfig.keyModeValid === false) {
      const error = new Error('Stripe mode configuration is invalid.');
      throw error;
    }
    const user = await User.findById(userId).select(
      'stripeConnectAccountId stripeConnectAccountIdTest name email'
    );
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' });

    const stripe = await getStripeForMode(stripeConfig.testMode);
    const frontendUrl = getFrontendBaseUrl();
    const account = await getOrCreateConnectAccount(user, userId, stripe, stripeConfig.testMode);
    const accountId = account.id;

    const readiness = await getConnectReadiness(userId, stripeConfig);
    if (readiness.ready) {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      return res.json({ url: loginLink.url });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/settings/payout?refresh=1`,
      return_url: `${frontendUrl}/settings/payout?success=1`,
      type: 'account_onboarding',
    });

    return res.json({ url: link.url });
  } catch (err) {
    return sendConnectError(res, err);
  }
};

// ── refresh status from Stripe ────────────────────────────────────────────────
exports.refreshAccountStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const stripeConfig = await getStripeConfiguration();
    if (stripeConfig.keyModeValid === false) {
      const error = new Error('Stripe mode configuration is invalid.');
      throw error;
    }
    const accountField = accountFieldForMode(stripeConfig.testMode);
    const user = await User.findById(userId).select(
      'stripeConnectAccountId stripeConnectAccountIdTest payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted'
    );
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' });
    if (!user[accountField]) {
      return res.json({
        payoutOnboardingStatus: 'none',
        payoutEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
      });
    }

    const stripe = await getStripeForMode(stripeConfig.testMode);
    const account = await stripe.accounts.retrieve(user[accountField]);
    if (account.id !== user[accountField]) {
      const error = new Error('Stripe returned a different connected account.');
      error.code = 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH';
      throw error;
    }
    validateAccountOwner(account, userId);
    await _syncAccountFields(user, account, stripeConfig.testMode);

    return res.json({
      payoutOnboardingStatus: account.requirements?.disabled_reason
        ? 'restricted'
        : account.requirements?.pending_verification?.length
          ? 'pending_verification'
          : account.details_submitted
            ? account.payouts_enabled ? 'enabled' : 'pending_verification'
            : 'started',
      payoutEnabled: account.payouts_enabled === true,
      chargesEnabled: account.charges_enabled === true,
      detailsSubmitted: account.details_submitted === true,
    });
  } catch (err) {
    return sendConnectError(res, err);
  }
};

// ── get status for UI ─────────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const readiness = await getConnectReadiness(userId);

    res.json({
      hasAccount: readiness.hasAccount,
      mode: readiness.mode,
      payoutReady: readiness.ready,
      transfersEnabled: readiness.transfersEnabled,
      payoutOnboardingStatus: readiness.payoutOnboardingStatus,
      payoutEnabled: readiness.payoutEnabled,
      chargesEnabled: readiness.chargesEnabled,
      detailsSubmitted: readiness.detailsSubmitted,
      accountId: readiness.accountId,
      connectedAt: readiness.connectedAt,
      lastRefreshed: readiness.lastRefreshed,
    });
  } catch (err) {
    const cause = err.cause || err;
    console.error('Stripe Connect status lookup failed:', {
      type: cause.type,
      code: cause.code,
      requestId: cause.requestId || cause.raw?.requestId,
      statusCode: cause.statusCode || cause.raw?.statusCode,
    });
    if (err.code === 'STRIPE_CONNECT_STATUS_UNAVAILABLE') {
      return res.status(503).json({
        error: 'Stripe Connect-status er midlertidig utilgjengelig. Prøv igjen senere.',
        code: err.code,
      });
    }
    return sendConnectError(res, err);
  }
};

// ── internal helper ───────────────────────────────────────────────────────────
async function _syncAccountFields(user, account, testMode) {
  validateAccountOwner(account, user._id);
  return persistConnectAccount(user, account, testMode);
}
