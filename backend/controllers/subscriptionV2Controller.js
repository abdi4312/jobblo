const {
  checkoutEnabled,
  createSubscriptionCheckoutSession,
  SubscriptionV2Error,
} = require('../services/subscriptions/v2Checkout');
const management = require('../services/subscriptions/v2Management');
const entitlements = require('../services/subscriptions/v2Entitlements');
const checkout = require('../services/subscriptions/v2Checkout');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionV2 = require('../models/SubscriptionV2');
const Transaction = require('../models/Transaction');
const paidUpgradeRecovery = require('../services/subscriptions/v2PaidUpgradeRecovery');

function managementEnabled(env = process.env) {
  return env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED === 'true';
}

function planCatalogueEnabled(env = process.env) {
  return env.SUBSCRIPTION_V2_PLAN_CATALOGUE_ENABLED === 'true' || checkoutEnabled(env);
}

function managementRequest(action) {
  return async (req, res) => {
    if (!managementEnabled()) {
      return res.status(503).json({
        code: 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED',
        message: 'Subscription management is not currently available.',
      });
    }
    try {
      return res.json(await action(req.user?._id, req));
    } catch (err) {
      if (err instanceof management.SubscriptionManagementError) {
        return res.status(err.status).json({ code: err.code, message: err.message });
      }
      console.error('[Subscription V2] management request failed:', err);
      return res.status(503).json({
        code: 'SUBSCRIPTION_MANAGEMENT_UNAVAILABLE',
        message: 'Could not verify the subscription change. Please retry later.',
      });
    }
  };
}

function rebuildResponse(res) {
  return res.status(503).json({
    code: 'SUBSCRIPTION_REBUILD_IN_PROGRESS',
    message: 'Subscription functionality is temporarily unavailable.',
  });
}

function compatibilityRequest(action, flags = []) {
  return async (req, res) => {
    if (flags.some((flag) => !flag())) return rebuildResponse(res);
    try {
      return res.json(await action(req.user?._id, req));
    } catch (err) {
      if (
        err instanceof management.SubscriptionManagementError ||
        err instanceof entitlements.V2EntitlementError ||
        err instanceof SubscriptionV2Error
      ) {
        return res.status(err.status).json({ code: err.code, message: err.message });
      }
      console.error('[Subscription V2] compatibility request failed:', err);
      return res.status(503).json({
        code: 'SUBSCRIPTION_COMPATIBILITY_UNAVAILABLE',
        message: 'Subscription information could not be verified. Please retry later.',
      });
    }
  };
}

function entitlementsEnabled() {
  return entitlements.enabled();
}

