const { getStripe } = require('../config/stripe');
const User = require('../models/User');
const Order = require('../models/Order');
const Payout = require('../models/Payout');
const mongoose = require('mongoose');

/**
 * Shared Payout Service.
 * ONE place for:
 *   - Stripe Connect onboarding (account creation, account links, status refresh)
 *   - Release → transfer to provider (used by approve / legacy complete / dispute resolve / admin)
 *   - Idempotency + status transitions
 *
 * Callers use the SAME function — releaseFundsToProvider() — so behavior is identical
 * regardless of which path triggers release (YAGNI would otherwise leave each caller
 * slightly wrong in its own special way).
 */

const PLATFORM_FEE_RATE = 0.03;

/**
 * 3% platform fee, 0% tax for now, returns rounded amounts.
 * Reusable — must match the fee rules callers historically used for consistency.
 */
function computeAmounts(agreedPrice) {
  const gross = Number(agreedPrice) || 0;
  const fee = Math.round(gross * PLATFORM_FEE_RATE);
  const tax = 0;
  const net = Math.max(0, gross - fee);
  return {
    grossAmount: gross,
    platformFee: fee,
    taxAmount: tax,
    netProviderAmount: net,
  };
}

/**
 * Get or create a Stripe Connect Express account for a provider.
 * Idempotent: returns existing account if stripeConnectAccountId already set.
 */
async function getOrCreateConnectAccount(userId, { forceRefresh = false } = {}) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const stripe = await getStripe();
  let accountId = user.stripeConnectAccountId;
  let account = null;

  if (accountId) {
    try {
      account = await stripe.accounts.retrieve(accountId);
    } catch (stripeErr) {
      // Account no longer exists on Stripe's side — recreate.
      if (stripeErr.code === 'resource_missing' || stripeErr.statusCode === 404) {
        accountId = null;
      } else {
        throw stripeErr;
      }
    }
  }

  if (!accountId) {
    account = await stripe.accounts.create({
      type: 'express',
      country: 'NO',
      email: user.email || undefined,
      default_currency: 'nok',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: false },
      },
      business_type: 'individual',
      business_profile: {
        name: user.companyName || `${user.name || ''} ${user.lastName || ''}`.trim() || undefined,
        product_description: 'Jobber utført via Jobblo SafePay',
        url: user.website || undefined,
      },
      metadata: {
        userId: String(userId),
        source: 'jobblo_manual_onboarding',
      },
      settings: {
        payouts: {
          schedule: { interval: 'manual' },
        },
      },
    });
    accountId = account.id;
    user.stripeConnectAccountId = accountId;
    user.connectAccountCreatedAt = new Date();
  }

  // Always refresh local status mirrors from the canonical Stripe account object.
  if (!account) account = await stripe.accounts.retrieve(accountId);
  user.payoutOnboardingStatus = mapConnectStatus(account);
  user.payoutEnabled = Boolean(account.payouts_enabled);
  user.chargesEnabled = Boolean(account.charges_enabled);
  user.detailsSubmitted = Boolean(account.details_submitted);
  user.payoutOnboardingLastRefreshedAt = new Date();
  await user.save();

  return { user, stripeAccount: account };
}

/**
 * Map Stripe Account → local enum for the UI.
 * Returns one of: 'none' | 'started' | 'restricted' | 'pending_verification' | 'enabled'
 */
function mapConnectStatus(stripeAccount) {
  if (!stripeAccount) return 'none';
  const requirements = stripeAccount.requirements || {};
  const disabled = stripeAccount.payouts_enabled === false;
  const pending = (requirements.currently_due || []).length > 0;
  const eventually = (requirements.eventually_due || []).length > 0;
  const pastDue = (requirements.past_due || []).length > 0;
  const errors = (requirements.errors || []).length > 0;

  if (!stripeAccount.details_submitted && !pending && !eventually) return 'started';
  if (pastDue || errors) return 'restricted';
  if (pending) return 'pending_verification';
  if (disabled && eventually) return 'pending_verification';
  if (stripeAccount.payouts_enabled) return 'enabled';
  return 'pending_verification';
}

/**
 * Create a Stripe Account onboarding/link URL (Stripe-hosted).
 * Worker clicks → goes to Stripe → fills KYC/bank → returns.
 */
