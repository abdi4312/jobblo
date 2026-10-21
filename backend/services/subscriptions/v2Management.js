const crypto = require('crypto');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const { getStripeForMode } = require('../../config/stripe');

class SubscriptionManagementError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'SubscriptionManagementError';
    this.status = status;
    this.code = code;
  }
}

function fail(status, code, message) {
  return new SubscriptionManagementError(status, code, message);
}

function idOf(value) {
  return typeof value === 'string' ? value : value?.id;
}

function dateOf(timestamp) {
  return Number.isSafeInteger(timestamp) && timestamp > 0 ? new Date(timestamp * 1000) : null;
}

function periodOf(subscription) {
  const items = subscription?.items?.data || [];
  if (items.length !== 1) throw fail(409, 'SUBSCRIPTION_STATE_UNSUPPORTED', 'Subscription items require review.');
  const item = items[0];
  const start = dateOf(item.current_period_start);
  const end = dateOf(item.current_period_end);
  if (!start || !end || end <= start) {
    throw fail(409, 'SUBSCRIPTION_PERIOD_UNAVAILABLE', 'The billing period could not be verified.');
  }
  return { item, start, end };
}

function stripeModeMatches(subscription, mode) {
  return subscription?.livemode === (mode === 'live');
}

function stripePriceIsMonthlyNok(price, mode) {
  return Boolean(
    price &&
      price.active &&
      price.livemode === (mode === 'live') &&
      price.currency?.toLowerCase() === 'nok' &&
      price.type === 'recurring' &&
      price.recurring?.interval === 'month' &&
      price.recurring?.interval_count === 1 &&
      Number.isSafeInteger(price.unit_amount) &&
      price.unit_amount > 0
  );
}

function metadataFor(operation, record) {
  return {
    subscriptionV2: 'true',
    userId: String(record.userId),
    planId: String(operation.targetPlanId || record.planId),
    operationId: operation.operationId,
    stripeMode: operation.stripeMode,
  };
}

function activeSubscription(subscription) {
  if (subscription.status !== 'active') {
    throw fail(409, 'SUBSCRIPTION_NOT_ACTIVE', 'Only an active subscription can be changed.');
  }
  if (subscription.cancel_at_period_end) {
    throw fail(409, 'SUBSCRIPTION_CANCELING', 'Resume the subscription before changing plans.');
  }
}

function validateOwnership(record, subscription, userId) {
  if (
    String(record.userId) !== String(userId) ||
    subscription.metadata?.subscriptionV2 !== 'true' ||
    String(subscription.metadata?.userId) !== String(userId) ||
    subscription.metadata?.stripeMode !== record.stripeMode ||
    !stripeModeMatches(subscription, record.stripeMode) ||
    idOf(subscription.customer) !== record.stripeCustomerId ||
    subscription.id !== record.stripeSubscriptionId
  ) {
    throw fail(403, 'SUBSCRIPTION_OWNERSHIP_MISMATCH', 'The subscription could not be verified for this account.');
  }
}

async function getSubscriptionContext(userId, overrides = {}) {
  const deps = {
    SubscriptionModel: SubscriptionV2,
    PlanModel: SubscriptionPlan,
    OperationModel: SubscriptionBillingOperationV2,
    stripeForMode: getStripeForMode,
    ...overrides,
  };
  const record = await deps.SubscriptionModel.findOne({ userId }).lean();
  if (!record) throw fail(404, 'SUBSCRIPTION_NOT_FOUND', 'No V2 subscription was found.');
  if (!['test', 'live'].includes(record.stripeMode) || !record.stripeSubscriptionId) {
    throw fail(503, 'SUBSCRIPTION_STATUS_UNAVAILABLE', 'The subscription could not be verified.');
  }
  const stripe = await deps.stripeForMode(record.stripeMode === 'test');
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId, {
      expand: ['latest_invoice', 'items.data.price'],
    });
  } catch {
    throw fail(503, 'SUBSCRIPTION_STATUS_UNAVAILABLE', 'The subscription could not be verified.');
  }
  validateOwnership(record, subscription, userId);
  const period = periodOf(subscription);
  const price = typeof period.item.price === 'string'
    ? await stripe.prices.retrieve(period.item.price)
    : period.item.price;
  if (!stripePriceIsMonthlyNok(price, record.stripeMode)) {
    throw fail(409, 'SUBSCRIPTION_PRICE_INVALID', 'The current subscription price could not be verified.');
  }
  const currentPlan = await deps.PlanModel.findById(record.planId).lean();
  const expectedPriceId = currentPlan &&
    (record.stripeMode === 'test' ? currentPlan.stripePriceIdTest : currentPlan.stripePriceId);
  const expectedProductId = currentPlan &&
    (record.stripeMode === 'test' ? currentPlan.stripeProductIdTest : currentPlan.stripeProductId);
  if (
    !currentPlan ||
    currentPlan.type !== record.planType ||
    expectedPriceId !== idOf(period.item.price) ||
    price.unit_amount !== Math.round(currentPlan.price * 100) ||
    (expectedProductId && idOf(price.product) !== expectedProductId)
  ) {
    throw fail(409, 'SUBSCRIPTION_PLAN_MISMATCH', 'The current subscription plan could not be verified.');
  }
  return { ...deps, record, stripe, subscription, period, price };
}

