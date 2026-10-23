const crypto = require('crypto');
const mongoose = require('mongoose');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const User = require('../../models/User');
const { getStripeConfiguration, getStripeForMode } = require('../../config/stripe');

const BILLABLE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
]);

class SubscriptionV2Error extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'SubscriptionV2Error';
    this.status = status;
    this.code = code;
  }
}

function checkoutEnabled(env = process.env) {
  return env.SUBSCRIPTION_V2_CHECKOUT_ENABLED === 'true';
}

function error(status, code, message) {
  return new SubscriptionV2Error(status, code, message);
}

function isResourceMissing(err) {
  return err?.code === 'resource_missing';
}

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id;
}

function accountPlanType(user) {
  if (user?.role === 'company') return 'business';
  return user?.planType === 'business' ? 'business' : 'private';
}

function returnUrls(env = process.env) {
  const configured = env.FRONTEND_URL?.trim();
  if (!configured) {
    throw error(503, 'SUBSCRIPTION_RETURN_URL_UNAVAILABLE', 'Checkout is not configured.');
  }

  let base;
  try {
    base = new URL(configured);
  } catch {
    throw error(503, 'SUBSCRIPTION_RETURN_URL_INVALID', 'Checkout is not configured.');
  }

  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (env.NODE_ENV === 'production' && base.protocol !== 'https:')
  ) {
    throw error(503, 'SUBSCRIPTION_RETURN_URL_INVALID', 'Checkout is not configured.');
  }

  const origin = base.origin;
  return {
    successUrl: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/membership?checkout=cancelled`,
  };
}

async function verifyStripeSubscription(stripe, stripeSubscriptionId) {
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  } catch (err) {
    if (isResourceMissing(err)) return null;
    throw err;
  }

  if (subscription && BILLABLE_STATUSES.has(subscription.status)) return subscription;
  return null;
}

async function assertNoExistingSubscription(user, mode, deps) {
  const { SubscriptionV2Model, stripeForMode } = deps;

  let currentV2;
  try {
    currentV2 = await SubscriptionV2Model.findOne({ userId: user._id }).lean();
  } catch (err) {
    throw error(503, 'SUBSCRIPTION_STATUS_UNAVAILABLE', 'Could not verify subscription status.');
  }

  if (currentV2) {
    const stripeMode = currentV2.stripeMode;
    if (!['test', 'live'].includes(stripeMode) || !currentV2.stripeSubscriptionId) {
      throw error(503, 'SUBSCRIPTION_STATUS_UNAVAILABLE', 'Could not verify subscription status.');
    }
    let stripe;
    try {
      stripe = await stripeForMode(stripeMode === 'test');
      if (await verifyStripeSubscription(stripe, currentV2.stripeSubscriptionId)) {
        throw error(
          409,
          'active_subscription_exists',
          'An active subscription already exists for this account.'
        );
      }
    } catch (err) {
      if (err instanceof SubscriptionV2Error) throw err;
      throw error(503, 'SUBSCRIPTION_STATUS_UNAVAILABLE', 'Could not verify subscription status.');
    }
  }

  const pendingOperation = await deps.OperationModel.findOne({
    userId: user._id,
    operationType: 'checkout',
    status: 'pending',
  });
  if (pendingOperation) {
    if (pendingOperation.stripeMode !== mode) {
      throw error(
        409,
        'SUBSCRIPTION_CHECKOUT_IN_PROGRESS',
        'A checkout is already being processed for this account.'
      );
    }
    return pendingOperation;
  }

  return null;
}

async function getExistingCheckout(operation, stripe, OperationModel) {
  if (!operation.stripeCheckoutSessionId) return null;
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(operation.stripeCheckoutSessionId);
  } catch (err) {
    if (!isResourceMissing(err)) {
      throw error(503, 'SUBSCRIPTION_CHECKOUT_STATUS_UNAVAILABLE', 'Could not resume checkout.');
    }
  }

  if (session?.status === 'open' && session.url) return { url: session.url };
  if (session?.status === 'complete') {
    throw error(
      409,
      'SUBSCRIPTION_PAYMENT_PENDING',
      'Payment confirmation is still being processed.'
    );
  }
  if (session?.status === 'expired' || !session) {
    await OperationModel.updateOne(
      { _id: operation._id, status: 'pending' },
      { $set: { status: 'failed', failedAt: new Date(), lastErrorCode: 'checkout_expired' } }
    );
    return null;
  }

  throw error(409, 'SUBSCRIPTION_CHECKOUT_IN_PROGRESS', 'A checkout is already being processed.');
}

async function createSubscriptionCheckoutSession({ user, planId, couponCode }, overrides = {}) {
  if (!user?._id) throw error(401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
  if (couponCode) {
    throw error(
      400,
      'SUBSCRIPTION_PROMOTION_NOT_SUPPORTED',
      'Promotional codes are not available for this subscription checkout.'
    );
  }
  if (!mongoose.Types.ObjectId.isValid(String(planId || ''))) {
    throw error(400, 'INVALID_PLAN_ID', 'Choose a valid subscription plan.');
  }

  const deps = {
    PlanModel: SubscriptionPlan,
    SubscriptionV2Model: SubscriptionV2,
    OperationModel: SubscriptionBillingOperationV2,
    UserModel: User,
    getConfiguration: getStripeConfiguration,
    stripeForMode: getStripeForMode,
    env: process.env,
    ...overrides,
  };
  const plan = await deps.PlanModel.findById(planId).lean();
  if (!plan) throw error(404, 'PLAN_NOT_FOUND', 'The selected plan was not found.');
  if (plan.isActive === false) throw error(409, 'plan_inactive', 'This plan is not available.');
  if (!['business', 'private'].includes(plan.type) || accountPlanType(user) !== plan.type) {
    throw error(403, 'plan_type_not_allowed', 'This plan is not available for your account type.');
  }
  if (!Number.isFinite(plan.price) || plan.price <= 0) {
    throw error(400, 'FREE_PLAN_CHECKOUT_NOT_ALLOWED', 'Free plans cannot be purchased through Stripe.');
  }

  const configuration = await deps.getConfiguration();
  if (
    !configuration.keyModeValid ||
    !configuration.secretKey ||
    !['test', 'live'].includes(configuration.mode) ||
    configuration.testMode !== (configuration.mode === 'test')
  ) {
    throw error(503, 'STRIPE_CONFIGURATION_UNAVAILABLE', 'Subscription payments are not configured.');
  }
  const mode = configuration.mode;
  const testMode = configuration.testMode;
  const priceId = testMode ? plan.stripePriceIdTest : plan.stripePriceId;
  const productId = testMode ? plan.stripeProductIdTest : plan.stripeProductId;
  if (!priceId) {
    throw error(503, 'SUBSCRIPTION_PRICE_UNCONFIGURED', 'This plan is not configured for checkout.');
  }

  let stripe;
  try {
    stripe = await deps.stripeForMode(testMode);
  } catch {
    throw error(503, 'STRIPE_CONFIGURATION_UNAVAILABLE', 'Subscription payments are not configured.');
  }

  let price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch {
    throw error(503, 'SUBSCRIPTION_PRICE_INVALID', 'The selected plan price could not be verified.');
  }
  if (
    !price ||
    price.active !== true ||
    price.livemode !== !testMode ||
    price.currency?.toLowerCase() !== 'nok' ||
    price.type !== 'recurring' ||
    price.recurring?.interval !== 'month' ||
    price.recurring?.interval_count !== 1 ||
    price.unit_amount !== Math.round(plan.price * 100) ||
    (productId && stripeId(price.product) !== productId)
  ) {
    throw error(503, 'SUBSCRIPTION_PRICE_INVALID', 'The selected plan price could not be verified.');
  }

  let operation = await assertNoExistingSubscription(user, mode, deps);
  if (operation) {
    if (
      String(operation.targetPlanId) !== String(plan._id) ||
      operation.stripePriceId !== priceId
    ) {
      throw error(
        409,
        'SUBSCRIPTION_CHECKOUT_IN_PROGRESS',
        'A checkout for another plan or price is already being processed.'
      );
    }
    const existingSession = await getExistingCheckout(operation, stripe, deps.OperationModel);
    if (existingSession) return existingSession;
    const refreshed = await deps.OperationModel.findById(operation._id);
    if (refreshed?.status === 'failed') operation = null;
  }

  if (!operation) {
    try {
      operation = await deps.OperationModel.create({
        operationId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        stripeMode: mode,
        operationType: 'checkout',
        status: 'pending',
        userId: user._id,
        targetPlanId: plan._id,
        stripePriceId: priceId,
        attempts: 0,
      });
    } catch (err) {
      if (err.code !== 11000) {
        throw error(503, 'SUBSCRIPTION_OPERATION_UNAVAILABLE', 'Could not prepare checkout.');
      }
      operation = await deps.OperationModel.findOne({
        userId: user._id,
        operationType: 'checkout',
        status: 'pending',
      });
      if (
        !operation ||
        String(operation.targetPlanId) !== String(plan._id) ||
        operation.stripePriceId !== priceId
      ) {
        throw error(
          409,
          'SUBSCRIPTION_CHECKOUT_IN_PROGRESS',
          'A checkout is already being processed for this account.'
        );
      }
      const existingSession = await getExistingCheckout(operation, stripe, deps.OperationModel);
      if (existingSession) return existingSession;
    }
  }

  const now = new Date();
  const leaseBefore = new Date(now.getTime() - 5 * 60 * 1000);
  const lease = await deps.OperationModel.findOneAndUpdate(
    {
      _id: operation._id,
      status: 'pending',
      $or: [{ attemptedAt: { $exists: false } }, { attemptedAt: { $lt: leaseBefore } }],
    },
    { $set: { attemptedAt: now }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!lease) {
    throw error(
      409,
      'SUBSCRIPTION_CHECKOUT_IN_PROGRESS',
      'A checkout is already being processed for this account.'
    );
  }

  const customerField = testMode ? 'stripeCustomerIdTest' : 'stripeCustomerId';
  let customerId = user[customerField];
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer || customer.deleted) {
        customerId = null;
      } else if (customer.metadata?.userId !== String(user._id)) {
        throw error(503, 'STRIPE_CUSTOMER_OWNERSHIP_UNVERIFIED', 'Could not verify the billing account.');
      }
    } catch (err) {
      if (isResourceMissing(err)) customerId = null;
      else throw error(503, 'STRIPE_CUSTOMER_UNAVAILABLE', 'Could not verify the billing account.');
    }
  }
  if (!customerId) {
    let customer;
    try {
      customer = await stripe.customers.create({
        email: user.email,
        name: [user.name, user.lastName].filter(Boolean).join(' '),
        metadata: { userId: String(user._id) },
      }, { idempotencyKey: `jobblo-subv2-customer-${mode}-${operation.operationId}` });
      await deps.UserModel.findByIdAndUpdate(user._id, { [customerField]: customer.id });
    } catch {
      throw error(503, 'STRIPE_CUSTOMER_UNAVAILABLE', 'Could not prepare the billing account.');
    }
    customerId = customer.id;
  }

  const metadata = {
    subscriptionV2: 'true',
    userId: String(user._id),
    planId: String(plan._id),
    operationId: operation.operationId,
    stripeMode: mode,
  };

  let urls;
  try {
    urls = returnUrls(deps.env);
  } catch (err) {
    await deps.OperationModel.updateOne(
      { _id: operation._id, status: 'pending' },
      {
        $set: { status: 'failed', failedAt: new Date(), lastErrorCode: err.code },
        $unset: { attemptedAt: 1 },
      }
    );
    throw err;
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: String(user._id),
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: urls.successUrl,
        cancel_url: urls.cancelUrl,
        metadata,
        subscription_data: { metadata },
      },
      { idempotencyKey: `jobblo-subv2-${mode}-${operation.idempotencyKey}` }
    );
  } catch (err) {
    await deps.OperationModel.updateOne(
      { _id: operation._id, status: 'pending' },
      {
        $set: {
          lastErrorCode: err.code || 'stripe_checkout_failed',
          lastErrorMessage: 'Stripe checkout session creation failed.',
        },
        $inc: { attempts: 1 },
      }
    );
    if (err.statusCode && err.statusCode < 500) {
      await deps.OperationModel.updateOne(
        { _id: operation._id, status: 'pending' },
        { $set: { status: 'failed', failedAt: new Date() } }
      );
    }
    throw error(503, 'STRIPE_CHECKOUT_UNAVAILABLE', 'Could not start checkout. Please retry.');
  }

  if (!session?.id || !session.url || session.mode !== 'subscription') {
    await deps.OperationModel.updateOne(
      { _id: operation._id, status: 'pending' },
      {
        $set: {
          status: 'reconciliation_required',
          lastErrorCode: 'invalid_checkout_response',
          lastErrorMessage: 'Stripe returned an invalid checkout response.',
        },
      }
    );
    throw error(503, 'STRIPE_CHECKOUT_UNAVAILABLE', 'Could not start checkout. Please contact support.');
  }

  await deps.OperationModel.updateOne(
    { _id: operation._id, status: 'pending' },
    {
      $set: {
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: customerId,
        attemptedAt: new Date(),
      },
    }
  );
  return { url: session.url };
}

async function getSubscriptionCheckoutStatus(userId, sessionId, overrides = {}) {
  if (!userId) throw error(401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
  if (typeof sessionId !== 'string' || !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
    throw error(404, 'CHECKOUT_SESSION_NOT_FOUND', 'The checkout session was not found.');
  }
  const deps = {
    PlanModel: SubscriptionPlan,
    SubscriptionV2Model: SubscriptionV2,
    OperationModel: SubscriptionBillingOperationV2,
    stripeForMode: getStripeForMode,
    ...overrides,
  };
  const operation = await deps.OperationModel.findOne({
    userId,
    operationType: 'checkout',
    stripeCheckoutSessionId: sessionId,
  }).lean();
  if (
    !operation ||
    !['test', 'live'].includes(operation.stripeMode) ||
    !operation.targetPlanId ||
    !operation.stripeCustomerId
  ) {
    throw error(404, 'CHECKOUT_SESSION_NOT_FOUND', 'The checkout session was not found.');
  }

  let session;
  try {
    const stripe = await deps.stripeForMode(operation.stripeMode === 'test');
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    throw error(503, 'SUBSCRIPTION_CHECKOUT_STATUS_UNAVAILABLE', 'Could not verify checkout status.');
  }
  const metadata = session?.metadata || {};
  if (
    !session ||
    session.id !== sessionId ||
    session.mode !== 'subscription' ||
    session.livemode !== (operation.stripeMode === 'live') ||
    stripeId(session.customer) !== operation.stripeCustomerId ||
    String(session.client_reference_id) !== String(userId) ||
    metadata.subscriptionV2 !== 'true' ||
    String(metadata.userId) !== String(userId) ||
    String(metadata.planId) !== String(operation.targetPlanId) ||
    metadata.operationId !== operation.operationId ||
    metadata.stripeMode !== operation.stripeMode
  ) {
    throw error(404, 'CHECKOUT_SESSION_NOT_FOUND', 'The checkout session was not found.');
  }

  const plan = await deps.PlanModel.findById(operation.targetPlanId).lean();
  if (!plan) throw error(503, 'SUBSCRIPTION_CHECKOUT_STATUS_UNAVAILABLE', 'Could not verify checkout status.');
  if (
    (session.currency && session.currency.toLowerCase() !== 'nok') ||
    (Number.isSafeInteger(session.amount_total) &&
      session.amount_total !== Math.round(plan.price * 100)) ||
    (session.status === 'complete' &&
      (!Number.isSafeInteger(session.amount_total) || !session.currency))
  ) {
    throw error(503, 'SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED', 'The checkout payment requires reconciliation.');
  }

  const stripeSubscriptionId = stripeId(session.subscription);
  const current = stripeSubscriptionId
    ? await deps.SubscriptionV2Model.findOne({ userId }).lean()
    : null;
  const provisioned = Boolean(
    current &&
      current.stripeMode === operation.stripeMode &&
      current.stripeSubscriptionId === stripeSubscriptionId &&
      current.stripeCustomerId === operation.stripeCustomerId
  );
  const paid = ['paid', 'no_payment_required'].includes(session.payment_status);
  const failed = session.status === 'expired' || operation.status === 'failed';
  return {
    payment_status: session.payment_status || 'unpaid',
    provisioning_status: provisioned ? 'complete' : 'pending',
    checkout_status: provisioned
      ? 'complete'
      : failed
        ? 'failed'
        : paid
          ? operation.status === 'reconciliation_required' ? 'reconciliation_required' : 'processing'
          : session.status === 'open' ? 'open' : 'pending',
    plan: plan.name,
    planType: plan.type,
    amount: Number.isSafeInteger(session.amount_total) ? session.amount_total / 100 : plan.price,
    currency: (session.currency || 'nok').toLowerCase(),
    discountAmount: Number.isSafeInteger(session.total_details?.amount_discount)
      ? session.total_details.amount_discount / 100
      : 0,
    coupon: null,
    subscription_status: provisioned ? current.status : null,
  };
}

module.exports = {
  BILLABLE_STATUSES,
  SubscriptionV2Error,
  assertNoExistingSubscription,
  checkoutEnabled,
  createSubscriptionCheckoutSession,
  getSubscriptionCheckoutStatus,
  returnUrls,
};