async function createOnboardingLink(userId, { refreshUrl, returnUrl } = {}) {
  const frontendBase = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';
  const { stripeAccount } = await getOrCreateConnectAccount(userId);
  const stripe = await getStripe();

  const link = await stripe.accountLinks.create({
    account: stripeAccount.id,
    refresh_url: refreshUrl || `${frontendBase}/settings/payout?refresh=true`,
    return_url: returnUrl || `${frontendBase}/settings/payout?return=true`,
    type: 'account_onboarding',
    collect: 'eventually_due',
  });

  return {
    url: link.url,
    expiresAt: link.expires_at,
    stripeConnectAccountId: stripeAccount.id,
  };
}

/**
 * Create (or return existing) Stripe Connect login / dashboard link for a worker
 * so they can manage payout settings on Stripe directly once onboarding is done.
 */
async function createDashboardLink(userId) {
  const user = await User.findById(userId);
  if (!user?.stripeConnectAccountId) {
    return null;
  }
  const stripe = await getStripe();
  try {
    const login = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);
    return { url: login.url, created: login.created };
  } catch (err) {
    // Account still pending — not yet eligible for dashboard login link
    if (err.code === 'account_country_invalid_address' || /pending/.test(err.message || '')) {
      return null;
    }
    throw err;
  }
}

/**
 * Refresh onboarding status from Stripe → update user doc.
 * UI calls this after the user returns from Stripe-hosted onboarding.
 */
async function refreshPayoutStatus(userId) {
  const { user, stripeAccount } = await getOrCreateConnectAccount(userId, { forceRefresh: true });
  return {
    status: user.payoutOnboardingStatus,
    payoutEnabled: user.payoutEnabled,
    chargesEnabled: user.chargesEnabled,
    detailsSubmitted: user.detailsSubmitted,
    requirements: stripeAccount.requirements || null,
    stripeConnectAccountId: user.stripeConnectAccountId,
    refreshedAt: user.payoutOnboardingLastRefreshedAt,
  };
}

/**
 * ── THE release → payout call. ──
 * Shared helper used by:
 *   - approveAndPayout
 *   - dispute release_to_provider
 *   - future admin override button
 *
 * Guarantees:
 *   - Idempotent (per orderId): cannot pay twice on retries, uses unique Payout.orderId index.
 *   - Requires provider has payoutEnabled = true; otherwise returns a retryable "blocked" state
 *     without losing the money or faking a paid status.
 *   - Creates a real Stripe Transfer to the provider's Connect account before marking paid.
 *   - Only increments provider earnings + sends paid notifications AFTER Stripe confirms transfer.
 *
 * Returns: { status, payout, transfer, reason? }
 */