function frontendSubscription(context, plan) {
  const { record, subscription, period } = context;
  const recoveryActive =
    record.paymentRecoveryStatus === 'retrying' &&
    record.gracePeriodEndsAt instanceof Date &&
    record.gracePeriodEndsAt > new Date();
  return {
    plan: plan?.name || '',
    planId: String(record.planId),
    planType: record.planType,
    status: record.status,
    autoRenew: !subscription.cancel_at_period_end,
    renewalDate: period.end.toISOString(),
    stripeSubscriptionId: record.stripeSubscriptionId,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEnd: period.end.toISOString(),
    stripeStatus: subscription.status,
    stripeMode: record.stripeMode,
    price: plan?.price ?? null,
    billingInterval: 'month',
    pendingPlan: record.pendingPlanChange
      ? {
          plan: record.pendingPlanChange.targetPlanName || '',
          effectiveAt: new Date(record.pendingPlanChange.effectiveAt).toISOString(),
        }
      : null,
    paymentRecovery: {
      active: recoveryActive,
      status: record.paymentRecoveryStatus || 'none',
      startedAt: record.firstPaymentFailureAt?.toISOString() || null,
      deadline: record.gracePeriodEndsAt?.toISOString() || null,
      remainingMilliseconds: recoveryActive
        ? Math.max(0, record.gracePeriodEndsAt.getTime() - Date.now())
        : 0,
      action: recoveryActive ? 'update_payment_method' : null,
    },
  };
}

async function getCurrentSubscription(userId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  const plan = await context.PlanModel.findById(context.record.planId).lean();
  const pendingPlan = context.record.pendingPlanChange
    ? await context.PlanModel.findById(context.record.pendingPlanChange.targetPlanId).lean()
    : null;
  return {
    subscription: {
      ...frontendSubscription(context, plan),
      pendingPlan: context.record.pendingPlanChange
        ? {
            plan: pendingPlan?.name || '',
            effectiveAt: new Date(context.record.pendingPlanChange.effectiveAt).toISOString(),
          }
        : null,
      cancellationDate: context.record.cancellationEffectiveAt?.toISOString() || null,
      timeline: (context.record.planHistory || []).map((entry) => ({
        plan: entry.planName,
        status: entry.changeType,
        startDate: entry.periodStart?.toISOString(),
        endDate: entry.periodEnd?.toISOString(),
      })),
    },
  };
}

async function createBillingPortalSession(userId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  const configuredUrl = (overrides.env || process.env).FRONTEND_URL?.trim();
  let returnUrl;
  try {
    const origin = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('invalid scheme');
    returnUrl = new URL('/settings/subscriptions', origin).toString();
  } catch {
    throw fail(503, 'BILLING_RETURN_URL_UNAVAILABLE', 'Billing settings are not configured.');
  }
  if (!context.stripe.billingPortal?.sessions?.create) {
    throw fail(503, 'BILLING_PORTAL_UNAVAILABLE', 'Payment method management is not available.');
  }
  const session = await context.stripe.billingPortal.sessions.create({
    customer: context.record.stripeCustomerId,
    return_url: returnUrl,
  });
  if (!session?.url) throw fail(503, 'BILLING_PORTAL_UNAVAILABLE', 'Payment method management is not available.');
  return { url: session.url };
}

async function getBillingHistory(userId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  const [customer, invoicePage] = await Promise.all([
    context.stripe.customers.retrieve(context.record.stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    }),
    context.stripe.invoices.list({
      customer: context.record.stripeCustomerId,
      limit: 100,
    }),
  ]);
  if (
    !customer ||
    customer.deleted ||
    customer.id !== context.record.stripeCustomerId ||
    String(customer.metadata?.userId) !== String(context.record.userId)
  ) {
    throw fail(503, 'SUBSCRIPTION_CUSTOMER_UNVERIFIED', 'The billing account could not be verified.');
  }
  const subscriptionIds = new Set([
    context.record.stripeSubscriptionId,
    ...(context.record.planHistory || []).map((entry) => entry.stripeSubscriptionId),
  ]);
  const currentPlan = await context.PlanModel.findById(context.record.planId).lean();
  const historicalPlan = (subscriptionId) =>
    (context.record.planHistory || []).find((entry) => entry.stripeSubscriptionId === subscriptionId)?.planName;
  const invoices = (invoicePage?.data || [])
    .filter((invoice) =>
      idOf(invoice.customer) === context.record.stripeCustomerId &&
      subscriptionIds.has(idOf(invoice.parent?.subscription_details?.subscription || invoice.subscription))
    )
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number || null,
      plan:
        historicalPlan(idOf(invoice.parent?.subscription_details?.subscription || invoice.subscription)) ||
        (idOf(invoice.parent?.subscription_details?.subscription || invoice.subscription) ===
        context.record.stripeSubscriptionId
          ? currentPlan?.name
          : '') ||
        '',
      createdAt: Number.isSafeInteger(invoice.created) ? new Date(invoice.created * 1000).toISOString() : null,
      amountPaid: (invoice.amount_paid || 0) / 100,
      amountDue: (invoice.amount_due || 0) / 100,
      currency: (invoice.currency || 'nok').toLowerCase(),
      status: invoice.status || null,
      mode: context.record.stripeMode,
      hasPdf: Boolean(invoice.invoice_pdf),
    }));
  const paymentMethod = customer.invoice_settings?.default_payment_method;
  return {
    payments: invoices.map((invoice) => ({
      id: invoice.id,
      plan: invoice.plan,
      amount: invoice.amountPaid,
      currency: invoice.currency,
      status: invoice.status || 'unknown',
      mode: invoice.mode,
      createdAt: invoice.createdAt || '',
    })),
    invoices,
    paymentMethod: paymentMethod && typeof paymentMethod !== 'string'
      ? {
          brand: paymentMethod.card?.brand || null,
          last4: paymentMethod.card?.last4 || null,
          expMonth: paymentMethod.card?.exp_month || null,
          expYear: paymentMethod.card?.exp_year || null,
        }
      : null,
    billingAddress: {
      name: customer.name || null,
      ...(customer.address || {}),
    },
  };
}

