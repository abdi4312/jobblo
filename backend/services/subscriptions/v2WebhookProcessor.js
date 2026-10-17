const mongoose = require('mongoose');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const SubscriptionWebhookEventV2 = require('../../models/SubscriptionWebhookEventV2');
const SubscriptionUsagePeriod = require('../../models/SubscriptionUsagePeriod');
const {
  ensurePaidUsagePeriod,
  setPaidPeriodAllowance,
} = require('./v2Entitlements');
const recoveryPolicy = require('./v2RecoveryPolicy');

const V2_MARKER = 'true';
const STALE_CLAIM_MS = 5 * 60 * 1000;
const BILLABLE_STATUSES = new Set([
  'active',
  'past_due',
  'canceling',
  'pending',
]);
const SCHEDULE_EVENT_TYPES = new Set([
  'subscription_schedule.created',
  'subscription_schedule.updated',
  'subscription_schedule.canceled',
  'subscription_schedule.released',
  'subscription_schedule.aborted',
]);

function idOf(value) {
  return typeof value === 'string' ? value : value?.id;
}

function metadataFromInvoice(invoice) {
  return invoice?.parent?.subscription_details?.metadata || {};
}

function subscriptionIdFromInvoice(invoice) {
  return idOf(invoice?.parent?.subscription_details?.subscription);
}

function isV2Metadata(metadata) {
  return metadata?.subscriptionV2 === V2_MARKER;
}

function asDate(timestamp) {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return null;
  return new Date(timestamp * 1000);
}

function subscriptionSnapshot(subscription) {
  const items = subscription?.items?.data || [];
  if (items.length !== 1) return null;
  const item = items[0];
  const start = asDate(item.current_period_start);
  const end = asDate(item.current_period_end);
  if (!start || !end || end <= start) return null;
  return { item, start, end };
}

function localStatus(subscription) {
  switch (subscription.status) {
    case 'active':
      return subscription.cancel_at_period_end ? 'canceling' : 'active';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due';
    case 'incomplete':
      return 'pending';
    case 'canceled':
      return 'canceled';
    case 'incomplete_expired':
      return 'expired';
    default:
      return null;
  }
}

function operationIdentity(metadata, mode) {
  if (
    !isV2Metadata(metadata) ||
    !metadata.userId ||
    !mongoose.Types.ObjectId.isValid(metadata.userId) ||
    !mongoose.Types.ObjectId.isValid(metadata.planId || '') ||
    !metadata.operationId ||
    metadata.stripeMode !== mode
  ) {
    return null;
  }
  return {
    userId: new mongoose.Types.ObjectId(metadata.userId),
    planId: new mongoose.Types.ObjectId(metadata.planId),
    operationId: metadata.operationId,
  };
}

