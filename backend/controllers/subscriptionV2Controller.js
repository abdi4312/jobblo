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

function v2DisabledResponse(res, code, message) {
  return res.status(503).json({
    code,
    message,
  });
}

function compatibilityRequest(action, flags = [], disabledCode = 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED') {
  return async (req, res) => {
    if (flags.some((flag) => !flag())) {
      return v2DisabledResponse(
        res,
        disabledCode,
        disabledCode === 'SUBSCRIPTION_V2_CHECKOUT_DISABLED'
          ? 'Subscription checkout is not currently available.'
          : 'Subscription management is not currently available.'
      );
    }
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
  if (!planCatalogueEnabled()) {
    return v2DisabledResponse(
      res,
      'SUBSCRIPTION_V2_PLAN_CATALOGUE_DISABLED',
      'Subscription plans are not currently available.'
    );
  }
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
  [checkoutEnabled],
  'SUBSCRIPTION_V2_CHECKOUT_DISABLED'
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

const mongoose = require('mongoose');
const { logActivity } = require('../services/admin/activityService');

// Admin-editable plan entitlements. Price, name, type and isActive stay locked: the price
// is tied to the Stripe Price that checkout verifies amounts against, the name is how
// clients match a plan, and deactivating the free plan breaks every free user.
const PLAN_NUMBER_ENTITLEMENTS = ['freeContact', 'radius', 'numberOfCustomers', 'maxJobsValue', 'perContactPrice', 'ContactUnlock', 'maxContact', 'visibilityLevel'];
const PLAN_INTEGER_ENTITLEMENTS = ['freeContact', 'numberOfCustomers', 'ContactUnlock', 'maxContact', 'visibilityLevel'];
const PLAN_LOCKED_FIELDS = {
  name: (v) => String(v ?? '').trim(),
  price: (v) => Number(v),
  type: (v) => String(v ?? ''),
  isActive: (v) => v === true || v === 'true',
};

/** PUT /api/plans/:id (superAdmin) — entitlements and feature text only. */
exports.updatePlanEntitlements = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id || ''))) {
      return res.status(400).json({ code: 'PLAN_ID_INVALID', message: 'Ugyldig plan-ID.' });
    }
    const plan = await SubscriptionPlan.findById(req.params.id).lean();
    if (!plan) return res.status(404).json({ code: 'PLAN_NOT_FOUND', message: 'Planen finnes ikke.' });
    const body = req.body || {};

    for (const [field, normalize] of Object.entries(PLAN_LOCKED_FIELDS)) {
      if (body[field] !== undefined && normalize(body[field]) !== normalize(plan[field])) {
        return res.status(409).json({
          code: 'PLAN_FIELD_LOCKED',
          field,
          message: `${field} kan ikke endres her: den er koblet til Stripe-prisen og eksisterende abonnementer.`,
        });
      }
    }

    const set = {};
    const ent = body.entitlements;
    if (ent !== undefined) {
      if (!ent || typeof ent !== 'object' || Array.isArray(ent)) {
        return res.status(400).json({ code: 'PLAN_ENTITLEMENTS_INVALID', message: 'Ugyldige rettigheter.' });
      }
      for (const key of PLAN_NUMBER_ENTITLEMENTS) {
        if (ent[key] === undefined || ent[key] === null || ent[key] === '') continue;
        const n = Number(ent[key]);
        if (!Number.isFinite(n) || n < 0 || (PLAN_INTEGER_ENTITLEMENTS.includes(key) && !Number.isInteger(n))) {
          return res.status(400).json({ code: 'PLAN_ENTITLEMENT_INVALID', field: key, message: `${key} må være et gyldig tall (0 eller mer).` });
        }
        set[`entitlements.${key}`] = n;
      }
      if (ent.locationPrecision !== undefined) {
        if (!['exact', 'approximate'].includes(ent.locationPrecision)) {
          return res.status(400).json({ code: 'PLAN_ENTITLEMENT_INVALID', field: 'locationPrecision', message: 'Ugyldig posisjonspresisjon.' });
        }
        set['entitlements.locationPrecision'] = ent.locationPrecision;
      }
      for (const key of ['hasBadge', 'hasAnalytics']) {
        if (ent[key] !== undefined) set[`entitlements.${key}`] = ent[key] === true;
      }
    }
    if (body.featuresText !== undefined) {
      if (!Array.isArray(body.featuresText) || body.featuresText.length > 20 || body.featuresText.some((t) => typeof t !== 'string' || t.length > 200)) {
        return res.status(400).json({ code: 'PLAN_FEATURES_INVALID', message: 'Ugyldig funksjonsliste.' });
      }
      set.featuresText = body.featuresText.map((t) => t.trim()).filter(Boolean);
    }
    if (!Object.keys(set).length) {
      return res.status(400).json({ code: 'PLAN_NO_CHANGES', message: 'Ingen endringer å lagre.' });
    }

    const updated = await SubscriptionPlan.findByIdAndUpdate(plan._id, { $set: set }, { new: true, runValidators: true }).lean();
    const changes = {};
    for (const [path, to] of Object.entries(set)) {
      const from = path.split('.').reduce((v, k) => v?.[k], plan);
      if (JSON.stringify(from) !== JSON.stringify(to)) changes[path] = { from: from ?? null, to };
    }
    await logActivity({
      adminId: req.user._id,
      action: 'settings_updated',
      targetModel: 'SubscriptionPlan',
      targetId: plan._id,
      description: `Plan-rettigheter oppdatert: ${plan.name} (${plan.type})`,
      metadata: { changes },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return res.json(updated);
  } catch (err) {
    console.error('[plans] entitlement update failed:', err);
    return res.status(500).json({ code: 'PLAN_UPDATE_FAILED', message: 'Kunne ikke lagre planen.' });
  }
};