async function getInvoicePdf(userId, invoiceId, mode, overrides = {}) {
  if (!['test', 'live'].includes(mode) || typeof invoiceId !== 'string' || !/^in_[A-Za-z0-9_]+$/.test(invoiceId)) {
    throw fail(404, 'INVOICE_NOT_FOUND', 'The invoice was not found.');
  }
  const context = await getSubscriptionContext(userId, overrides);
  if (mode !== context.record.stripeMode) {
    throw fail(404, 'INVOICE_NOT_FOUND', 'The invoice was not found.');
  }
  const invoice = await context.stripe.invoices.retrieve(invoiceId);
  const subscriptionId = idOf(
    invoice?.parent?.subscription_details?.subscription || invoice?.subscription
  );
  const allowedSubscriptions = new Set([
    context.record.stripeSubscriptionId,
    ...(context.record.planHistory || []).map((entry) => entry.stripeSubscriptionId),
  ]);
  if (
    !invoice ||
    invoice.id !== invoiceId ||
    invoice.livemode !== (mode === 'live') ||
    idOf(invoice.customer) !== context.record.stripeCustomerId ||
    !allowedSubscriptions.has(subscriptionId) ||
    !invoice.invoice_pdf
  ) {
    throw fail(404, 'INVOICE_NOT_FOUND', 'The invoice was not found.');
  }
  return { url: invoice.invoice_pdf };
}

async function getTargetPlan(context, planId) {
  const plan = await context.PlanModel.findById(planId).lean();
  if (!plan) throw fail(404, 'PLAN_NOT_FOUND', 'The selected plan was not found.');
  if (plan.isActive === false) throw fail(409, 'plan_inactive', 'This plan is not available.');
  if (plan.type !== context.record.planType) {
    throw fail(403, 'plan_type_not_allowed', 'This plan is not available for your account type.');
  }
  if (!Number.isFinite(plan.price) || plan.price <= 0) {
    throw fail(400, 'FREE_PLAN_CHANGE_NOT_ALLOWED', 'Free plans cannot be selected as a paid plan change.');
  }
  const priceId = context.record.stripeMode === 'test' ? plan.stripePriceIdTest : plan.stripePriceId;
  if (!priceId) throw fail(503, 'SUBSCRIPTION_PRICE_UNCONFIGURED', 'This plan is not configured for this Stripe mode.');
  let price;
  try {
    price = await context.stripe.prices.retrieve(priceId);
  } catch {
    throw fail(503, 'SUBSCRIPTION_PRICE_INVALID', 'The selected plan price could not be verified.');
  }
  if (
    !stripePriceIsMonthlyNok(price, context.record.stripeMode) ||
    price.unit_amount !== Math.round(plan.price * 100) ||
    (context.record.stripeMode === 'test'
      ? plan.stripeProductIdTest && idOf(price.product) !== plan.stripeProductIdTest
      : plan.stripeProductId && idOf(price.product) !== plan.stripeProductId)
  ) {
    throw fail(503, 'SUBSCRIPTION_PRICE_INVALID', 'The selected plan price could not be verified.');
  }
  return { plan, price, priceId };
}

function classifyPlanChange(context, target) {
  if (String(context.record.planId) === String(target.plan._id)) return 'no_change';
  if (target.price.unit_amount === context.price.unit_amount) {
    throw fail(409, 'PLAN_PRICE_EQUAL', 'Plans with equal prices require a separate change policy.');
  }
  return target.price.unit_amount > context.price.unit_amount ? 'immediate' : 'period_end';
}