async function claimEvent(event, mode, EventModel) {
  const now = new Date();
  try {
    const record = await EventModel.create({
      stripeEventId: event.id,
      stripeMode: mode,
      eventType: event.type,
      status: 'processing',
      attempts: 1,
    });
    return { claimed: true, record };
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  const existing = await EventModel.findOne({
    stripeMode: mode,
    stripeEventId: event.id,
  });
  if (!existing) return { claimed: false, inFlight: true };
  if (['processed', 'reconciled'].includes(existing.status)) {
    return { claimed: false, duplicate: true };
  }

  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const mayRetry =
    existing.status === 'failed' ||
    existing.status === 'received' ||
    (existing.status === 'processing' && existing.updatedAt <= staleBefore);
  if (!mayRetry) return { claimed: false, inFlight: true };

  const reclaimed = await EventModel.findOneAndUpdate(
    {
      _id: existing._id,
      status: existing.status,
      updatedAt: existing.updatedAt,
    },
    {
      $set: { status: 'processing', eventType: event.type },
      $inc: { attempts: 1 },
      $unset: { nextAttemptAt: 1, lastErrorCode: 1, lastErrorMessage: 1 },
    },
    { new: true }
  );
  return reclaimed ? { claimed: true, record: reclaimed } : { claimed: false, inFlight: true };
}

async function matchingOperation(identity, mode, OperationModel) {
  const operation = await OperationModel.findOne({
    stripeMode: mode,
    operationId: identity.operationId,
    userId: identity.userId,
    targetPlanId: identity.planId,
    operationType: 'checkout',
  });
  if (!operation || operation.status === 'reconciliation_required') return null;
  return operation;
}

async function recordUnmatchedV2Event(identity, mode, object, reason, OperationModel) {
  const filter = { stripeMode: mode, operationId: identity.operationId };
  let operation = await OperationModel.findOne(filter);
  if (
    operation &&
    (String(operation.userId) !== String(identity.userId) ||
      String(operation.targetPlanId) !== String(identity.planId))
  ) {
    throw new Error('subscription_operation_owner_mismatch');
  }

  const updates = {
    status: 'reconciliation_required',
    stripeCheckoutSessionId: object.checkoutSessionId || undefined,
    stripeSubscriptionId: object.subscriptionId || object.id || undefined,
    stripeCustomerId: object.customerId || undefined,
    stripeInvoiceId: object.invoiceId || undefined,
    lastErrorCode: reason,
    lastErrorMessage: 'Verified Stripe state has no matching checkout operation.',
  };
  if (operation) {
    await OperationModel.updateOne({ _id: operation._id }, { $set: updates });
  } else {
    try {
      await OperationModel.findOneAndUpdate(
        filter,
        {
          $setOnInsert: {
            operationId: identity.operationId,
            idempotencyKey: `reconciliation:${mode}:${identity.operationId}`,
            stripeMode: mode,
            operationType: 'checkout',
            userId: identity.userId,
            targetPlanId: identity.planId,
          },
          $set: updates,
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
      const raced = await OperationModel.findOne(filter);
      if (
        !raced ||
        String(raced.userId) !== String(identity.userId) ||
        String(raced.targetPlanId) !== String(identity.planId)
      ) {
        throw new Error('subscription_operation_owner_mismatch');
      }
      await OperationModel.updateOne({ _id: raced._id }, { $set: updates });
    }
  }
  return { handled: 'subscription_reconciliation_required' };
}

async function loadCanonicalSubscription(stripe, stripeSubscriptionId) {
  if (!stripeSubscriptionId) throw new Error('subscription_reference_missing');
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['latest_invoice', 'items.data.price'],
  });
  if (!subscription || subscription.id !== stripeSubscriptionId) {
    throw new Error('subscription_reference_mismatch');
  }
  return subscription;
}

async function paidLatestInvoice(stripe, subscription) {
  let invoice = subscription.latest_invoice;
  if (typeof invoice === 'string') invoice = await stripe.invoices.retrieve(invoice);
  if (!invoice || invoice.status !== 'paid') return null;
  if (idOf(invoice.customer) !== idOf(subscription.customer)) return null;
  if (subscriptionIdFromInvoice(invoice) !== subscription.id) return null;
  return invoice;
}

async function setOperationReconciliation(operation, reason, OperationModel) {
  await OperationModel.updateOne(
    { _id: operation._id },
    {
      $set: {
        status: 'reconciliation_required',
        lastErrorCode: reason,
        lastErrorMessage: 'Verified Stripe state requires manual reconciliation.',
      },
    }
  );
}

async function recordActivation({
  identity,
  operation,
  mode,
  subscription,
  invoice,
  plan,
  SubscriptionModel,
  OperationModel,
  UsageModel = SubscriptionUsagePeriod,
}) {
  const period = subscriptionSnapshot(subscription);
  const status = localStatus(subscription);
  if (!period || status !== 'active' || !invoice || !plan) {
    throw new Error('subscription_activation_not_verified');
  }
  const expectedPriceId = mode === 'test' ? plan.stripePriceIdTest : plan.stripePriceId;
  const actualPriceId = idOf(period.item.price);
  if (
    !expectedPriceId ||
    actualPriceId !== expectedPriceId ||
    period.item.price?.currency?.toLowerCase() !== 'nok' ||
    period.item.price?.recurring?.interval !== 'month' ||
    period.item.price?.recurring?.interval_count !== 1 ||
    invoice.currency?.toLowerCase() !== 'nok' ||
    invoice.amount_paid !== Math.round(plan.price * 100)
  ) {
    throw new Error('subscription_price_mismatch');
  }
  if (
    operation.stripeCustomerId &&
    idOf(subscription.customer) !== operation.stripeCustomerId
  ) {
    throw new Error('subscription_customer_mismatch');
  }

  const existingByStripe = await SubscriptionModel.findOne({
    stripeMode: mode,
    stripeSubscriptionId: subscription.id,
  }).lean();
  if (
    existingByStripe &&
    (String(existingByStripe.userId) !== String(identity.userId) ||
      String(existingByStripe.planId) !== String(identity.planId))
  ) {
    await setOperationReconciliation(operation, 'subscription_owner_mismatch', OperationModel);
    return { handled: 'subscription_reconciliation_required' };
  }

  const existingByUser = await SubscriptionModel.findOne({ userId: identity.userId }).lean();
  if (
    existingByUser &&
    existingByUser.stripeSubscriptionId !== subscription.id &&
    BILLABLE_STATUSES.has(existingByUser.status)
  ) {
    await setOperationReconciliation(operation, 'active_v2_subscription_exists', OperationModel);
    return { handled: 'subscription_reconciliation_required' };
  }

  const planHistoryEntry = {
    planId: identity.planId,
    planName: plan.name,
    planPrice: plan.price,
    planType: plan.type,
    stripeMode: mode,
    stripeSubscriptionId: subscription.id,
    stripePriceId: period.item.price?.id || idOf(period.item.price),
    periodStart: period.start,
    periodEnd: period.end,
    changeType: 'initial',
    operationId: identity.operationId,
    effectiveAt: period.start,
  };

  const subscriptionRecord = await SubscriptionModel.findOneAndUpdate(
    { userId: identity.userId },
    {
      $set: {
        planId: identity.planId,
        planType: plan.type,
        stripeCustomerId: idOf(subscription.customer),
        stripeSubscriptionId: subscription.id,
        stripeMode: mode,
        status: 'active',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        nextRenewalAt: period.end,
        autoRenew: !subscription.cancel_at_period_end,
        cancellationEffectiveAt: subscription.cancel_at_period_end
          ? asDate(subscription.cancel_at)
          : null,
        paymentRecoveryStatus: 'none',
        firstPaymentFailureAt: null,
        gracePeriodEndsAt: null,
      },
      $addToSet: { planHistory: planHistoryEntry },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  if (!subscriptionRecord?._id) throw new Error('subscription_activation_record_missing');
  await ensurePaidUsagePeriod({
    userId: identity.userId,
    subscriptionId: subscriptionRecord._id,
    plan,
    start: period.start,
    end: period.end,
  }, UsageModel);

  await OperationModel.updateOne(
    { _id: operation._id },
    {
      $set: {
        status: 'succeeded',
        stripeCheckoutSessionId: operation.stripeCheckoutSessionId,
        stripeCustomerId: operation.stripeCustomerId || idOf(subscription.customer),
        stripeSubscriptionId: subscription.id,
        stripeInvoiceId: invoice.id,
        completedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    }
  );
  return { handled: 'subscription_activated' };
}

async function updateSubscriptionState({
  mode,
  subscription,
  invoice,
  failedPayment,
  failureAt,
  SubscriptionModel,
  OperationModel,
  PlanModel = SubscriptionPlan,
  UsageModel = SubscriptionUsagePeriod,
}) {
  const record = await SubscriptionModel.findOne({
    stripeMode: mode,
    stripeSubscriptionId: subscription.id,
  });
  if (!record) return { handled: 'subscription_not_provisioned' };
  if (idOf(subscription.customer) !== record.stripeCustomerId) {
    throw new Error('subscription_customer_mismatch');
  }
  let invoiceOperation;
  if (invoice && !failedPayment) {
    if (invoice.status !== 'paid') throw new Error('invoice_payment_not_verified');
    const operationId = `invoice:${invoice.id}`;
    try {
      invoiceOperation = await OperationModel.findOneAndUpdate(
        { stripeMode: mode, operationId },
        {
          $setOnInsert: {
            operationId,
            idempotencyKey: operationId,
            stripeMode: mode,
            operationType: 'renewal_recovery',
            status: 'pending',
            userId: record.userId,
            subscriptionId: record._id,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
      invoiceOperation = await OperationModel.findOne({ stripeMode: mode, operationId });
    }
    if (!invoiceOperation) throw new Error('invoice_operation_unavailable');
    if (invoiceOperation.status === 'succeeded') {
      return { handled: 'subscription_duplicate_invoice' };
    }
  }

  const period = subscriptionSnapshot(subscription);
  const status = localStatus(subscription);
  if (!period || !status) throw new Error('subscription_state_unsupported');

  const updates = {
    status: failedPayment && ['active', 'past_due', 'unpaid'].includes(subscription.status)
      ? 'past_due'
      : status,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    nextRenewalAt: period.end,
    autoRenew: !subscription.cancel_at_period_end,
    cancellationEffectiveAt: subscription.cancel_at_period_end
      ? asDate(subscription.cancel_at)
      : null,
  };
  if (
    invoice?.status === 'paid' &&
    record.paymentRecoveryStatus !== 'retrying' &&
    record.firstPaymentFailureAt
  ) {
    updates.paymentRecoveryStatus = 'recovered';
    updates.firstPaymentFailureAt = null;
  }
  await SubscriptionModel.updateOne({ _id: record._id }, { $set: updates });

  if (invoice?.status === 'paid') {
    const plan = await PlanModel.findById(record.planId).lean();
    if (!plan) throw new Error('subscription_usage_plan_missing');
    await ensurePaidUsagePeriod({
      userId: record.userId,
      subscriptionId: record._id,
      plan,
      start: period.start,
      end: period.end,
    }, UsageModel);
  }

  if (invoiceOperation) {
    await OperationModel.updateOne(
      { _id: invoiceOperation._id, status: 'pending' },
      {
        $set: {
          status: 'succeeded',
          stripeInvoiceId: invoice.id,
          completedAt: new Date(),
        },
      }
    );
  }

  return { handled: failedPayment ? 'subscription_payment_failed' : 'subscription_state_updated' };
}

async function findManagementOperation(identity, mode, subscriptionId, OperationModel) {
  return OperationModel.findOne({
    stripeMode: mode,
    operationId: identity.operationId,
    userId: identity.userId,
    stripeSubscriptionId: subscriptionId,
    $or: [
      {
        operationType: { $in: ['upgrade', 'downgrade'] },
        targetPlanId: identity.planId,
      },
      {
        operationType: { $in: ['cancel', 'resume'] },
        targetPlanId: null,
      },
    ],
    status: { $in: ['pending', 'reconciliation_required', 'succeeded'] },
  });
}

async function completeLifecycleOperation(operation, OperationModel, updates = {}) {
  if (!operation || !['pending', 'reconciliation_required'].includes(operation.status)) return;
  await OperationModel.updateOne(
    { _id: operation._id },
    {
      $set: { ...updates, status: 'succeeded', completedAt: new Date() },
      $unset: { lifecycleLock: 1 },
    }
  );
}

async function verifyPlanPrice(stripe, subscription, plan, mode) {
  const snapshot = subscriptionSnapshot(subscription);
  if (!snapshot) return null;
  let price = snapshot.item.price;
  if (typeof price === 'string') price = await stripe.prices.retrieve(price);
  const expectedPriceId = mode === 'test' ? plan.stripePriceIdTest : plan.stripePriceId;
  if (
    !price ||
    !expectedPriceId ||
    idOf(price) !== expectedPriceId ||
    price.active !== true ||
    price.livemode !== (mode === 'live') ||
    price.currency?.toLowerCase() !== 'nok' ||
    price.type !== 'recurring' ||
    price.recurring?.interval !== 'month' ||
    price.recurring?.interval_count !== 1
  ) {
    return null;
  }
  return { ...snapshot, price };
}

async function applyVerifiedPlanChange({
  identity,
  operation,
  mode,
  subscription,
  invoice,
  existing,
  plan,
  stripe,
  SubscriptionModel,
  OperationModel,
  UsageModel = SubscriptionUsagePeriod,
}) {
  if (
    !operation ||
    !['upgrade', 'downgrade'].includes(operation.operationType) ||
    String(operation.userId) !== String(existing.userId) ||
    String(operation.targetPlanId) !== String(identity.planId) ||
    String(operation.stripeSubscriptionId) !== subscription.id ||
    idOf(subscription.customer) !== existing.stripeCustomerId
  ) {
    throw new Error('subscription_record_owner_mismatch');
  }
  const snapshot = await verifyPlanPrice(stripe, subscription, plan, mode);
  if (!snapshot) throw new Error('subscription_plan_change_price_mismatch');

  if (operation.operationType === 'upgrade') {
    if (!invoice || invoice.status !== 'paid' || subscription.status !== 'active') {
      return { handled: 'subscription_plan_change_payment_pending' };
    }
    if (
      idOf(invoice.customer) !== existing.stripeCustomerId ||
      subscriptionIdFromInvoice(invoice) !== subscription.id
    ) {
      throw new Error('subscription_upgrade_invoice_mismatch');
    }
  } else {
    const pending = existing.pendingPlanChange;
    const effectiveAt = pending?.effectiveAt && new Date(pending.effectiveAt);
    const scheduleId = pending?.stripeScheduleId || operation.stripeScheduleId;
    if (
      !pending ||
      String(pending.targetPlanId) !== String(plan._id) ||
      pending.operationId !== operation.operationId ||
      !scheduleId ||
      !effectiveAt ||
      snapshot.start < effectiveAt
    ) {
      return { handled: 'subscription_downgrade_not_effective' };
    }
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const currentPhase = schedule.current_phase;
    const currentPhaseItems = schedule.phases?.find(
      (phase) => phase.start_date === currentPhase?.start_date
    )?.items || [];
    const effectiveAtSeconds = Math.floor(effectiveAt.getTime() / 1000);
    const targetPhase = schedule.phases?.find(
      (phase) =>
        phase.start_date === effectiveAtSeconds &&
        phase.items?.some((item) => idOf(item.price) === idOf(snapshot.item.price))
    );
    if (
      !['active', 'released'].includes(schedule.status) ||
      schedule.metadata?.subscriptionV2 !== V2_MARKER ||
      String(schedule.metadata?.userId) !== String(existing.userId) ||
      String(schedule.metadata?.subscriptionId) !== String(existing._id) ||
      schedule.metadata?.stripeMode !== mode ||
      String(schedule.metadata?.planId) !== String(plan._id) ||
      schedule.metadata?.operationId !== operation.operationId ||
      (schedule.status === 'active' &&
        (!currentPhase ||
          currentPhase.start_date < effectiveAtSeconds ||
          !currentPhaseItems.some((item) => idOf(item.price) === idOf(snapshot.item.price)))) ||
      (schedule.status === 'released' &&
        (!targetPhase || snapshot.start.getTime() / 1000 < targetPhase.start_date))
    ) {
      throw new Error('subscription_downgrade_schedule_unverified');
    }
  }

  const changeType = operation.operationType;
  await SubscriptionModel.updateOne(
    { _id: existing._id, planId: existing.planId },
    {
      $set: {
        planId: plan._id,
        planType: plan.type,
        stripePriceId: idOf(snapshot.item.price),
        status: localStatus(subscription),
        currentPeriodStart: snapshot.start,
        currentPeriodEnd: snapshot.end,
        nextRenewalAt: snapshot.end,
        autoRenew: !subscription.cancel_at_period_end,
        cancellationEffectiveAt: subscription.cancel_at_period_end
          ? asDate(subscription.cancel_at)
          : null,
        pendingPlanChange: null,
      },
      $push: {
        planHistory: {
          planId: plan._id,
          planName: plan.name,
          planPrice: plan.price,
          planType: plan.type,
          stripeMode: mode,
          stripeSubscriptionId: subscription.id,
          stripePriceId: idOf(snapshot.item.price),
          periodStart: snapshot.start,
          periodEnd: snapshot.end,
          changeType,
          operationId: operation.operationId,
          effectiveAt: snapshot.start,
        },
      },
    },
    { runValidators: true }
  );
  await setPaidPeriodAllowance({
    userId: existing.userId,
    subscriptionId: existing._id,
    plan,
    start: snapshot.start,
    end: snapshot.end,
  }, UsageModel);
  await completeLifecycleOperation(operation, OperationModel, {
    stripeSubscriptionId: subscription.id,
    stripePriceId: idOf(snapshot.item.price),
    ...(invoice ? { stripeInvoiceId: invoice.id } : {}),
  });
  return { handled: `subscription_${changeType}_confirmed` };
}

function scheduleIdentity(metadata, mode) {
  const identity = operationIdentity(metadata, mode);
  if (!identity || !mongoose.Types.ObjectId.isValid(metadata.subscriptionId || '')) return null;
  return {
    ...identity,
    subscriptionId: new mongoose.Types.ObjectId(metadata.subscriptionId),
  };
}

async function processSubscriptionScheduleEvent(event, mode, stripe, deps) {
  const object = event.data?.object || {};
  if (event.livemode !== (mode === 'live')) throw new Error('subscription_schedule_mode_mismatch');
  if (!object.id) throw new Error('subscription_schedule_metadata_invalid');
  const schedule = await stripe.subscriptionSchedules.retrieve(object.id);
  if (
    !schedule ||
    schedule.id !== object.id ||
    schedule.livemode !== (mode === 'live')
  ) {
    throw new Error('subscription_schedule_reference_mismatch');
  }

  let eventIdentity = scheduleIdentity(object.metadata, mode);
  if (event.type === 'subscription_schedule.created') {
    if (!isV2Metadata(schedule.metadata)) {
      const stripeSubscriptionId = idOf(schedule.subscription);
      if (
        !stripeSubscriptionId ||
        (idOf(object.subscription) && idOf(object.subscription) !== stripeSubscriptionId)
      ) {
        throw new Error('subscription_schedule_reference_mismatch');
      }
      const subscription = await loadCanonicalSubscription(stripe, stripeSubscriptionId);
      if (
        subscription.livemode !== (mode === 'live') ||
        !idOf(subscription.customer)
      ) {
        throw new Error('subscription_schedule_owner_mismatch');
      }
      if (!isV2Metadata(subscription.metadata)) {
        return { handled: 'subscription_event_ignored' };
      }
      const subscriptionIdentity = operationIdentity(subscription.metadata, mode);
      if (!subscriptionIdentity) throw new Error('subscription_schedule_metadata_invalid');
      const record = await deps.SubscriptionModel.findOne({
        userId: subscriptionIdentity.userId,
        stripeMode: mode,
        stripeSubscriptionId,
        stripeCustomerId: idOf(subscription.customer),
      }).lean();
      if (
        !record ||
        String(record.planId) !== subscriptionIdentity.planId.toString()
      ) {
        throw new Error('subscription_schedule_owner_mismatch');
      }
      if (Object.keys(schedule.metadata || {}).length) {
        throw new Error('subscription_schedule_metadata_invalid');
      }
      return { handled: 'subscription_schedule_created_awaiting_update' };
    }
    eventIdentity = scheduleIdentity(schedule.metadata, mode);
  }
  if (!isV2Metadata(object.metadata) && event.type !== 'subscription_schedule.created') {
    return { handled: 'subscription_event_ignored' };
  }
  if (!eventIdentity) throw new Error('subscription_schedule_metadata_invalid');

  const identity = scheduleIdentity(schedule.metadata, mode);
  if (!identity) throw new Error('subscription_schedule_metadata_invalid');
  if (event.type !== 'subscription_schedule.created' && (
    identity.operationId !== eventIdentity.operationId ||
    !identity.userId.equals(eventIdentity.userId) ||
    !identity.planId.equals(eventIdentity.planId) ||
    !identity.subscriptionId.equals(eventIdentity.subscriptionId)
  )) {
    return { handled: 'subscription_schedule_stale_event' };
  }

  const stripeSubscriptionId = idOf(schedule.subscription);
  const record = await deps.SubscriptionModel.findOne({
    _id: identity.subscriptionId,
    userId: identity.userId,
    stripeMode: mode,
    stripeSubscriptionId,
  }).lean();
  if (!record) throw new Error('subscription_schedule_owner_mismatch');

  const [subscription, currentPlan, targetPlan, operation] = await Promise.all([
    loadCanonicalSubscription(stripe, stripeSubscriptionId),
    deps.PlanModel.findById(record.planId).lean(),
    deps.PlanModel.findById(identity.planId).lean(),
    deps.OperationModel.findOne({
      stripeMode: mode,
      operationId: identity.operationId,
      operationType: 'downgrade',
      userId: identity.userId,
      subscriptionId: record._id,
      stripeSubscriptionId,
      stripeScheduleId: schedule.id,
      targetPlanId: identity.planId,
    }).lean(),
  ]);
  if (
    !operation ||
    operation.stripeCustomerId !== record.stripeCustomerId ||
    operation.stripePriceId !== (mode === 'live' ? targetPlan?.stripePriceId : targetPlan?.stripePriceIdTest)
  ) {
    throw new Error('subscription_schedule_operation_mismatch');
  }
  if (operation.status !== 'succeeded' || operation.lifecycleLock === true) {
    throw new Error('subscription_schedule_operation_in_flight');
  }
  const scheduleIsTerminal = ['canceled', 'released', 'aborted'].includes(schedule.status);
  if (
    (subscription.status !== 'active' && !(scheduleIsTerminal && subscription.status === 'canceled')) ||
    subscription.livemode !== (mode === 'live') ||
    idOf(subscription.customer) !== record.stripeCustomerId ||
    !currentPlan ||
    !targetPlan ||
    targetPlan.type !== record.planType ||
    schedule.metadata?.subscriptionId !== String(record._id) ||
    schedule.metadata?.userId !== String(record.userId) ||
    schedule.metadata?.planId !== String(targetPlan._id) ||
    schedule.metadata?.operationId !== operation.operationId ||
    schedule.metadata?.stripeMode !== mode
  ) {
    throw new Error('subscription_schedule_owner_mismatch');
  }

  const [currentSnapshot, targetPrice] = await Promise.all([
    verifyPlanPrice(stripe, subscription, currentPlan, mode),
    stripe.prices.retrieve(mode === 'live' ? targetPlan.stripePriceId : targetPlan.stripePriceIdTest),
  ]);
  if (
    !currentSnapshot ||
    currentSnapshot.start.getTime() !== new Date(record.currentPeriodStart).getTime() ||
    currentSnapshot.end.getTime() !== new Date(record.currentPeriodEnd).getTime() ||
    !targetPrice ||
    targetPrice.id !== (mode === 'live' ? targetPlan.stripePriceId : targetPlan.stripePriceIdTest) ||
    targetPrice.active !== true ||
    targetPrice.livemode !== (mode === 'live') ||
    targetPrice.currency?.toLowerCase() !== 'nok' ||
    targetPrice.type !== 'recurring' ||
    targetPrice.recurring?.interval !== 'month' ||
    targetPrice.recurring?.interval_count !== 1
  ) {
    throw new Error('subscription_schedule_price_mismatch');
  }

  const targetPhase = schedule.phases?.find(
    (phase) =>
      phase.items?.length === 1 &&
      idOf(phase.items[0].price) === targetPrice.id &&
      phase.metadata?.operationId === operation.operationId
  );
  if (
    !targetPhase ||
    targetPhase.metadata?.subscriptionV2 !== V2_MARKER ||
    targetPhase.metadata?.userId !== String(record.userId) ||
    targetPhase.metadata?.planId !== String(targetPlan._id) ||
    targetPhase.metadata?.stripeMode !== mode ||
    (targetPhase.items[0].quantity || 1) !== 1
  ) {
    throw new Error('subscription_schedule_phase_mismatch');
  }

  const effectiveAt = new Date(targetPhase.start_date * 1000);
  if (!Number.isFinite(effectiveAt.getTime())) {
    throw new Error('subscription_schedule_period_invalid');
  }

  const alreadyEffective =
    String(record.planId) === String(targetPlan._id) &&
    idOf(currentSnapshot.item.price) === targetPrice.id &&
    currentSnapshot.start >= effectiveAt;
  if (alreadyEffective) return { handled: 'subscription_schedule_already_effective' };

  const currentPriceId = idOf(currentSnapshot.item.price);
  const currentPlanStillActive =
    String(record.planId) !== String(targetPlan._id) &&
    currentPriceId === record.stripePriceId &&
    currentSnapshot.start < effectiveAt;

  if (['active', 'not_started'].includes(schedule.status)) {
    const currentPhase = schedule.phases.find(
      (phase) => phase.start_date === Math.floor(currentSnapshot.start.getTime() / 1000)
    );
    if (
      !currentPlanStillActive ||
      targetPhase.start_date !== Math.floor(currentSnapshot.end.getTime() / 1000) ||
      currentPhase?.end_date !== targetPhase.start_date ||
      currentPhase.items?.length !== 1 ||
      idOf(currentPhase.items[0].price) !== currentPriceId ||
      (currentPhase.items[0].quantity || 1) !== (currentSnapshot.item.quantity || 1)
    ) {
      throw new Error('subscription_schedule_phase_mismatch');
    }
    const pending = record.pendingPlanChange;
    if (
      pending &&
      (pending.operationId !== operation.operationId ||
        pending.stripeScheduleId !== schedule.id)
    ) {
      throw new Error('subscription_schedule_state_conflict');
    }
    const result = await deps.SubscriptionModel.updateOne(
      {
        _id: record._id,
        userId: record.userId,
        planId: record.planId,
        currentPeriodEnd: record.currentPeriodEnd,
        ...(pending
          ? {
              'pendingPlanChange.operationId': operation.operationId,
              'pendingPlanChange.stripeScheduleId': schedule.id,
            }
          : { pendingPlanChange: null }),
      },
      {
        $set: {
          pendingPlanChange: {
            targetPlanId: targetPlan._id,
            targetPlanType: targetPlan.type,
            targetStripePriceId: targetPrice.id,
            effectiveAt,
            operationId: operation.operationId,
            stripeScheduleId: schedule.id,
          },
        },
      }
    );
    if (result.matchedCount !== 1) throw new Error('subscription_schedule_state_changed');
    return { handled: 'subscription_schedule_synchronized' };
  }

  if (['canceled', 'released', 'aborted'].includes(schedule.status)) {
    if (!record.pendingPlanChange) return { handled: 'subscription_schedule_already_cleared' };
    if (
      record.pendingPlanChange.operationId !== operation.operationId ||
      record.pendingPlanChange.stripeScheduleId !== schedule.id ||
      new Date(record.pendingPlanChange.effectiveAt).getTime() !== effectiveAt.getTime()
    ) {
      throw new Error('subscription_schedule_state_conflict');
    }
    if (schedule.status === 'released' && !currentPlanStillActive) {
      return { handled: 'subscription_schedule_transition_pending' };
    }
    const result = await deps.SubscriptionModel.updateOne(
      {
        _id: record._id,
        userId: record.userId,
        'pendingPlanChange.operationId': operation.operationId,
        'pendingPlanChange.stripeScheduleId': schedule.id,
      },
      { $set: { pendingPlanChange: null } }
    );
    if (result.matchedCount !== 1) throw new Error('subscription_schedule_state_changed');
    return { handled: 'subscription_schedule_cleared' };
  }

  return { handled: 'subscription_schedule_state_ignored' };
}

async function processVerifiedEvent(event, mode, stripe, overrides = {}) {
  const deps = {
    EventModel: SubscriptionWebhookEventV2,
    SubscriptionModel: SubscriptionV2,
    PlanModel: SubscriptionPlan,
    OperationModel: SubscriptionBillingOperationV2,
    UsageModel: SubscriptionUsagePeriod,
    RecoveryEmailModel: require('../../models/SubscriptionRecoveryEmailV2'),
    ...overrides,
  };
  const claim = await claimEvent(event, mode, deps.EventModel);
  if (claim.duplicate) return { handled: 'subscription_duplicate_event' };
  if (!claim.claimed) throw new Error('subscription_event_in_flight');

  try {
    const object = event.data?.object || {};
    let outcome;
    if (SCHEDULE_EVENT_TYPES.has(event.type)) {
      outcome = await processSubscriptionScheduleEvent(event, mode, stripe, deps);
    } else if (event.type.startsWith('checkout.session.')) {
      const identity = operationIdentity(object.metadata, mode);
      if (!isV2Metadata(object.metadata)) {
        outcome = { handled: 'subscription_event_ignored' };
      } else if (!identity || object.mode !== 'subscription') {
        throw new Error('subscription_checkout_metadata_invalid');
      } else {
        const operation = await matchingOperation(identity, mode, deps.OperationModel);
        if (
          !operation ||
          (operation.stripeCheckoutSessionId && operation.stripeCheckoutSessionId !== object.id)
        ) {
          outcome = await recordUnmatchedV2Event(
            identity,
            mode,
            {
              checkoutSessionId: object.id,
              subscriptionId: idOf(object.subscription),
              customerId: idOf(object.customer),
            },
            'subscription_checkout_operation_mismatch',
            deps.OperationModel
          );
        } else if (
          event.type === 'checkout.session.expired' ||
          event.type === 'checkout.session.async_payment_failed'
        ) {
          await deps.OperationModel.updateOne(
            { _id: operation._id, status: 'pending' },
            {
              $set: {
                status: 'failed',
                failedAt: new Date(),
                stripeCheckoutSessionId: object.id,
                lastErrorCode: event.type === 'checkout.session.expired'
                  ? 'checkout_expired'
                  : 'initial_payment_failed',
              },
            }
          );
          outcome = { handled: 'subscription_checkout_failed' };
        } else if (object.status === 'complete' && object.payment_status === 'paid') {
          const subscriptionId = idOf(object.subscription);
          const canonical = await loadCanonicalSubscription(stripe, subscriptionId);
          const canonicalMetadata = canonical.metadata || {};
          if (
            !operationIdentity(canonicalMetadata, mode) ||
            canonicalMetadata.operationId !== identity.operationId ||
            canonicalMetadata.userId !== identity.userId.toString() ||
            canonicalMetadata.planId !== identity.planId.toString() ||
            idOf(canonical.customer) !== idOf(object.customer) ||
            String(object.client_reference_id) !== String(identity.userId) ||
            object.currency?.toLowerCase() !== 'nok' ||
            object.livemode !== (mode === 'live') ||
            canonical.livemode !== (mode === 'live')
          ) {
            throw new Error('subscription_checkout_ownership_mismatch');
          }
          const invoice = await paidLatestInvoice(stripe, canonical);
          const plan = await deps.PlanModel.findById(identity.planId).lean();
          if (
            invoice &&
            invoice.currency?.toLowerCase() === 'nok' &&
            object.amount_total === Math.round(plan?.price * 100) &&
            plan
          ) {
            operation.stripeCheckoutSessionId = object.id;
            operation.stripeCustomerId = idOf(object.customer);
            outcome = await recordActivation({
              identity,
              operation,
              mode,
              subscription: canonical,
              invoice,
              plan,
              SubscriptionModel: deps.SubscriptionModel,
              OperationModel: deps.OperationModel,
              UsageModel: deps.UsageModel,
            });
          } else {
            outcome = { handled: 'subscription_payment_not_confirmed' };
          }
        } else {
          outcome = { handled: 'subscription_payment_not_confirmed' };
        }
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const identity = operationIdentity(object.metadata, mode);
      if (!isV2Metadata(object.metadata)) {
        outcome = { handled: 'subscription_event_ignored' };
      } else if (!identity) {
        throw new Error('subscription_metadata_invalid');
      } else {
        const subscription = await loadCanonicalSubscription(stripe, object.id);
        const canonicalIdentity = operationIdentity(subscription.metadata, mode);
        if (
          !canonicalIdentity ||
          canonicalIdentity.operationId !== identity.operationId ||
          canonicalIdentity.userId.toString() !== identity.userId.toString() ||
          canonicalIdentity.planId.toString() !== identity.planId.toString() ||
          subscription.livemode !== (mode === 'live')
        ) {
          throw new Error('subscription_ownership_mismatch');
        }
        const existing = await deps.SubscriptionModel.findOne({
          stripeMode: mode,
          stripeSubscriptionId: subscription.id,
        }).lean();
        if (existing) {
          if (String(existing.userId) !== identity.userId.toString()) {
            throw new Error('subscription_record_owner_mismatch');
          }
          if (String(existing.planId) !== identity.planId.toString()) {
            const operation = await findManagementOperation(
              identity,
              mode,
              subscription.id,
              deps.OperationModel
            );
            const plan = await deps.PlanModel.findById(identity.planId).lean();
            const invoice = operation?.operationType === 'upgrade'
              ? await paidLatestInvoice(stripe, subscription)
              : null;
            if (!plan) throw new Error('subscription_plan_change_plan_missing');
            outcome = await applyVerifiedPlanChange({
              identity,
              operation,
              mode,
              subscription,
              invoice,
              existing,
              plan,
              stripe,
              SubscriptionModel: deps.SubscriptionModel,
              OperationModel: deps.OperationModel,
              UsageModel: deps.UsageModel,
            });
          } else {
            outcome = await updateSubscriptionState({
              mode,
              subscription,
              SubscriptionModel: deps.SubscriptionModel,
              OperationModel: deps.OperationModel,
              PlanModel: deps.PlanModel,
              UsageModel: deps.UsageModel,
            });
            if (
              subscription.status === 'canceled' &&
              existing.paymentRecoveryStatus === 'retrying' &&
              existing.recoveryInvoiceId
            ) {
              const recoveryInvoice = await stripe.invoices.retrieve(existing.recoveryInvoiceId);
              if (recoveryPolicy.invoiceMatchesSubscription(recoveryInvoice, existing, mode)) {
                await recoveryPolicy.markCanceled(
                  existing,
                  recoveryInvoice,
                  `stripe-canceled:${existing.recoveryInvoiceId}`,
                  { SubscriptionModel: deps.SubscriptionModel, EmailModel: deps.RecoveryEmailModel }
                );
              }
            }
            const operation = await findManagementOperation(
              identity,
              mode,
              subscription.id,
              deps.OperationModel
            );
            if (operation && ['cancel', 'resume'].includes(operation.operationType)) {
              await completeLifecycleOperation(operation, deps.OperationModel);
            }
          }
        } else {
          const operation = await matchingOperation(identity, mode, deps.OperationModel);
          if (!operation) {
            outcome = await recordUnmatchedV2Event(
              identity,
              mode,
              { id: subscription.id, customerId: idOf(subscription.customer) },
              'subscription_operation_missing',
              deps.OperationModel
            );
          } else {
            const invoice = await paidLatestInvoice(stripe, subscription);
            const plan = await deps.PlanModel.findById(identity.planId).lean();
            if (invoice && plan && subscription.status === 'active') {
              outcome = await recordActivation({
                identity,
                operation,
                mode,
                subscription,
                invoice,
                plan,
                SubscriptionModel: deps.SubscriptionModel,
                OperationModel: deps.OperationModel,
                UsageModel: deps.UsageModel,
              });
            } else {
              outcome = { handled: 'subscription_payment_not_confirmed' };
            }
          }
        }
      }
    } else if (
      event.type === 'invoice.paid' ||
      event.type === 'invoice.payment_failed' ||
      event.type === 'invoice.payment_action_required'
    ) {
      const metadata = metadataFromInvoice(object);
      const identity = operationIdentity(metadata, mode);
      if (!isV2Metadata(metadata)) {
        outcome = { handled: 'subscription_event_ignored' };
      } else if (!identity) {
        throw new Error('invoice_subscription_metadata_invalid');
      } else {
        const eventInvoice = object;
        const invoice = await stripe.invoices.retrieve(eventInvoice.id);
        if (!invoice || invoice.id !== eventInvoice.id) throw new Error('invoice_reference_mismatch');
        const canonicalMetadata = metadataFromInvoice(invoice);
        const canonicalInvoiceIdentity = operationIdentity(canonicalMetadata, mode);
        if (
          !canonicalInvoiceIdentity ||
          canonicalInvoiceIdentity.operationId !== identity.operationId ||
          canonicalInvoiceIdentity.userId.toString() !== identity.userId.toString() ||
          canonicalInvoiceIdentity.planId.toString() !== identity.planId.toString()
        ) {
          throw new Error('invoice_metadata_mismatch');
        }
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        const subscription = await loadCanonicalSubscription(stripe, subscriptionId);
        const canonicalIdentity = operationIdentity(subscription.metadata, mode);
        if (
          !canonicalIdentity ||
          canonicalIdentity.operationId !== identity.operationId ||
          canonicalIdentity.userId.toString() !== identity.userId.toString() ||
          canonicalIdentity.planId.toString() !== identity.planId.toString() ||
          idOf(invoice.customer) !== idOf(subscription.customer) ||
          subscription.livemode !== (mode === 'live')
        ) {
          throw new Error('invoice_subscription_ownership_mismatch');
        }

        const existing = await deps.SubscriptionModel.findOne({
          stripeMode: mode,
          stripeSubscriptionId: subscription.id,
        }).lean();
        if (existing && String(existing.userId) !== identity.userId.toString()) {
          throw new Error('subscription_record_owner_mismatch');
        }
        const paymentSucceeded = invoice.status === 'paid';
        const paymentFailed =
          ['invoice.payment_failed', 'invoice.payment_action_required'].includes(event.type) &&
          !paymentSucceeded;
        const latestInvoiceId = idOf(subscription.latest_invoice);
        if (latestInvoiceId && latestInvoiceId !== invoice.id) {
          outcome = { handled: 'subscription_stale_invoice_event_ignored' };
          await deps.EventModel.updateOne(
            { _id: claim.record._id, status: 'processing' },
            { $set: { status: 'processed', processedAt: new Date() } }
          );
          return outcome;
        }
        if (!existing && paymentSucceeded) {
          const operation = await matchingOperation(identity, mode, deps.OperationModel);
          if (!operation) {
            outcome = await recordUnmatchedV2Event(
              identity,
              mode,
              {
                id: subscription.id,
                customerId: idOf(subscription.customer),
                invoiceId: invoice.id,
              },
              'subscription_operation_missing',
              deps.OperationModel
            );
          } else {
            const plan = await deps.PlanModel.findById(identity.planId).lean();
            if (plan) {
              outcome = await recordActivation({
                identity,
                operation,
                mode,
                subscription,
                invoice,
                plan,
                SubscriptionModel: deps.SubscriptionModel,
                OperationModel: deps.OperationModel,
                UsageModel: deps.UsageModel,
              });
            } else {
              await setOperationReconciliation(operation, 'subscription_plan_missing', deps.OperationModel);
              outcome = { handled: 'subscription_reconciliation_required' };
            }
          }
        } else if (!existing && paymentFailed) {
          const operation = await matchingOperation(identity, mode, deps.OperationModel);
          if (operation) {
            await deps.OperationModel.updateOne(
              { _id: operation._id, status: 'pending' },
              {
                $set: {
                  stripeInvoiceId: invoice.id,
                  lastErrorCode: 'initial_payment_failed',
                  lastErrorMessage: 'Stripe reported an unsuccessful initial subscription payment.',
                },
                $inc: { attempts: 1 },
              }
            );
            outcome = { handled: 'subscription_initial_payment_failed' };
          } else {
            outcome = await recordUnmatchedV2Event(
              identity,
              mode,
              {
                id: subscription.id,
                customerId: idOf(subscription.customer),
                invoiceId: invoice.id,
              },
              'subscription_initial_payment_operation_missing',
              deps.OperationModel
            );
          }
        } else if (!existing) {
          outcome = { handled: 'subscription_payment_not_confirmed' };
        } else if (existing && String(existing.planId) !== identity.planId.toString()) {
          const operation = await findManagementOperation(
            identity,
            mode,
            subscription.id,
            deps.OperationModel
          );
          const plan = await deps.PlanModel.findById(identity.planId).lean();
          if (!plan) throw new Error('subscription_plan_change_plan_missing');
          if (paymentSucceeded) {
            outcome = await applyVerifiedPlanChange({
              identity,
              operation,
              mode,
              subscription,
              invoice,
              existing,
              plan,
              stripe,
              SubscriptionModel: deps.SubscriptionModel,
              OperationModel: deps.OperationModel,
              UsageModel: deps.UsageModel,
            });
          } else if (paymentFailed && operation?.operationType === 'upgrade') {
            outcome = await updateSubscriptionState({
              mode,
              subscription,
              failedPayment: true,
              failureAt: asDate(event.created),
              SubscriptionModel: deps.SubscriptionModel,
              OperationModel: deps.OperationModel,
              PlanModel: deps.PlanModel,
              UsageModel: deps.UsageModel,
            });
            await setOperationReconciliation(
              operation,
              'upgrade_payment_failed',
              deps.OperationModel
            );
            outcome = { handled: 'subscription_upgrade_payment_failed' };
          } else {
            throw new Error('subscription_record_owner_mismatch');
          }
        } else if (existing) {
          let recoveredBeforeStateUpdate = false;
          if (paymentSucceeded && existing.paymentRecoveryStatus === 'retrying') {
            recoveredBeforeStateUpdate = await recoveryPolicy.markRecovered({
              record: existing,
              invoice,
              subscription,
              now: new Date(),
            }, {
              SubscriptionModel: deps.SubscriptionModel,
              EmailModel: deps.RecoveryEmailModel,
              env: deps.env,
            });
            if (!recoveredBeforeStateUpdate) {
              const paidAt = asDate(invoice.status_transitions?.paid_at);
              if (paidAt && existing.gracePeriodEndsAt instanceof Date &&
                paidAt >= existing.gracePeriodEndsAt) {
                await recoveryPolicy.recordLatePayment(existing, invoice, {
                  SubscriptionModel: deps.SubscriptionModel,
                  OperationModel: deps.OperationModel,
                });
                outcome = { handled: 'subscription_late_payment_reconciliation_required' };
              } else {
                outcome = { handled: 'subscription_payment_after_recovery_deadline' };
              }
            }
          }
          if (!paymentSucceeded || existing.paymentRecoveryStatus !== 'retrying' || recoveredBeforeStateUpdate) {
            outcome = await updateSubscriptionState({
              mode,
              subscription,
              invoice: paymentSucceeded ? invoice : null,
              failedPayment: paymentFailed,
              failureAt: asDate(event.created),
              SubscriptionModel: deps.SubscriptionModel,
              OperationModel: deps.OperationModel,
              PlanModel: deps.PlanModel,
              UsageModel: deps.UsageModel,
            });
          }
          if (paymentFailed && invoice.billing_reason === 'subscription_cycle') {
            await recoveryPolicy.startRecovery({
              record: existing,
              invoice,
              subscription,
              mode,
              now: asDate(event.created) || new Date(),
            }, {
              SubscriptionModel: deps.SubscriptionModel,
              UsageModel: deps.UsageModel,
              EmailModel: deps.RecoveryEmailModel,
              env: deps.env,
            });
          } else if (paymentSucceeded && existing.paymentRecoveryStatus !== 'retrying') {
            await recoveryPolicy.markRecovered({
              record: existing,
              invoice,
              subscription,
              now: new Date(),
            }, {
              SubscriptionModel: deps.SubscriptionModel,
              EmailModel: deps.RecoveryEmailModel,
              env: deps.env,
            });
          }
          const operation = await findManagementOperation(
            identity,
            mode,
            subscription.id,
            deps.OperationModel
          );
          if (operation && ['cancel', 'resume'].includes(operation.operationType)) {
            await completeLifecycleOperation(operation, deps.OperationModel, {
              stripeInvoiceId: invoice.id,
            });
          }
          if (paymentFailed) {
            await deps.OperationModel.findOneAndUpdate(
              { stripeMode: mode, operationId: `invoice:${invoice.id}` },
              {
                $setOnInsert: {
                  operationId: `invoice:${invoice.id}`,
                  idempotencyKey: `invoice:${invoice.id}`,
                  stripeMode: mode,
                  operationType: 'renewal_recovery',
                  status: 'pending',
                  userId: existing.userId,
                  subscriptionId: existing._id,
                },
                $set: {
                  stripeInvoiceId: invoice.id,
                  lastErrorCode: 'invoice_payment_failed',
                  lastErrorMessage: 'Stripe reported an unsuccessful subscription invoice payment.',
                },
                $inc: { attempts: 1 },
              },
              { upsert: true, new: true }
            );
          }
        }
      }
    } else {
      outcome = { handled: 'subscription_event_ignored' };
    }

    await deps.EventModel.updateOne(
      { _id: claim.record._id, status: 'processing' },
      { $set: { status: 'processed', processedAt: new Date() }, $unset: { nextAttemptAt: 1 } }
    );
    return outcome || { handled: 'subscription_event_ignored' };
  } catch (err) {
    await deps.EventModel.updateOne(
      { _id: claim.record._id, status: 'processing' },
      {
        $set: {
          status: 'failed',
          lastFailureAt: new Date(),
          nextAttemptAt: new Date(Date.now() + 60 * 1000),
          lastErrorCode: err.code || 'subscription_webhook_failed',
          lastErrorMessage: 'Subscription event processing failed.',
        },
      }
    );
    throw err;
  }
}

module.exports = {
  BILLABLE_STATUSES,
  STALE_CLAIM_MS,
  isV2Metadata,
  processVerifiedEvent,
};