async function legacySubscription(userId) {
  const [resolved, extraContactPayments] = await Promise.all([
    entitlements.resolveEntitlements(userId),
    Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'extra_contact',
          status: 'succeeded',
          refunded: { $ne: true },
          currency: 'nok',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  let current = null;
  try {
    current = (await management.getCurrentSubscription(userId)).subscription;
  } catch (err) {
    if (!(err instanceof management.SubscriptionManagementError) || err.code !== 'SUBSCRIPTION_NOT_FOUND') {
      throw err;
    }
  }
  const planEntitlements = resolved.entitlements || {};
  const status = current?.stripeStatus === 'canceled'
    ? 'cancelled'
    : current?.stripeStatus === 'incomplete_expired' || (current && !resolved.isPaid)
      ? 'expired'
      : resolved.status;
  const contacts = {
    includedLimit: resolved.includedContacts,
    includedUsed: resolved.consumedIncludedContacts,
    includedRemaining: resolved.remainingIncludedContacts,
    perContactPrice: Number.isFinite(planEntitlements.perContactPrice)
      ? planEntitlements.perContactPrice
      : null,
    contactUnlockMinutes: Number.isFinite(planEntitlements.ContactUnlock)
      ? planEntitlements.ContactUnlock
      : null,
    paidPurchased: resolved.purchasedExtraContacts,
    paidUsed: resolved.consumedExtraContacts,
    paidAvailable: Math.max(0, resolved.purchasedExtraContacts - resolved.consumedExtraContacts),
    totalPaidForExtraContacts: extraContactPayments[0]?.total || 0,
  };
  return {
    subscription: {
      hasPlan: Boolean(resolved.plan),
      plan: resolved.plan?.name || null,
      planId: resolved.plan?.id || null,
      planType: resolved.planType,
      contacts,
      status,
      stripeStatus: current?.stripeStatus || null,
      stripeSubscriptionId: current?.stripeSubscriptionId || null,
      cancelAtPeriodEnd: current?.cancelAtPeriodEnd || false,
      cancellationDate: current?.cancellationDate || null,
      currentPeriodEnd: current?.currentPeriodEnd || null,
      renewalDate: current?.renewalDate || null,
      price: resolved.plan?.price ?? null,
      billingInterval: 'month',
      pendingPlan: current?.pendingPlan || null,
      timeline: current?.timeline || [],
      stripeMode: current?.stripeMode || null,
      paymentRecovery: current?.paymentRecovery || {
        active: false,
        status: 'none',
        startedAt: null,
        deadline: null,
        remainingMilliseconds: 0,
        action: null,
      },
    },
  };
}

exports.getPlanCatalogue = async (_req, res) => {
  if (!planCatalogueEnabled()) return rebuildResponse(res);
  try {
    const plans = await SubscriptionPlan.find({ isActive: { $ne: false } })
      .select('_id name price type entitlements featuresText isActive')
      .sort({ type: 1, price: 1 })
      .lean();
    return res.json(plans.map((plan) => ({
      _id: plan._id,
      name: plan.name,
      price: plan.price,
      type: plan.type,
      entitlements: plan.entitlements,
      featuresText: plan.featuresText || [],
      isActive: plan.isActive,
      features: plan.featuresText || [],
      freeViews: plan.entitlements?.freeContact || 0,
      pricePerExtraView: plan.entitlements?.perContactPrice || 0,
    })));
  } catch (err) {
    console.error('[Subscription V2] plan catalogue lookup failed:', err);
    return res.status(503).json({
      code: 'SUBSCRIPTION_PLAN_CATALOGUE_UNAVAILABLE',
      message: 'Subscription plans could not be loaded.',
    });
  }
};

exports.createCheckoutSession = async (req, res) => {
  if (!checkoutEnabled()) {
    return res.status(503).json({
      code: 'SUBSCRIPTION_V2_CHECKOUT_DISABLED',
      message: 'Subscription checkout is not currently available.',
    });
  }

  try {
    const result = await createSubscriptionCheckoutSession({
      user: req.user,
      planId: req.body?.planId,
      couponCode: req.body?.couponCode,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof SubscriptionV2Error) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    console.error('[Subscription V2] checkout session creation failed:', err);
    return res.status(500).json({
      code: 'SUBSCRIPTION_CHECKOUT_FAILED',
      message: 'Could not start checkout. Please retry.',
    });
  }
};

exports.getCheckoutStatus = compatibilityRequest(
  (userId, req) => checkout.getSubscriptionCheckoutStatus(userId, req.params.sessionId),
  [checkoutEnabled]
);
exports.getBillingHistory = compatibilityRequest(
  (userId) => management.getBillingHistory(userId),
  [managementEnabled]
);
exports.getInvoicePdf = compatibilityRequest(
  (userId, req) => management.getInvoicePdf(userId, req.params.invoiceId, req.query.mode),
  [managementEnabled]
);
exports.legacyCancelSubscription = compatibilityRequest(
  (userId) => management.cancelSubscription(userId),
  [managementEnabled]
);
exports.legacyResumeSubscription = compatibilityRequest(
  (userId) => management.resumeSubscription(userId),
  [managementEnabled]
);
exports.legacyCancelScheduledPlanChange = compatibilityRequest(
  (userId) => management.cancelScheduledPlanChange(userId),
  [managementEnabled]
);
exports.legacyCreateBillingPortalSession = compatibilityRequest(
  (userId) => management.createBillingPortalSession(userId),
  [managementEnabled]
);
exports.legacyPreviewPlanChange = compatibilityRequest(
  (userId, req) => management.previewPlanChange(userId, req.body?.planId),
  [managementEnabled]
);
exports.legacyChangePlan = compatibilityRequest(
  (userId, req) => management.changePlan(userId, req.body?.planId),
  [managementEnabled]
);

exports.managementEnabled = managementEnabled;
exports.entitlementsEnabled = entitlementsEnabled;
exports.getCurrentSubscription = managementRequest((userId) =>
  management.getCurrentSubscription(userId)
);
exports.createBillingPortalSession = managementRequest((userId) =>
  management.createBillingPortalSession(userId)
);
exports.cancelSubscription = managementRequest((userId) =>
  management.cancelSubscription(userId)
);
exports.resumeSubscription = managementRequest((userId) =>
  management.resumeSubscription(userId)
);
exports.previewPlanChange = managementRequest((userId, req) =>
  management.previewPlanChange(userId, req.body?.planId)
);
exports.changePlan = managementRequest((userId, req) =>
  management.changePlan(userId, req.body?.planId)
);

exports.reconcilePaidUpgrade = async (req, res) => {
  if (
    !managementEnabled() ||
    process.env.SUBSCRIPTION_V2_PAID_UPGRADE_RECOVERY_ENABLED !== 'true'
  ) {
    return res.status(503).json({
      code: 'SUBSCRIPTION_V2_RECOVERY_DISABLED',
      message: 'Subscription recovery is not currently available.',
    });
  }
  try {
    return res.json(await paidUpgradeRecovery.recoverPaidUpgrade({
      adminId: req.user?._id,
      confirmation: req.body?.confirmation,
    }));
  } catch (err) {
    if (err instanceof paidUpgradeRecovery.PaidUpgradeRecoveryError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    console.error('[Subscription V2] paid upgrade reconciliation failed:', err);
    return res.status(503).json({
      code: 'SUBSCRIPTION_V2_RECOVERY_UNAVAILABLE',
      message: 'The paid upgrade could not be reconciled safely.',
    });
  }
};

exports.getEntitlements = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!entitlements.enabled()) {
      const hasV2Subscription = userId && await SubscriptionV2.exists({ userId });
      if (!hasV2Subscription) {
        return res.status(503).json({
          code: 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED',
          message: 'Subscription entitlements are not currently available.',
        });
      }
    }
    return res.json(await entitlements.resolveEntitlements(userId));
  } catch (err) {
    if (err instanceof entitlements.V2EntitlementError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    console.error('[Subscription V2] entitlement lookup failed:', err);
    return res.status(503).json({
      code: 'SUBSCRIPTION_ENTITLEMENTS_UNAVAILABLE',
      message: 'Could not verify subscription entitlements.',
    });
  }
};

exports.getLegacySubscription = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return rebuildResponse(res);

  if (!managementEnabled() || !entitlementsEnabled()) {
    try {
      const hasV2Subscription = await SubscriptionV2.exists({ userId });
      if (!hasV2Subscription) return rebuildResponse(res);
    } catch (err) {
      console.error('[Subscription V2] read access check failed:', err);
      return res.status(503).json({
        code: 'SUBSCRIPTION_COMPATIBILITY_UNAVAILABLE',
        message: 'Subscription information could not be verified. Please retry later.',
      });
    }
  }

  try {
    return res.json(await legacySubscription(userId));
  } catch (err) {
    if (
      err instanceof management.SubscriptionManagementError ||
      err instanceof entitlements.V2EntitlementError ||
      err instanceof SubscriptionV2Error
    ) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    console.error('[Subscription V2] read-only subscription request failed:', err);
    return res.status(503).json({
      code: 'SUBSCRIPTION_COMPATIBILITY_UNAVAILABLE',
      message: 'Subscription information could not be verified. Please retry later.',
    });
  }
};
