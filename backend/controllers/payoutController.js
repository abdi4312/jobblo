const Payout = require('../models/Payout');
const {
  refreshPayoutStatus,
  createOnboardingLink,
  createDashboardLink,
  retryPayout,
  releaseFundsToProvider,
  summarizePayoutStatus,
} = require('../services/payoutService');

/**
 * GET /api/payouts/status
 * Worker views their own Connect payout status + summary.
 */
exports.getOwnStatus = async (req, res) => {
  try {
    const userId = req.userId;
    let statusResp = null;
    try {
      statusResp = await refreshPayoutStatus(userId);
    } catch (stripeErr) {
      // If Stripe is down/unreachable, fall back to stored values so the page still renders
      const User = require('../models/User');
      const u = await User.findById(userId);
      if (!u) return res.status(404).json({ error: 'User not found' });
      statusResp = {
        status: u.payoutOnboardingStatus,
        payoutEnabled: u.payoutEnabled,
        chargesEnabled: u.chargesEnabled,
        detailsSubmitted: u.detailsSubmitted,
        requirements: null,
        stripeConnectAccountId: u.stripeConnectAccountId,
        refreshedAt: u.payoutOnboardingLastRefreshedAt,
      };
    }
    const summary = summarizePayoutStatus(statusResp);
    const dashboardLink = summary.canOpenDashboard
      ? await createDashboardLink(userId)
      : null;

    return res.json({
      ...statusResp,
      summary,
      dashboardUrl: dashboardLink?.url || null,
      dashboardUrlCreated: dashboardLink?.created || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * POST /api/payouts/onboarding-link
 * Creates or refreshes the Stripe Connect onboarding link for the caller.
 * Returns a URL the frontend can navigate to (Stripe-hosted KYC + bank form).
 */
exports.postOnboardingLink = async (req, res) => {
  try {
    const { refreshUrl, returnUrl } = req.body || {};
    const link = await createOnboardingLink(req.userId, { refreshUrl, returnUrl });
    return res.json(link);
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * POST /api/payouts/refresh
 * Worker returns from Stripe onboarding → hits this to refresh stored status
 * against the latest Stripe account object.
 */
exports.postRefreshStatus = async (req, res) => {
  try {
    const refreshed = await refreshPayoutStatus(req.userId);
    const summary = summarizePayoutStatus(refreshed);
    const dashboardLink = summary.canOpenDashboard
      ? await createDashboardLink(req.userId)
      : null;
    return res.json({ ...refreshed, summary, dashboardUrl: dashboardLink?.url || null });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * GET /api/payouts?orderId=… | ?status=…
 * Worker or admin views payout records (only own records for non-admin users).
 */
exports.listPayouts = async (req, res) => {
  try {
    const { orderId, status, page = 1, limit = 20 } = req.query;
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'superAdmin';
    const query = {};
    if (!isAdmin) query.providerId = req.userId;
    if (orderId) query.orderId = orderId;
    if (status) query.status = status;
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Math.min(100, Number(limit)));
    const lmt = Math.max(1, Math.min(100, Number(limit)));

    const [docs, total] = await Promise.all([
      Payout.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lmt)
        .populate('orderId', '_id status agreedPrice completedAt serviceId')
        .populate('serviceId', '_id title'),
      Payout.countDocuments(query),
    ]);
    return res.json({
      payouts: docs,
      pagination: { total, page: Number(page), limit: lmt, totalPages: Math.ceil(total / lmt) },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * POST /api/payouts/:payoutId/retry
 * Admin OR the worker (if payout.status in [failed/blocked] and user owns it) can retry.
 */
exports.postRetry = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const payout = await Payout.findById(payoutId);
    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'superAdmin';
    if (!isAdmin && String(payout.providerId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to retry this payout' });
    }
    const result = await retryPayout(payoutId, {
      actorId: req.userId,
      actorRole: isAdmin ? 'admin' : 'user',
    });
    return res.status(result.status === 'failed' || result.status === 'blocked' ? 422 : 200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * GET /api/payouts/order/:orderId
 * Single-payout for an order — used by SafePayHistoryView and ProviderOrderDetailPage.
 * Admin sees all; users only their own.
 */
exports.getByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'superAdmin';
    const query = { orderId };
    if (!isAdmin) {
      query.$or = [{ providerId: req.userId }, { customerId: req.userId }];
    }
    const payout = await Payout.findOne(query).populate('orderId', '_id status agreedPrice');
    if (!payout) return res.status(404).json({ error: 'No payout record for this order' });
    return res.json({ payout });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};

/**
 * ── Admin / manual override ───────────────────────────────────────────────
 * POST /api/payouts/admin/release  (requires admin/superAdmin)
 * Force a release for a given order. Intended for dashboard use; NOT for regular users.
 */
exports.adminForceRelease = async (req, res) => {
  try {
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'superAdmin';
    if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
    const { orderId, overrideNet, overrideProviderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    const result = await releaseFundsToProvider({
      orderId,
      releasedBy: req.userId,
      releaseSource: 'admin_override',
      overrideNet,
      overrideProviderId,
      idempotencyExtra: `admin_${Date.now()}`,
    });
    return res
      .status(
        result.status === 'failed' || result.status === 'blocked' ? 422 : 200
      )
      .json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};