async function previewPlanChange(userId, planId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  activeSubscription(context.subscription);
  const target = await getTargetPlan(context, planId);
  const strategy = classifyPlanChange(context, target);
  if (strategy === 'no_change') {
    const plan = await context.PlanModel.findById(context.record.planId).lean();
    return {
      strategy,
      amountDueNow: 0,
      currency: 'nok',
      currentPlan: plan?.name,
      targetPlan: target.plan.name,
    };
  }
  if (context.record.pendingPlanChange && strategy === 'immediate') {
    throw fail(409, 'SUBSCRIPTION_PLAN_CHANGE_PENDING', 'Resolve the scheduled plan change before upgrading.');
  }
  let amountDueNow = 0;
  let effectiveAt;
  if (strategy === 'immediate') {
    const prorationDate = Math.floor(Date.now() / 1000);
    const invoice = await context.stripe.invoices.createPreview({
      subscription: context.record.stripeSubscriptionId,
      subscription_details: {
        items: [{ id: context.period.item.id, price: target.priceId, quantity: context.period.item.quantity || 1 }],
        proration_behavior: 'always_invoice',
        billing_cycle_anchor: 'unchanged',
        proration_date: prorationDate,
      },
    });
    amountDueNow = Math.max(0, invoice.amount_due || 0);
  } else {
    effectiveAt = context.period.end.toISOString();
  }
  const currentPlan = await context.PlanModel.findById(context.record.planId).lean();
  return {
    strategy,
    ...(effectiveAt ? { effectiveAt } : {}),
    amountDueNow,
    currency: context.price.currency,
    currentPlan: currentPlan?.name,
    targetPlan: target.plan.name,
  };
}

