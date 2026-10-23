const mongoose = require('mongoose');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionUsagePeriod = require('../../models/SubscriptionUsagePeriod');
const User = require('../../models/User');
const GlobalConfig = require('../../models/GlobalConfig');
const { getStripeForMode } = require('../../config/stripe');

class V2EntitlementError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'V2EntitlementError';
    this.status = status;
    this.code = code;
  }
}

function fail(status, code, message) {
  return new V2EntitlementError(status, code, message);
}

function idOf(value) {
  return typeof value === 'string' ? value : value?.id;
}

function enabled(env = process.env) {
  return env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED === 'true';
}

function freeCalendarPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

function stripePeriod(subscription) {
  const items = subscription?.items?.data || [];
  if (items.length !== 1) return null;
  const item = items[0];
  const start = Number.isSafeInteger(item.current_period_start)
    ? new Date(item.current_period_start * 1000)
    : null;
  const end = Number.isSafeInteger(item.current_period_end)
    ? new Date(item.current_period_end * 1000)
    : null;
  if (!start || !end || end <= start) return null;
  return { item, start, end };
}

function stripePriceMatches(price, plan, mode, item) {
  const priceId = mode === 'test' ? plan.stripePriceIdTest : plan.stripePriceId;
  const productId = mode === 'test' ? plan.stripeProductIdTest : plan.stripeProductId;
  return Boolean(
    price &&
      priceId &&
      idOf(item.price) === priceId &&
      price.active === true &&
      price.livemode === (mode === 'live') &&
      price.currency?.toLowerCase() === 'nok' &&
      price.type === 'recurring' &&
      price.recurring?.interval === 'month' &&
      price.recurring?.interval_count === 1 &&
      price.unit_amount === Math.round(plan.price * 100) &&
      (!productId || idOf(price.product) === productId)
  );
}

function invoiceConfirmsPeriod(invoice, record, period) {
  const subscriptionId = idOf(invoice?.parent?.subscription_details?.subscription);
  const expectedStart = period.start.getTime() / 1000;
  const expectedEnd = period.end.getTime() / 1000;
  return Boolean(
    invoice?.status === 'paid' &&
      invoice.livemode === (record.stripeMode === 'live') &&
      idOf(invoice.customer) === record.stripeCustomerId &&
      subscriptionId === record.stripeSubscriptionId &&
      invoice.lines?.data?.some((line) => {
        const priceId = idOf(line.price || line.pricing?.price_details?.price);
        return (
          line.period?.start === expectedStart &&
          line.period?.end === expectedEnd &&
          priceId === idOf(period.item.price)
        );
      })
  );
}