async function releaseFundsToProvider({
  orderId,
  releasedBy,
  releaseSource,
  disputeId = null,
  // Optional: override provider if a dispute re-assigns recipient
  overrideProviderId = null,
  // Optional: override net (e.g., dispute partial release). Defaults to 3% rule.
  overrideNet = null,
  // Original agreedPrice for consistent fee calculation
  agreedPrice = null,
  // Stripe PaymentIntent (from checkout / payment capture) for source_transaction
  stripePaymentIntentId = null,
  idempotencyExtra = '',
}) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error('Invalid orderId');
  }
  if (!['customer_approve', 'legacy_complete', 'dispute_release', 'admin_override'].includes(releaseSource)) {
    throw new Error(`Invalid releaseSource: ${releaseSource}`);
  }

  const stripe = await getStripe();

  // 1. Load order in a transaction-safe-ish way using findOne + atomic status update later
  let order = await Order.findById(orderId)
    .populate('serviceId')
    .populate('customerId', '_id name email')
    .populate('providerId', '_id name email stripeConnectAccountId payoutEnabled payoutOnboardingStatus detailsSubmitted');

  if (!order) throw new Error('Order not found');

  const providerId = overrideProviderId || order.providerId;
  const price = agreedPrice || order.agreedPrice || 0;
  const amounts =
    overrideNet != null
      ? {
          grossAmount: price,
          platformFee: Math.max(0, price - overrideNet),
          taxAmount: 0,
          netProviderAmount: Math.max(0, overrideNet),
        }
      : computeAmounts(price);

  const netNokMinor = Math.round(amounts.netProviderAmount * 100);

  // 2. Idempotency key (per order + release source + any dispute context).
  //    If caller retries twice with same inputs, Stripe returns the first transfer.
  const idempotencyKey = `payout_${orderId}_${releaseSource}${disputeId ? `_${disputeId}` : ''}${idempotencyExtra ? `_${idempotencyExtra}` : ''}`;

  // 3. Payout record must be unique per orderId (DB-level unique index) — so findOneAndUpdate
  //    prevents double-insert races.
  let payout = await Payout.findOne({ orderId }).session(undefined);
  if (!payout) {
    try {
      payout = await Payout.create({
        orderId,
        providerId,
        customerId: order.customerId._id || order.customerId,
        serviceId: order.serviceId?._id || order.serviceId,
        grossAmount: amounts.grossAmount,
        platformFee: amounts.platformFee,
        taxAmount: amounts.taxAmount,
        netProviderAmount: amounts.netProviderAmount,
        currency: 'NOK',
        stripePaymentIntentId: stripePaymentIntentId || (order.paymentIntentId || order.paymentId || null),
        stripeCheckoutSessionId: order.checkoutSessionId || null,
        disputeId,
        status: 'pending',
        releaseSource,
        releasedBy,
        idempotencyKey,
      });
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.orderId) {
        payout = await Payout.findOne({ orderId });
      } else if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
        payout = await Payout.findOne({ idempotencyKey });
      } else {
        throw err;
      }
    }
  }

  // 4. If payout is already fully transferred → return fast (idempotent success).
  if (payout.status === 'transferred') {
    return { status: 'transferred', payout, alreadyPaid: true };
  }

  // 5. If already processing/paid but not transferred yet, allow retry but gate status.
  if (['processing'].includes(payout.status)) {
    // If a transfer id exists already, sync status.
    if (payout.stripeTransferId) {
      try {
        const tr = await stripe.transfers.retrieve(payout.stripeTransferId);
        if (tr && tr.status === 'paid' || tr?.reversed === false && tr.status === 'pending') {
          payout.transitionTo('transferred');
          await payout.save();
          return { status: 'transferred', payout, alreadyPaid: true };
        }
      } catch (_) {
        // Ignore — retry transfer below.
      }
    }
  }

  // 6. Move to released_internal (tracks the logical OK to release from SafePay).
  if (payout.status === 'pending') {
    payout.transitionTo('released_internal', { releasedBy, releaseSource });
    await payout.save();
  }

  // 7. Validate provider's Connect account READY.
  //    If NOT ready: stop here. Keep status = released_internal so admin can retry later.
  //    NEVER mark "paid" if the transfer cannot actually be sent.
  let provider = payout.providerId?._id ? payout.providerId : await User.findById(providerId);
  if (!provider.stripeConnectAccountId || !provider.payoutEnabled) {
    // Refresh once just in case status was updated on Stripe side but not mirrored locally
    try {
      const refreshed = await getOrCreateConnectAccount(providerId);
      provider = refreshed.user;
    } catch (_) { /* ignore */ }

    if (!provider.stripeConnectAccountId) {
      payout.failureReason = 'Provider has no Stripe Connect account. Send onboarding link from /settings/payout.';
      payout.failureCode = 'connect_missing';
      await payout.save();
      return {
        status: 'blocked',
        payout,
        reason: 'provider_missing_connect_account',
        human: 'Utøver har ikke konfigurert utbetalingskonto (Stripe Connect).',
      };
    }
    if (!provider.payoutEnabled) {
      payout.failureReason = 'Provider Stripe Connect payouts not enabled yet — onboarding incomplete.';
      payout.failureCode = 'connect_payouts_disabled';
      await payout.save();
      return {
        status: 'blocked',
        payout,
        reason: 'provider_payouts_not_enabled',
        human: 'Utøver sine utbetalinger er deaktivert i Stripe (KYC/verifisering mangler).',
      };
    }
  }

  // 8. Move to processing, execute real Stripe transfer, IDEMPOTENCY-KEY scoped to Stripe call.
  if (payout.status === 'released_internal' || payout.status === 'failed') {
    payout.transitionTo('processing');
    payout.stripeConnectAccountId = provider.stripeConnectAccountId;
    payout.transferInitiatedAt = new Date();
    await payout.save();
  }

  if (netNokMinor <= 0) {
    // Zero/net — can't send a transfer. Mark paid for tracking (admin case).
    payout.transitionTo('transferred');
    await payout.save();
    return { status: 'transferred', payout, zeroValue: true };
  }

  let transfer = null;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: netNokMinor,
        currency: 'nok',
        destination: provider.stripeConnectAccountId,
        source_transaction: payout.stripePaymentIntentId || undefined,
        metadata: {
          orderId: String(orderId),
          providerId: String(providerId),
          releaseSource,
          payoutId: String(payout._id),
        },
      },
      { idempotencyKey }
    );
  } catch (stripeErr) {
    // If SAME idempotency-key returned a cached transfer on a prior retry that we missed
    // (e.g. the create succeeded but the response errored), retrieve it:
    if (stripeErr?.code === 'idempotency_key_in_use') {
      // Wait briefly then poll our own idempotency match via search
      const existing = await stripe.transfers.list({
        destination: provider.stripeConnectAccountId,
        limit: 5,
      });
      transfer = (existing.data || []).find(
        (t) =>
          t.metadata?.orderId === String(orderId) &&
          t.metadata?.payoutId === String(payout._id)
      ) || null;
    }
    if (!transfer) {
      payout.transitionTo('failed', {
        failureReason: stripeErr?.message || String(stripeErr),
        failureCode: stripeErr?.code || 'stripe_transfer_error',
      });
      await payout.save();
      return {
        status: 'failed',
        payout,
        error: stripeErr?.message || String(stripeErr),
        retryable: isRetryableStripeErr(stripeErr),
      };
    }
  }

  // 9. SUCCESS — now finalize: store transfer id, transition, update provider earnings.
  payout.stripeTransferId = transfer.id;
  if (transfer.status === 'paid' || transfer.status === 'pending') {
    try {
      payout.transitionTo('transferred');
    } catch (_) {
      // Already transferred on a raced concurrent call (unique index would have tripped first)
    }
  }
  await payout.save();

  // Increment provider earnings only AFTER a successful transfer confirmation.
  // ponytail: We increment earnings AFTER transfer succeeds, not before, so failed
  // payouts cannot pretend to be paid. Earnings is a display field; the canonical
  // balance is the Stripe Connect account itself.
  const providerDoc = await User.findById(providerId);
  if (providerDoc) {
    providerDoc.earnings = (providerDoc.earnings || 0) + amounts.netProviderAmount;
    await providerDoc.save();
  }

  return {
    status: payout.status,
    payout,
    transfer,
  };
}