async function acquireOperation(context, operationType, targetPlanId = null) {
  const { record, OperationModel } = context;
  const existing = await OperationModel.findOne({
    userId: record.userId,
    lifecycleLock: true,
  });
  if (existing) {
    if (
      existing.operationType !== operationType ||
      String(existing.targetPlanId || '') !== String(targetPlanId || '') ||
      String(existing.stripeSubscriptionId) !== record.stripeSubscriptionId
    ) {
      throw fail(409, 'SUBSCRIPTION_OPERATION_IN_PROGRESS', 'Another subscription change is being processed.');
    }
    if (existing.status === 'reconciliation_required') {
      throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The previous subscription change needs reconciliation.');
    }
    return existing;
  }
  const operationId = crypto.randomUUID();
  try {
    return await OperationModel.create({
      operationId,
      idempotencyKey: operationId,
      stripeMode: record.stripeMode,
      operationType,
      status: 'pending',
      userId: record.userId,
      subscriptionId: record._id,
      targetPlanId,
      stripeSubscriptionId: record.stripeSubscriptionId,
      stripeCustomerId: record.stripeCustomerId,
      lifecycleLock: true,
      prorationDate: operationType === 'upgrade' ? new Date() : undefined,
      attempts: 0,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const raced = await OperationModel.findOne({
      userId: record.userId,
      lifecycleLock: true,
    });
    if (!raced) throw fail(503, 'SUBSCRIPTION_OPERATION_UNAVAILABLE', 'Could not prepare the subscription change.');
    if (
      raced.operationType !== operationType ||
      String(raced.targetPlanId || '') !== String(targetPlanId || '') ||
      String(raced.stripeSubscriptionId) !== record.stripeSubscriptionId
    ) {
      throw fail(409, 'SUBSCRIPTION_OPERATION_IN_PROGRESS', 'Another subscription change is being processed.');
    }
    if (raced.status === 'reconciliation_required') {
      throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The previous subscription change needs reconciliation.');
    }
    return raced;
  }
}

async function completeOperation(context, operation, updates = {}) {
  await context.OperationModel.updateOne(
    { _id: operation._id },
    {
      $set: { ...updates, status: 'succeeded', completedAt: new Date() },
      $unset: { lifecycleLock: 1 },
    }
  );
}

async function completeOutstandingOperation(context, operationType) {
  const operation = await context.OperationModel.findOne({
    userId: context.record.userId,
    stripeSubscriptionId: context.record.stripeSubscriptionId,
    operationType,
    status: { $in: ['pending', 'reconciliation_required'] },
    lifecycleLock: true,
  });
  if (operation) {
    await completeOperation(context, operation, {
      stripeSubscriptionId: context.record.stripeSubscriptionId,
    });
  }
}

function errorAuditFields(err, stage) {
  return {
    lastErrorCode: err?.code || 'stripe_outcome_unknown',
    lastErrorType: err?.rawType || err?.type || null,
    lastErrorHttpStatus: Number.isInteger(err?.statusCode) ? err.statusCode : null,
    stripeRequestId: typeof err?.requestId === 'string' ? err.requestId : null,
    lastFailureStage: stage || null,
  };
}

async function markReconciliation(context, operation, err, stage) {
  await context.OperationModel.updateOne(
    { _id: operation._id },
    {
      $set: {
        status: 'reconciliation_required',
        ...errorAuditFields(err, stage),
        lastErrorMessage: 'Stripe outcome requires canonical-state reconciliation.',
      },
    }
  );
}

async function markScheduleCreationFailed(context, operation, err) {
  const result = await context.OperationModel.updateOne(
    { _id: operation._id, status: 'pending', lifecycleLock: true },
    {
      $set: {
        status: 'failed',
        failedAt: new Date(),
        ...errorAuditFields(err, 'schedule_create'),
        lastErrorCode: err.code || 'stripe_request_rejected',
        lastErrorMessage: 'Stripe rejected schedule creation before execution.',
      },
      $unset: { lifecycleLock: 1 },
    }
  );
  if (result.matchedCount === 0) {
    throw new Error('schedule_creation_failure_not_recorded');
  }
}

function isStripeValidationError(err) {
  return err?.type === 'StripeInvalidRequestError' &&
    err?.rawType === 'invalid_request_error' &&
    err?.statusCode === 400;
}

async function cancelSubscription(userId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  if (context.subscription.status !== 'active') {
    throw fail(409, 'SUBSCRIPTION_NOT_ACTIVE', 'Only an active subscription can be canceled.');
  }
  if (context.subscription.cancel_at_period_end) {
    const end = context.period.end;
    if (dateOf(context.subscription.cancel_at) && dateOf(context.subscription.cancel_at).getTime() !== end.getTime()) {
      throw fail(409, 'SUBSCRIPTION_CANCELLATION_DATE_MISMATCH', 'The cancellation date requires review.');
    }
    await context.SubscriptionModel.updateOne(
      { _id: context.record._id },
      { $set: { status: 'canceling', autoRenew: false, cancellationEffectiveAt: end } }
    );
    await completeOutstandingOperation(context, 'cancel');
    return { message: 'Abonnementet avsluttes ved periodens slutt', effectiveAt: end.toISOString() };
  }
  if (context.record.pendingPlanChange || context.subscription.schedule) {
    throw fail(409, 'SUBSCRIPTION_PLAN_CHANGE_PENDING', 'Resolve the scheduled plan change before canceling.');
  }
  const operation = await acquireOperation(context, 'cancel');
  try {
    const updated = await context.stripe.subscriptions.update(
      context.record.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
        proration_behavior: 'none',
        metadata: metadataFor(operation, context.record),
      },
      { idempotencyKey: `jobblo-subv2-${context.record.stripeMode}-${operation.idempotencyKey}` }
    );
    validateOwnership(context.record, updated, userId);
    if (!updated.cancel_at_period_end) throw new Error('stripe_cancel_not_confirmed');
    const end = context.period.end;
    if (dateOf(updated.cancel_at) && dateOf(updated.cancel_at).getTime() !== end.getTime()) {
      throw new Error('stripe_cancel_period_mismatch');
    }
    await context.SubscriptionModel.updateOne(
      { _id: context.record._id },
      { $set: { status: 'canceling', autoRenew: false, cancellationEffectiveAt: end } }
    );
    await completeOperation(context, operation, { stripeSubscriptionId: updated.id });
    return { message: 'Abonnementet avsluttes ved periodens slutt', effectiveAt: end.toISOString() };
  } catch (err) {
    await markReconciliation(context, operation, err);
    if (err instanceof SubscriptionManagementError) throw err;
    throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The cancellation result is being verified.');
  }
}

async function resumeSubscription(userId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  if (
    context.subscription.status !== 'active' ||
    context.period.end <= new Date()
  ) {
    throw fail(409, 'SUBSCRIPTION_NOT_RESUMABLE', 'This subscription can no longer be resumed.');
  }
  if (context.subscription.schedule || context.record.pendingPlanChange) {
    throw fail(409, 'SUBSCRIPTION_PLAN_CHANGE_PENDING', 'Resolve the scheduled plan change before resuming.');
  }
  if (!context.subscription.cancel_at_period_end) {
    await completeOutstandingOperation(context, 'resume');
    return { message: 'Abonnementet fortsetter', effectiveAt: context.period.end.toISOString() };
  }
  const operation = await acquireOperation(context, 'resume');
  try {
    const updated = await context.stripe.subscriptions.update(
      context.record.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
        metadata: metadataFor(operation, context.record),
      },
      { idempotencyKey: `jobblo-subv2-${context.record.stripeMode}-${operation.idempotencyKey}` }
    );
    validateOwnership(context.record, updated, userId);
    if (updated.cancel_at_period_end || updated.status !== 'active') {
      throw new Error('stripe_resume_not_confirmed');
    }
    await context.SubscriptionModel.updateOne(
      { _id: context.record._id },
      { $set: { status: 'active', autoRenew: true, cancellationEffectiveAt: null } }
    );
    await completeOperation(context, operation, { stripeSubscriptionId: updated.id });
    return { message: 'Abonnementet fortsetter', effectiveAt: context.period.end.toISOString() };
  } catch (err) {
    await markReconciliation(context, operation, err);
    if (err instanceof SubscriptionManagementError) throw err;
    throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The resumption result is being verified.');
  }
}