async function createUsagePeriod({
  userId,
  subscriptionId = null,
  plan,
  periodType,
  start,
  end,
  UsageModel,
}) {
  return UsageModel.findOneAndUpdate(
    { userId, billingPeriodStart: start },
    {
      $setOnInsert: {
        userId,
        subscriptionId,
        planId: plan?._id,
        periodType,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        includedContacts: plan?.entitlements?.freeContact || 0,
        consumedIncludedContacts: 0,
        purchasedExtraContacts: 0,
        consumedExtraContacts: 0,
        contactOperations: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

async function freeEntitlements(userId, accountType, now, deps, status = 'free') {
  if (accountType !== 'private') {
    return {
      status: status === 'free' ? 'no_paid_plan' : status,
      plan: null,
      planType: accountType,
      isPaid: false,
      includedContacts: 0,
      consumedIncludedContacts: 0,
      remainingIncludedContacts: 0,
      period: null,
      purchasedExtraContacts: 0,
      consumedExtraContacts: 0,
      entitlements: {},
    };
  }
  const plan = await deps.PlanModel.findOne({
    name: 'Standard',
    type: 'private',
    price: 0,
    isActive: { $ne: false },
  }).lean();
  if (!plan) throw fail(503, 'FREE_PLAN_UNAVAILABLE', 'The private Free plan could not be verified.');
  const period = freeCalendarPeriod(now);
  const usage = await createUsagePeriod({
    userId,
    plan,
    periodType: 'free',
    start: period.start,
    end: period.end,
    UsageModel: deps.UsageModel,
  });
  return snapshot(plan, usage, status, false, accountType);
}

function snapshot(plan, usage, status, isPaid, planType) {
  const consumed = usage?.consumedIncludedContacts || 0;
  const included = usage?.includedContacts || 0;
  return {
    status,
    plan: plan ? { id: String(plan._id), name: plan.name, price: plan.price } : null,
    planType,
    isPaid,
    includedContacts: included,
    consumedIncludedContacts: consumed,
    remainingIncludedContacts: Math.max(0, included - consumed),
    period: usage
      ? {
          start: usage.billingPeriodStart.toISOString(),
          end: usage.billingPeriodEnd.toISOString(),
          type: usage.periodType,
        }
      : null,
    purchasedExtraContacts: usage?.purchasedExtraContacts || 0,
    consumedExtraContacts: usage?.consumedExtraContacts || 0,
    entitlements: plan?.entitlements || {},
  };
}

async function resolveEntitlements(userId, overrides = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) {
    throw fail(401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
  }
  const deps = {
    UserModel: User,
    PlanModel: SubscriptionPlan,
    SubscriptionModel: SubscriptionV2,
    UsageModel: SubscriptionUsagePeriod,
    stripeForMode: getStripeForMode,
    now: () => new Date(),
    ...overrides,
  };
  const user = await deps.UserModel.findById(userId).select('role planType');
  if (!user) throw fail(404, 'USER_NOT_FOUND', 'The account could not be verified.');
  const accountType = user.role === 'company' || user.planType === 'business'
    ? 'business'
    : 'private';
  const now = deps.now();
  const record = await deps.SubscriptionModel.findOne({ userId }).lean();
  if (!record) return freeEntitlements(userId, accountType, now, deps);
  if (!['test', 'live'].includes(record.stripeMode) || !record.stripeSubscriptionId) {
    throw fail(503, 'SUBSCRIPTION_STATUS_UNAVAILABLE', 'The subscription could not be verified.');
  }

  let stripe;
  let subscription;
  try {
    stripe = await deps.stripeForMode(record.stripeMode === 'test');
    subscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId, {
      expand: ['items.data.price'],
    });
  } catch {
    throw fail(503, 'SUBSCRIPTION_STATUS_UNAVAILABLE', 'The subscription could not be verified.');
  }
  if (
    !subscription ||
    subscription.id !== record.stripeSubscriptionId ||
    subscription.livemode !== (record.stripeMode === 'live') ||
    idOf(subscription.customer) !== record.stripeCustomerId ||
    subscription.metadata?.subscriptionV2 !== 'true' ||
    String(subscription.metadata?.userId) !== String(userId) ||
    subscription.metadata?.stripeMode !== record.stripeMode
  ) {
    throw fail(503, 'SUBSCRIPTION_OWNERSHIP_UNVERIFIED', 'The subscription could not be verified.');
  }

  if (
    record.paymentRecoveryStatus === 'retrying' &&
    record.gracePeriodEndsAt instanceof Date &&
    now >= record.gracePeriodEndsAt
  ) {
    return freeEntitlements(userId, accountType, now, deps, 'free');
  }

  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    return freeEntitlements(userId, accountType, now, deps, 'free');
  }
  if (!['active', 'past_due', 'unpaid'].includes(subscription.status)) {
    return freeEntitlements(userId, accountType, now, deps, 'no_paid_entitlement');
  }
  const period = stripePeriod(subscription);
  if (!period) throw fail(503, 'SUBSCRIPTION_PERIOD_UNAVAILABLE', 'The billing period could not be verified.');
  const inRecovery = record.paymentRecoveryStatus === 'retrying' &&
    record.gracePeriodEndsAt instanceof Date &&
    now < record.gracePeriodEndsAt;
  const cancellationEnd = subscription.cancel_at_period_end && Number.isSafeInteger(subscription.cancel_at)
    ? new Date(subscription.cancel_at * 1000)
    : period.end;
  if (now >= cancellationEnd && !inRecovery) {
    return freeEntitlements(userId, accountType, now, deps, 'free');
  }
  const plan = await deps.PlanModel.findById(record.planId).lean();
  if (!plan || plan.type !== record.planType || accountType !== record.planType) {
    throw fail(503, 'SUBSCRIPTION_PLAN_UNVERIFIED', 'The subscription plan could not be verified.');
  }
  let price = period.item.price;
  if (typeof price === 'string') {
    try {
      price = await stripe.prices.retrieve(price);
    } catch {
      throw fail(503, 'SUBSCRIPTION_PRICE_UNAVAILABLE', 'The subscription price could not be verified.');
    }
  }
  if (!stripePriceMatches(price, plan, record.stripeMode, period.item)) {
    throw fail(503, 'SUBSCRIPTION_PRICE_UNVERIFIED', 'The subscription price could not be verified.');
  }

  let usage = inRecovery
    ? await deps.UsageModel.findOne({
        userId,
        subscriptionId: record._id,
        periodType: 'paid',
        billingPeriodStart: record.recoveryUsagePeriodStart,
      }).lean()
    : await deps.UsageModel.findOne({
        userId,
        subscriptionId: record._id,
        billingPeriodStart: { $lte: now },
        billingPeriodEnd: { $gt: now },
      }).lean();
  const activePaidPeriod =
    !inRecovery &&
    subscription.status === 'active' &&
    record.status !== 'past_due' &&
    period.start.getTime() === new Date(record.currentPeriodStart).getTime() &&
    period.end.getTime() === new Date(record.currentPeriodEnd).getTime();
  const renewalUnsettled = !usage && !inRecovery &&
    subscription.status === 'active' && record.status !== 'past_due';
  let latestInvoice = null;
  if (renewalUnsettled) {
    const invoice = subscription.latest_invoice;
    latestInvoice = invoice;
    if (typeof invoice === 'string' || !Array.isArray(latestInvoice?.lines?.data)) {
      const invoiceId = typeof invoice === 'string' ? invoice : latestInvoice?.id;
      if (invoiceId) {
        try {
          latestInvoice = await stripe.invoices.retrieve(invoiceId, {
            expand: ['lines.data'],
          });
        } catch {
          latestInvoice = null;
        }
      }
    }
  }
  if (!usage && activePaidPeriod) {
    if (invoiceConfirmsPeriod(latestInvoice, record, period)) {
      usage = await createUsagePeriod({
        userId,
        subscriptionId: record._id,
        plan,
        periodType: 'paid',
        start: period.start,
        end: period.end,
        UsageModel: deps.UsageModel,
      });
    }
  }
  if (
    !usage &&
    renewalUnsettled &&
    ['draft', 'open'].includes(latestInvoice?.status) &&
    idOf(latestInvoice.parent?.subscription_details?.subscription) === record.stripeSubscriptionId
  ) {
    // Stripe rolls the period over and charges the renewal invoice about an hour later.
    // In between there is no paid usage for the new period, and this used to answer
    // 503 SUBSCRIPTION_USAGE_UNAVAILABLE — blocking applications every renewal. Keep
    // the previous paid period's REMAINING allowance until the invoice settles: paid ->
    // invoice.paid creates the new period; failed -> grace anchors to this same period.
    // Nothing new is granted here.
    usage = await deps.UsageModel.findOne({
      userId,
      subscriptionId: record._id,
      periodType: 'paid',
      billingPeriodEnd: period.start,
    }).lean();
  }
  if (!usage) {
    if (subscription.status === 'active' && record.status !== 'past_due') {
      throw fail(503, 'SUBSCRIPTION_USAGE_UNAVAILABLE', 'The paid usage period could not be verified.');
    }
    return freeEntitlements(userId, accountType, now, deps, 'past_due');
  }
  return snapshot(
    plan,
    usage,
    inRecovery ? 'past_due' : subscription.cancel_at_period_end ? 'canceling' : subscription.status,
    true,
    accountType
  );
}

async function ensurePaidUsagePeriod({ userId, subscriptionId, plan, start, end }, UsageModel = SubscriptionUsagePeriod) {
  const usage = await createUsagePeriod({
    userId,
    subscriptionId,
    plan,
    periodType: 'paid',
    start,
    end,
    UsageModel,
  });
  if (usage.periodType === 'free') {
    const result = await UsageModel.updateOne(
      { _id: usage._id, periodType: 'free' },
      {
        $set: {
          subscriptionId,
          planId: plan._id,
          periodType: 'paid',
          billingPeriodStart: start,
          billingPeriodEnd: end,
          includedContacts: plan.entitlements?.freeContact || 0,
        },
      }
    );
    if (result.matchedCount === 0) {
      throw new Error('subscription_usage_period_conversion_unconfirmed');
    }
  }
  return usage;
}

async function setPaidPeriodAllowance({ userId, subscriptionId, plan, start, end }, UsageModel = SubscriptionUsagePeriod) {
  const usage = await ensurePaidUsagePeriod({
    userId,
    subscriptionId,
    plan,
    start,
    end,
  }, UsageModel);
  const result = await UsageModel.updateOne(
    { _id: usage._id },
    { $set: { planId: plan._id, includedContacts: plan.entitlements?.freeContact || 0 } }
  );
  if (result.matchedCount === 0) {
    throw new Error('subscription_usage_period_update_unconfirmed');
  }
}

function contactQuotaError(entitlements) {
  return entitlements.status === 'no_paid_plan' || entitlements.status === 'no_paid_entitlement'
    ? fail(403, 'PAID_SUBSCRIPTION_REQUIRED', 'A paid subscription is required for this contact.')
    : fail(403, 'CONTACT_LIMIT_REACHED', 'No included contacts remain for this billing period.');
}

async function consumeApplicationContact(
  { userId, jobRequestId, servicePrice, serviceId },
  overrides = {}
) {
  if (!mongoose.Types.ObjectId.isValid(String(jobRequestId || ''))) {
    throw fail(400, 'JOB_REQUEST_REQUIRED', 'A valid job application is required.');
  }
  const deps = {
    SubscriptionModel: SubscriptionV2,
    UsageModel: SubscriptionUsagePeriod,
    GlobalConfigModel: GlobalConfig,
    ...overrides,
  };
  if (!enabled(overrides.env || process.env)) {
    let v2Subscription;
    try {
      v2Subscription = await deps.SubscriptionModel.findOne({ userId }).lean();
    } catch (error) {
      console.error('[Subscription V2] applicant subscription lookup failed:', error);
      throw fail(
        503,
        'SUBSCRIPTION_STATUS_UNAVAILABLE',
        'The subscription could not be verified.'
      );
    }
    if (!v2Subscription) return { enabled: false, newlyConsumed: false };
  }
  const entitlements = await resolveEntitlements(userId, deps);
  if (!entitlements.period) throw contactQuotaError(entitlements);

  const freeJobConfig = await deps.GlobalConfigModel.findOne({
    key: 'FREE_PRIVATE_JOBS_UNDER_10000',
  }).lean();
  if (
    entitlements.planType === 'private' &&
    freeJobConfig?.value === true &&
    Number.isFinite(servicePrice) &&
    servicePrice < 10000
  ) {
    return { enabled: true, newlyConsumed: false, exempt: true };
  }

  const operationId = `job-request:${jobRequestId}`;
  const usage = await deps.UsageModel.findOne({
    userId,
    billingPeriodStart: new Date(entitlements.period.start),
  });
  if (!usage) throw fail(503, 'SUBSCRIPTION_USAGE_UNAVAILABLE', 'The contact allowance could not be verified.');
  const repeated = usage.contactOperations?.find(
    (entry) => entry.operationId === operationId && entry.status === 'consumed'
  );
  if (repeated) return { enabled: true, newlyConsumed: false, usagePeriodId: usage._id, operationId };

  // A paid extra contact bought for this job is used first: the applicant paid for this
  // specific application, and taking an included contact instead would strand it.
  const extraContacts = require('./v2ExtraContacts');
  if (await extraContacts.consumePaidExtraContact(
    { userId, serviceId, jobRequestId, usagePeriodId: usage._id, operationId, now: (deps.now || (() => new Date()))() },
    { session: overrides.session, ...(overrides.ExtraContactModel && { Model: overrides.ExtraContactModel }), UsageModel: deps.UsageModel }
  )) {
    return { enabled: true, newlyConsumed: true, extra: true, usagePeriodId: usage._id, operationId };
  }

  const filter = {
    _id: usage._id,
    $expr: { $lt: ['$consumedIncludedContacts', '$includedContacts'] },
    contactOperations: { $not: { $elemMatch: { operationId } } },
  };
  const updated = await deps.UsageModel.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          consumedIncludedContacts: { $add: [{ $ifNull: ['$consumedIncludedContacts', 0] }, 1] },
          contactOperations: {
            $concatArrays: [
              { $ifNull: ['$contactOperations', []] },
              [{ operationId, status: 'consumed' }],
            ],
          },
        },
      },
    ],
    { new: true, ...(overrides.session && { session: overrides.session }) }
  );
  if (!updated) {
    const existingQuery = deps.UsageModel.findOne({ _id: usage._id });
    const existing = await (overrides.session
      ? existingQuery.session(overrides.session)
      : existingQuery);
    const operation = existing?.contactOperations?.find((entry) => entry.operationId === operationId);
    if (operation?.status === 'consumed') {
      return { enabled: true, newlyConsumed: false, usagePeriodId: usage._id, operationId };
    }
    if (operation?.status === 'released') {
      throw fail(409, 'APPLICATION_CONTACT_RELEASED', 'This application contact was already released.');
    }
    const quotaError = contactQuotaError(entitlements);
    if (quotaError.code === 'CONTACT_LIMIT_REACHED') {
      // Tell the client whether (and when) an extra contact can be bought for this job.
      // Informational only: a lookup failure must not change the quota error itself.
      try {
        quotaError.extraContact = await extraContacts.extraContactOffer(
          { userId, serviceId, entitlements: { ...entitlements, remainingIncludedContacts: 0 } },
          overrides.ExtraContactModel
        );
      } catch (offerError) {
        console.error('[extra-contact] offer lookup failed:', offerError.message);
      }
    }
    throw quotaError;
  }
  return { enabled: true, newlyConsumed: true, usagePeriodId: usage._id, operationId };
}

async function releaseContact({ newlyConsumed, usagePeriodId, operationId }, actionExists, overrides = {}) {
  if (!newlyConsumed) return;
  if (await actionExists()) return;
  const UsageModel = overrides.UsageModel || SubscriptionUsagePeriod;
  await UsageModel.updateOne(
    {
      _id: usagePeriodId,
      consumedIncludedContacts: { $gt: 0 },
      contactOperations: { $elemMatch: { operationId, status: 'consumed' } },
    },
    {
      $inc: { consumedIncludedContacts: -1 },
      $set: { 'contactOperations.$.status': 'released' },
    }
  );
}

module.exports = {
  V2EntitlementError,
  enabled,
  freeCalendarPeriod,
  resolveEntitlements,
  ensurePaidUsagePeriod,
  setPaidPeriodAllowance,
  consumeApplicationContact,
  releaseContact,
};
