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
const { getStripe } = require('../config/stripe');

// ── create or retrieve account ──────────────────────────────────────────────
exports.createOrGetAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select(
      'name email stripeConnectAccountId payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted'
    );
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' });

    const stripe = await getStripe();

    // Reuse existing account if we already created one
    if (user.stripeConnectAccountId) {
      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
      await _syncAccountFields(user, account);
      return res.json({ accountId: account.id, status: user.payoutOnboardingStatus });
    }

    // Create a new Express account (fastest onboarding for marketplaces)
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'NO',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
      business_type: 'individual',
      metadata: { jobbloUserId: String(userId) },
    });

    await _syncAccountFields(user, account);
    res.json({ accountId: account.id, status: user.payoutOnboardingStatus });
  } catch (err) {
    console.error('createOrGetAccount error:', err);
    res.status(500).json({ error: 'Kunne ikke opprette Stripe-konto' });
  }
};

// ── create onboarding link ────────────────────────────────────────────────────
exports.createAccountLink = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select('stripeConnectAccountId name email');
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' });

    let accountId = user.stripeConnectAccountId;
    const stripe = await getStripe();

    if (!accountId) {
      // Auto-create if missing
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'NO',
        email: user.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { jobbloUserId: String(userId) },
      });
      await _syncAccountFields(user, account);
      accountId = account.id;
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

    const link = await stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${frontendUrl}/settings/payout?refresh=1`,
      return_url:  `${frontendUrl}/settings/payout?success=1`,
      type:        'account_onboarding',
    });

    res.json({ url: link.url });
  } catch (err) {
    console.error('createAccountLink error:', err);
    res.status(500).json({ error: 'Kunne ikke opprette onboarding-lenke' });
  }
};

// ── refresh status from Stripe ────────────────────────────────────────────────
exports.refreshAccountStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select(
      'stripeConnectAccountId payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted'
    );
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' });
    if (!user.stripeConnectAccountId) {
      return res.json({
        payoutOnboardingStatus: 'none',
        payoutEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
      });
    }

    const stripe = await getStripe();
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
    await _syncAccountFields(user, account);

    res.json({
      payoutOnboardingStatus: user.payoutOnboardingStatus,
      payoutEnabled:   user.payoutEnabled,
      chargesEnabled:  user.chargesEnabled,
      detailsSubmitted: user.detailsSubmitted,
    });
  } catch (err) {
    console.error('refreshAccountStatus error:', err);
    res.status(500).json({ error: 'Kunne ikke oppdatere status' });
  }
};

// ── get status for UI ─────────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select(
      'stripeConnectAccountId payoutOnboardingStatus payoutEnabled chargesEnabled detailsSubmitted connectAccountCreatedAt payoutOnboardingLastRefreshedAt'
    );
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet' });

    res.json({
      hasAccount:           !!user.stripeConnectAccountId,
      payoutOnboardingStatus: user.payoutOnboardingStatus,
      payoutEnabled:          user.payoutEnabled,
      chargesEnabled:         user.chargesEnabled,
      detailsSubmitted:       user.detailsSubmitted,
      connectedAt:            user.connectAccountCreatedAt,
      lastRefreshed:          user.payoutOnboardingLastRefreshedAt,
    });
  } catch (err) {
    console.error('getStatus error:', err);
    res.status(500).json({ error: 'Serverfeil' });
  }
};

// ── internal helper ───────────────────────────────────────────────────────────
async function _syncAccountFields(user, account) {
  const payouts = account.payouts_enabled;
  const charges = account.charges_enabled;
  const submitted = account.details_submitted;

  let onboardingStatus = 'none';
  if (submitted && payouts) {
    onboardingStatus = 'enabled';
  } else if (submitted && !payouts) {
    onboardingStatus = 'pending_verification';
  } else if (account.id) {
    onboardingStatus = 'started';
  }

  user.stripeConnectAccountId        = account.id;
  user.payoutOnboardingStatus        = onboardingStatus;
  user.payoutEnabled                 = payouts;
  user.chargesEnabled                = charges;
  user.detailsSubmitted              = submitted;
  user.payoutOnboardingLastRefreshedAt = new Date();
  if (!user.connectAccountCreatedAt) user.connectAccountCreatedAt = new Date();

  await user.save();
}