async function scheduleDowngrade(context, target, operation, setStage) {
  const { stripe, subscription, record } = context;
  if (record.pendingPlanChange) {
    if (
      String(record.pendingPlanChange.targetPlanId) === String(target.plan._id) &&
      record.pendingPlanChange.stripeScheduleId
    ) {
      return {
        strategy: 'period_end',
        effectiveAt: new Date(record.pendingPlanChange.effectiveAt).toISOString(),
        message: 'Planendringen trer i kraft ved neste fornyelse',
      };
    }
    throw fail(409, 'SUBSCRIPTION_PLAN_CHANGE_PENDING', 'Resolve the scheduled plan change before scheduling another.');
  }
  let scheduleId = idOf(subscription.schedule) || operation.stripeScheduleId;
  let schedule;
  if (scheduleId) {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    if (
      schedule.metadata?.subscriptionV2 !== 'true' ||
      String(schedule.metadata?.userId) !== String(record.userId) ||
      String(schedule.metadata?.subscriptionId) !== String(record._id) ||
      schedule.metadata?.stripeMode !== record.stripeMode ||
      !['active', 'not_started'].includes(schedule.status)
    ) {
      throw fail(409, 'SUBSCRIPTION_SCHEDULE_NOT_OWNED', 'The existing Stripe schedule is not managed by Jobblo.');
    }
    if (
      !record.pendingPlanChange &&
      schedule.metadata?.operationId !== operation.operationId
    ) {
      throw fail(409, 'SUBSCRIPTION_PLAN_CHANGE_PENDING', 'An existing Stripe schedule requires review.');
    }
  } else {
    setStage('schedule_create');
    schedule = await stripe.subscriptionSchedules.create(
      {
        from_subscription: record.stripeSubscriptionId,
      },
      { idempotencyKey: `jobblo-subv2-${record.stripeMode}-${operation.idempotencyKey}-schedule-create` }
    );
    scheduleId = schedule.id;
    setStage('persist_schedule_id');
    await context.OperationModel.updateOne(
      { _id: operation._id },
      { $set: { stripeScheduleId: scheduleId } }
    );
    setStage('retrieve_created_schedule');
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  }
  const start = schedule.current_phase?.start_date || schedule.phases?.[0]?.start_date;
  const end = context.period.end.getTime() / 1000;
  if (!start || end <= start || !schedule.phases?.length) {
    throw fail(409, 'SUBSCRIPTION_SCHEDULE_INVALID', 'The billing schedule could not be verified.');
  }
  const currentItems = schedule.phases[0].items.map((item) => ({
    price: idOf(item.price),
    quantity: item.quantity || 1,
  }));
  if (
    currentItems.length !== 1 ||
    currentItems[0].price !== idOf(context.period.item.price) ||
    currentItems[0].quantity !== (context.period.item.quantity || 1)
  ) {
    throw fail(409, 'SUBSCRIPTION_SCHEDULE_INVALID', 'The existing billing schedule does not match the current subscription.');
  }
  const metadata = {
    subscriptionV2: 'true',
    userId: String(record.userId),
    subscriptionId: String(record._id),
    planId: String(target.plan._id),
    operationId: operation.operationId,
    stripeMode: record.stripeMode,
  };
  const phases = [
    {
      start_date: start,
      end_date: end,
      items: currentItems,
      proration_behavior: 'none',
    },
    {
      start_date: end,
      items: [{ price: target.priceId, quantity: 1 }],
      metadata,
      proration_behavior: 'none',
    },
  ];
  setStage('schedule_update');
  await stripe.subscriptionSchedules.update(
    scheduleId,
    {
      end_behavior: 'release',
      metadata,
      phases,
    },
    { idempotencyKey: `jobblo-subv2-${record.stripeMode}-${operation.idempotencyKey}-schedule-update` }
  );
  setStage('verify_schedule');
  const verifiedSchedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  const targetPhase = verifiedSchedule.phases?.find(
    (phase) =>
      phase.start_date === end &&
      phase.items?.some((item) => idOf(item.price) === target.priceId)
  );
  if (
    verifiedSchedule.status !== 'active' ||
    verifiedSchedule.metadata?.subscriptionV2 !== 'true' ||
    String(verifiedSchedule.metadata?.userId) !== String(record.userId) ||
    String(verifiedSchedule.metadata?.subscriptionId) !== String(record._id) ||
    verifiedSchedule.metadata?.stripeMode !== record.stripeMode ||
    String(verifiedSchedule.metadata?.planId) !== String(target.plan._id) ||
    verifiedSchedule.metadata?.operationId !== operation.operationId ||
    !targetPhase
  ) {
    throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The scheduled plan change could not be verified.');
  }
  setStage('persist_pending_plan');
  await context.SubscriptionModel.updateOne(
    { _id: record._id },
    {
      $set: {
        pendingPlanChange: {
          targetPlanId: target.plan._id,
          targetPlanType: target.plan.type,
          targetStripePriceId: target.priceId,
          effectiveAt: context.period.end,
          operationId: operation.operationId,
          stripeScheduleId: scheduleId,
        },
      },
    }
  );
  setStage('complete_operation');
  await completeOperation(context, operation, {
    stripeSubscriptionId: record.stripeSubscriptionId,
    stripeScheduleId: scheduleId,
    stripePriceId: target.priceId,
  });
  return {
    strategy: 'period_end',
    effectiveAt: context.period.end.toISOString(),
    message: 'Planendringen trer i kraft ved neste fornyelse',
  };
}