const extraContacts = require('../services/subscriptions/v2ExtraContacts');

function sendExtraContactError(res, err, fallbackCode) {
  if (err instanceof extraContacts.ExtraContactError || err instanceof entitlements.V2EntitlementError) {
    return res.status(err.status).json({ code: err.code, message: err.message, ...(err.details || {}) });
  }
  console.error('[extra-contact] request failed:', err);
  return res.status(503).json({ code: fallbackCode, message: 'Ekstra kontakt er ikke tilgjengelig nå. Prøv igjen.' });
}

/** POST /api/stripe/create-extra-contact-payment { serviceId } */
exports.createExtraContactPayment = async (req, res) => {
  try {
    return res.json(await extraContacts.createExtraContactCheckout({ userId: req.user?._id, serviceId: req.body?.serviceId }));
  } catch (err) {
    return sendExtraContactError(res, err, 'EXTRA_CONTACT_CHECKOUT_UNAVAILABLE');
  }
};

/** GET /api/stripe/extra-contact-status/:sessionId */
exports.extraContactPaymentStatus = async (req, res) => {
  try {
    return res.json(await extraContacts.getExtraContactStatus({ userId: req.user?._id, sessionId: req.params.sessionId }));
  } catch (err) {
    return sendExtraContactError(res, err, 'EXTRA_CONTACT_STATUS_UNAVAILABLE');
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
  if (!userId) {
    return v2DisabledResponse(
      res,
      'AUTHENTICATION_REQUIRED',
      'Authentication required.'
    );
  }

  if (!managementEnabled() || !entitlementsEnabled()) {
    try {
      const hasV2Subscription = await SubscriptionV2.exists({ userId });
      if (!hasV2Subscription) {
        const code = !managementEnabled()
          ? 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'
          : 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED';
        return v2DisabledResponse(
          res,
          code,
          code === 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'
            ? 'Subscription management is not currently available.'
            : 'Subscription entitlements are not currently available.'
        );
      }
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