function isRetryableStripeErr(err) {
  if (!err) return false;
  const retryableCodes = new Set([
    'api_connection_error',
    'api_error',
    'idempotency_key_in_use',
    'rate_limit',
    'temporary_session_expired',
    'bank_account_unverified', // retry after KYC
    'account_closed',
  ]);
  if (retryableCodes.has(err.code)) return true;
  if (err.statusCode && err.statusCode >= 500) return true;
  return false;
}

/**
 * Retry a previously blocked / failed payout (if onboarding finished or Stripe hiccup fixed).
 * Admin or the system-cron can call this; owner authorization is checked at route layer.
 */
async function retryPayout(payoutId, { actorId, actorRole }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw new Error('Payout not found');
  if (payout.status === 'transferred') return { status: 'transferred', payout, alreadyPaid: true };

  return releaseFundsToProvider({
    orderId: payout.orderId,
    releasedBy: actorId,
    releaseSource: payout.releaseSource === 'dispute_release' ? 'dispute_release' : 'admin_override',
    disputeId: payout.disputeId || null,
    overrideProviderId: payout.providerId,
    overrideNet: payout.netProviderAmount,
    agreedPrice: payout.grossAmount,
    stripePaymentIntentId: payout.stripePaymentIntentId,
    idempotencyExtra: `retry_${Date.now()}_${actorId}`,
  });
}

/**
 * Public helper to decide what the UI "Setup required / Ready / etc." copy should be.
 * Returns a simple object the settings UI can switch on.
 */
function summarizePayoutStatus(user) {
  const status = user?.payoutOnboardingStatus || 'none';
  if (!user?.stripeConnectAccountId || status === 'none') {
    return { state: 'not_configured', canStart: true, canOpenDashboard: false };
  }
  if (status === 'enabled' && user.payoutEnabled) {
    return { state: 'ready', canStart: false, canOpenDashboard: true };
  }
  if (status === 'restricted') {
    return { state: 'action_required', canStart: true, canOpenDashboard: false };
  }
  return { state: 'verification_pending', canStart: true, canOpenDashboard: false };
}

module.exports = {
  computeAmounts,
  PLATFORM_FEE_RATE,
  getOrCreateConnectAccount,
  createOnboardingLink,
  createDashboardLink,
  refreshPayoutStatus,
  releaseFundsToProvider,
  retryPayout,
  summarizePayoutStatus,
  mapConnectStatus,
};