async function changePlan(userId, planId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  activeSubscription(context.subscription);
  const target = await getTargetPlan(context, planId);
  const strategy = classifyPlanChange(context, target);
  if (strategy === 'no_change') {
    return { strategy, message: 'Du har allerede valgt denne planen' };
  }
  const operationType = strategy === 'immediate' ? 'upgrade' : 'downgrade';
  if (context.record.pendingPlanChange) {
    const pending = context.record.pendingPlanChange;
    if (
      strategy === 'period_end' &&
      String(pending.targetPlanId) === String(target.plan._id) &&
      pending.stripeScheduleId
    ) {
      const schedule = await context.stripe.subscriptionSchedules.retrieve(pending.stripeScheduleId);
      const effectiveAt = Math.floor(new Date(pending.effectiveAt).getTime() / 1000);
      const targetPhase = schedule.phases?.find(
        (phase) =>
          phase.start_date === effectiveAt &&
          phase.items?.some((item) => idOf(item.price) === target.priceId)
      );
      if (
        schedule.metadata?.subscriptionV2 !== 'true' ||
        String(schedule.metadata?.userId) !== String(context.record.userId) ||
        String(schedule.metadata?.subscriptionId) !== String(context.record._id) ||
        schedule.metadata?.stripeMode !== context.record.stripeMode ||
        String(schedule.metadata?.planId) !== String(target.plan._id) ||
        schedule.metadata?.operationId !== pending.operationId ||
        !['active', 'not_started'].includes(schedule.status) ||
        !targetPhase
      ) {
        throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The scheduled plan change needs verification.');
      }
      return {
        strategy: 'period_end',
        effectiveAt: new Date(pending.effectiveAt).toISOString(),
        message: 'Planendringen trer i kraft ved neste fornyelse',
      };
    }
    throw fail(409, 'SUBSCRIPTION_PLAN_CHANGE_PENDING', 'Resolve the scheduled plan change before upgrading.');
  }
  const operation = await acquireOperation(context, operationType, target.plan._id);
  if (strategy === 'period_end') {
    let stage = 'schedule_preflight';
    try {
      return await scheduleDowngrade(context, target, operation, (value) => {
        stage = value;
      });
    } catch (err) {
      if (stage === 'schedule_create' && isStripeValidationError(err)) {
        await markScheduleCreationFailed(context, operation, err);
        throw fail(502, 'SUBSCRIPTION_SCHEDULE_REJECTED', 'Stripe rejected the scheduled plan change request.');
      }
      await markReconciliation(context, operation, err, stage);
      if (err instanceof SubscriptionManagementError) throw err;
      throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The scheduled change result is being verified.');
    }
  }

  const prorationDate = Math.floor(new Date(operation.prorationDate || Date.now()).getTime() / 1000);
  await context.OperationModel.updateOne(
    { _id: operation._id },
    {
      $set: { prorationDate: new Date(prorationDate * 1000), stripePriceId: target.priceId },
      $inc: { attempts: 1 },
    }
  );
  try {
    await context.stripe.subscriptions.update(
      context.record.stripeSubscriptionId,
      {
        items: [{ id: context.period.item.id, price: target.priceId, quantity: context.period.item.quantity || 1 }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'pending_if_incomplete',
        billing_cycle_anchor: 'unchanged',
        proration_date: prorationDate,
        metadata: metadataFor(operation, context.record),
      },
      { idempotencyKey: `jobblo-subv2-${context.record.stripeMode}-${operation.idempotencyKey}` }
    );
    return {
      strategy: 'immediate',
      message: 'Oppgraderingen behandles etter bekreftet betaling',
    };
  } catch (err) {
    await markReconciliation(context, operation, err);
    throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The upgrade result is being verified.');
  }
}

async function cancelScheduledPlanChange(userId, overrides = {}) {
  const context = await getSubscriptionContext(userId, overrides);
  activeSubscription(context.subscription);
  const pending = context.record.pendingPlanChange;
  if (!pending) {
    return { canceled: false, message: 'Ingen planlagt planendring å avbryte' };
  }
  if (
    !pending.stripeScheduleId ||
    !pending.operationId ||
    new Date(pending.effectiveAt).getTime() !== context.period.end.getTime()
  ) {
    throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The scheduled change requires verification.');
  }

  const priorOperation = await context.OperationModel.findOne({
    userId: context.record.userId,
    subscriptionId: context.record._id,
    operationId: pending.operationId,
    operationType: 'downgrade',
    targetPlanId: pending.targetPlanId,
    stripeScheduleId: pending.stripeScheduleId,
    stripeSubscriptionId: context.record.stripeSubscriptionId,
    stripeMode: context.record.stripeMode,
    status: 'succeeded',
  });
  if (!priorOperation) {
    throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The scheduled change requires verification.');
  }

  const verifySchedule = async () => {
    const schedule = await context.stripe.subscriptionSchedules.retrieve(pending.stripeScheduleId);
    const targetPhaseStart = Math.floor(pending.effectiveAt.getTime() / 1000);
    const currentPhase = schedule.phases?.[0];
    const targetPhase = schedule.phases?.find(
      (phase) =>
        phase.start_date === targetPhaseStart &&
        phase.items?.length === 1 &&
        idOf(phase.items[0].price) === pending.targetStripePriceId &&
        (phase.items[0].quantity || 1) === 1
    );
    if (
      schedule.id !== pending.stripeScheduleId ||
      // Released schedules carry the subscription in `released_subscription` instead.
      (idOf(schedule.subscription) ||
        (schedule.status === 'released' ? idOf(schedule.released_subscription) : null)) !==
        context.record.stripeSubscriptionId ||
      schedule.metadata?.subscriptionV2 !== 'true' ||
      String(schedule.metadata?.userId) !== String(context.record.userId) ||
      String(schedule.metadata?.subscriptionId) !== String(context.record._id) ||
      String(schedule.metadata?.planId) !== String(pending.targetPlanId) ||
      schedule.metadata?.operationId !== pending.operationId ||
      schedule.metadata?.stripeMode !== context.record.stripeMode ||
      schedule.phases?.length !== 2 ||
      currentPhase?.end_date !== targetPhaseStart ||
      currentPhase.items?.length !== 1 ||
      idOf(currentPhase.items[0].price) !== idOf(context.period.item.price) ||
      (currentPhase.items[0].quantity || 1) !== (context.period.item.quantity || 1) ||
      !targetPhase
    ) {
      throw fail(409, 'SUBSCRIPTION_SCHEDULE_NOT_OWNED', 'The scheduled change could not be verified.');
    }
    return schedule;
  };

  const schedule = await verifySchedule();
  if (!['active', 'not_started', 'released'].includes(schedule.status)) {
    throw fail(409, 'SUBSCRIPTION_SCHEDULE_NOT_CANCELABLE', 'The scheduled change is no longer cancelable.');
  }
  const operation = await acquireOperation(context, 'cancel_plan_change', pending.targetPlanId);
  try {
    if (schedule.status !== 'released') {
      await context.stripe.subscriptionSchedules.release(
        schedule.id,
        { preserve_cancel_date: false },
        { idempotencyKey: `jobblo-subv2-${context.record.stripeMode}-${operation.idempotencyKey}` }
      );
    }
    const verifiedSchedule = await context.stripe.subscriptionSchedules.retrieve(schedule.id);
    if (
      verifiedSchedule.id !== schedule.id ||
      verifiedSchedule.status !== 'released' ||
      verifiedSchedule.metadata?.subscriptionV2 !== 'true' ||
      String(verifiedSchedule.metadata?.userId) !== String(context.record.userId) ||
      String(verifiedSchedule.metadata?.subscriptionId) !== String(context.record._id) ||
      verifiedSchedule.metadata?.stripeMode !== context.record.stripeMode
    ) throw new Error('stripe_schedule_release_not_confirmed');
    const updated = await context.SubscriptionModel.updateOne(
      {
        _id: context.record._id,
        'pendingPlanChange.operationId': pending.operationId,
        'pendingPlanChange.stripeScheduleId': pending.stripeScheduleId,
      },
      { $set: { pendingPlanChange: null } }
    );
    if (updated.matchedCount === 0 || (updated.matchedCount == null && updated.modifiedCount === 0)) {
      const current = await context.SubscriptionModel.findOne({ _id: context.record._id }).lean();
      if (!current || current.pendingPlanChange) throw new Error('scheduled_plan_change_state_changed');
    }
    await completeOperation(context, operation, {
      stripeSubscriptionId: context.record.stripeSubscriptionId,
      stripeScheduleId: schedule.id,
    });
    return { canceled: true, message: 'Den planlagte nedgraderingen er avbrutt' };
  } catch (err) {
    await markReconciliation(context, operation, err);
    if (err instanceof SubscriptionManagementError) throw err;
    throw fail(503, 'SUBSCRIPTION_RECONCILIATION_REQUIRED', 'The scheduled change result is being verified.');
  }
}

async function syncCanonicalSubscription(context, subscription, plan, operationType = null) {
  const period = periodOf(subscription);
  const status = subscription.status === 'active'
    ? subscription.cancel_at_period_end ? 'canceling' : 'active'
    : subscription.status === 'canceled' ? 'canceled'
      : ['past_due', 'unpaid', 'paused'].includes(subscription.status) ? 'past_due'
        : subscription.status === 'incomplete_expired' ? 'expired'
          : 'pending';
  await context.SubscriptionModel.updateOne(
    { _id: context.record._id },
    {
      $set: {
        planId: plan._id,
        planType: plan.type,
        stripePriceId: idOf(period.item.price),
        status,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        nextRenewalAt: period.end,
        autoRenew: !subscription.cancel_at_period_end && subscription.status === 'active',
        cancellationEffectiveAt: subscription.cancel_at_period_end
          ? dateOf(subscription.cancel_at) || period.end
          : null,
        ...(subscription.status === 'canceled' ? { pendingPlanChange: null } : {}),
      },
    }
  );
  if (operationType) {
    const operation = await context.OperationModel.findOne({
      userId: context.record.userId,
      stripeSubscriptionId: context.record.stripeSubscriptionId,
      operationType,
      status: { $in: ['pending', 'reconciliation_required'] },
      lifecycleLock: true,
    });
    if (operation) {
      await completeOperation(context, operation, {
        stripeSubscriptionId: subscription.id,
        stripePriceId: idOf(period.item.price),
      });
    }
  }
  return { planId: plan._id, status, period };
}

module.exports = {
  SubscriptionManagementError,
  getSubscriptionContext,
  getCurrentSubscription,
  createBillingPortalSession,
  getBillingHistory,
  getInvoicePdf,
  previewPlanChange,
  cancelSubscription,
  cancelScheduledPlanChange,
  resumeSubscription,
  changePlan,
  syncCanonicalSubscription,
  stripePriceIsMonthlyNok,
  periodOf,
};
