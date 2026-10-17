const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionUsagePeriod = require('../../models/SubscriptionUsagePeriod');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const SubscriptionRecoveryEmailV2 = require('../../models/SubscriptionRecoveryEmailV2');
const User = require('../../models/User');
const { getStripeForMode } = require('../../config/stripe');
const { sendSubscriptionRecoveryEmail } = require('../../utils/emailService');

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const REMINDERS = [
  { kind: 'reminder_day_3', day: 3 },
  { kind: 'reminder_day_6', day: 6 },
];

function recoveryEnabled(env = process.env) {
  return env.SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED === 'true';
}

function recoveryJobEnabled(env = process.env) {
  return env.SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED === 'true';
}

function recoveryEmailsEnabled(env = process.env) {
  return env.SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED === 'true';
}

function idOf(value) {
  return typeof value === 'string' ? value : value?.id;
}

function isOwnedSubscription(subscription, record, mode) {
  return Boolean(
    subscription?.id === record.stripeSubscriptionId &&
      subscription.livemode === (mode === 'live') &&
      idOf(subscription.customer) === record.stripeCustomerId &&
      subscription.metadata?.subscriptionV2 === 'true' &&
      String(subscription.metadata?.userId) === String(record.userId) &&
      String(subscription.metadata?.planId) === String(record.planId) &&
      subscription.metadata?.stripeMode === mode
  );
}

function invoiceMatchesSubscription(invoice, record, mode) {
  return Boolean(
    invoice?.id === record.recoveryInvoiceId &&
      invoice.livemode === (mode === 'live') &&
      idOf(invoice.customer) === record.stripeCustomerId &&
      idOf(invoice.parent?.subscription_details?.subscription) === record.stripeSubscriptionId
  );
}

async function enqueueEmail(record, invoiceId, kind, scheduledAt, EmailModel) {
  await EmailModel.updateOne(
    { stripeMode: record.stripeMode, invoiceId, kind },
    {
      $setOnInsert: {
        subscriptionId: record._id,
        userId: record.userId,
        stripeMode: record.stripeMode,
        invoiceId,
        kind,
        scheduledAt,
        status: 'pending',
        attempts: 0,
      },
    },
    { upsert: true }
  );
}

function reminderSchedule(env) {
  const configured = env.SUBSCRIPTION_V2_RECOVERY_REMINDER_DAYS;
  if (!configured) return REMINDERS;
  const days = [...new Set(configured.split(',').map(Number))]
    .filter((day) => Number.isInteger(day) && day > 0 && day < 7)
    .sort((a, b) => a - b);
  return days.map((day) => ({ kind: `reminder_day_${day}`, day }));
}

async function enqueueRecoveryEmails(record, invoiceId, at, EmailModel, env) {
  if (!recoveryEmailsEnabled(env)) return;
  await enqueueEmail(record, invoiceId, 'payment_failed', at, EmailModel);
  for (const reminder of reminderSchedule(env)) {
    await enqueueEmail(
      record,
      invoiceId,
      reminder.kind,
      new Date(at.getTime() + reminder.day * 24 * 60 * 60 * 1000),
      EmailModel
    );
  }
}

async function startRecovery({ record, invoice, subscription, mode, now = new Date() }, overrides = {}) {
  if (!recoveryEnabled(overrides.env || process.env)) return { started: false, disabled: true };
  if (
    mode !== record.stripeMode ||
    invoice?.billing_reason !== 'subscription_cycle' ||
    invoice.livemode !== (mode === 'live') ||
    idOf(invoice.customer) !== record.stripeCustomerId ||
    idOf(invoice.parent?.subscription_details?.subscription) !== record.stripeSubscriptionId ||
    (subscription && !['active', 'past_due', 'unpaid'].includes(subscription.status)) ||
    (subscription && !isOwnedSubscription(subscription, record, mode))
  ) return { started: false, ignored: true };

  const deps = {
    SubscriptionModel: SubscriptionV2,
    UsageModel: SubscriptionUsagePeriod,
    EmailModel: SubscriptionRecoveryEmailV2,
    ...overrides,
  };
  const usageStart = record.currentPeriodStart;
  if (!usageStart) return { started: false, noPaidUsage: true };
  const paidUsage = await deps.UsageModel.findOne({
    userId: record.userId,
    subscriptionId: record._id,
    periodType: 'paid',
    billingPeriodStart: usageStart,
  }).lean();
  if (!paidUsage) return { started: false, noPaidUsage: true };

  const existing = await deps.SubscriptionModel.findOne({
    _id: record._id,
    recoveryInvoiceId: invoice.id,
  }).lean();
  if (existing) {
    if (existing.paymentRecoveryStatus === 'retrying') {
      await enqueueRecoveryEmails(
        existing,
        invoice.id,
        existing.firstPaymentFailureAt || now,
        deps.EmailModel,
        overrides.env || process.env
      );
    }
    return { started: false, duplicate: true, recovery: existing };
  }

  const deadline = new Date(now.getTime() + GRACE_PERIOD_MS);
  const updated = await deps.SubscriptionModel.findOneAndUpdate(
    {
      _id: record._id,
      paymentRecoveryStatus: { $in: ['none', 'recovered', 'exhausted'] },
    },
    {
      $set: {
        status: 'past_due',
        firstPaymentFailureAt: now,
        gracePeriodEndsAt: deadline,
        recoveryInvoiceId: invoice.id,
        recoveryUsagePeriodStart: paidUsage.billingPeriodStart,
        paymentRecoveryStatus: 'retrying',
        recoveryLeaseUntil: null,
      },
      $push: {
        recoveryHistory: { invoiceId: invoice.id, action: 'started', at: now },
      },
    },
    { new: true, runValidators: true }
  ).lean();
  if (!updated) return { started: false, conflictingRecovery: true };

  await enqueueRecoveryEmails(updated, invoice.id, now, deps.EmailModel, overrides.env || process.env);
  return { started: true, recovery: updated };
}

async function markRecovered({ record, invoice, subscription, now = new Date() }, overrides = {}) {
  const deps = {
    SubscriptionModel: SubscriptionV2,
    EmailModel: SubscriptionRecoveryEmailV2,
    ...overrides,
  };
  const paidAt = Number.isSafeInteger(invoice?.status_transitions?.paid_at)
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : null;
  if (
    !record ||
    !['retrying', 'recovered'].includes(record.paymentRecoveryStatus) ||
    record.recoveryInvoiceId !== invoice?.id ||
    invoice.status !== 'paid' ||
    !(record.gracePeriodEndsAt instanceof Date) ||
    !Number.isFinite(record.gracePeriodEndsAt.getTime()) ||
    !paidAt ||
    paidAt >= record.gracePeriodEndsAt ||
    !invoiceMatchesSubscription(invoice, record, record.stripeMode) ||
    !isOwnedSubscription(subscription, record, record.stripeMode) ||
    subscription.status === 'canceled'
  ) return false;

  const period = subscription.items?.data?.[0];
  const start = Number.isSafeInteger(period?.current_period_start)
    ? new Date(period.current_period_start * 1000)
    : null;
  const end = Number.isSafeInteger(period?.current_period_end)
    ? new Date(period.current_period_end * 1000)
    : null;
  if (!start || !end || end <= start) throw new Error('recovery_period_unavailable');

  const updated = record.paymentRecoveryStatus === 'recovered'
    ? record
    : await deps.SubscriptionModel.findOneAndUpdate(
        {
          _id: record._id,
          paymentRecoveryStatus: 'retrying',
          recoveryInvoiceId: invoice.id,
          status: { $ne: 'canceled' },
        },
        {
          $set: {
            status: subscription.cancel_at_period_end ? 'canceling' : 'active',
            currentPeriodStart: start,
            currentPeriodEnd: end,
            nextRenewalAt: end,
            autoRenew: !subscription.cancel_at_period_end,
            paymentRecoveryStatus: 'recovered',
            recoveryLeaseUntil: null,
          },
          $push: {
            recoveryHistory: { invoiceId: invoice.id, action: 'recovered', at: now },
          },
        },
        { new: true }
      ).lean();
  if (!updated) return false;

  await deps.EmailModel.updateMany(
    {
      stripeMode: record.stripeMode,
      invoiceId: invoice.id,
      kind: { $in: ['payment_failed', ...reminderSchedule(overrides.env || process.env).map(({ kind }) => kind)] },
      status: { $in: ['pending', 'sending'] },
    },
    { $set: { status: 'canceled' } }
  );
  if (recoveryEmailsEnabled(overrides.env || process.env)) {
    await enqueueEmail(updated, invoice.id, 'payment_recovered', now, deps.EmailModel);
  }
  return true;
}

async function markCanceled(record, invoice, operationId, overrides = {}) {
  const deps = {
    SubscriptionModel: SubscriptionV2,
    EmailModel: SubscriptionRecoveryEmailV2,
    ...overrides,
  };
  const now = (overrides.now || (() => new Date()))();
  const updated = await deps.SubscriptionModel.findOneAndUpdate(
    {
      _id: record._id,
      recoveryInvoiceId: invoice.id,
      paymentRecoveryStatus: 'retrying',
    },
    {
      $set: {
        status: 'canceled',
        autoRenew: false,
        cancellationEffectiveAt: now,
        paymentRecoveryStatus: 'exhausted',
        recoveryLeaseUntil: null,
      },
      $push: {
        recoveryHistory: { invoiceId: invoice.id, action: 'canceled', at: now, operationId },
      },
    },
    { new: true }
  ).lean();
  if (updated && recoveryEmailsEnabled(overrides.env || process.env)) {
    await deps.EmailModel.updateMany(
      {
        stripeMode: record.stripeMode,
        invoiceId: invoice.id,
        kind: { $in: ['payment_failed', ...reminderSchedule(overrides.env || process.env).map(({ kind }) => kind)] },
        status: { $in: ['pending', 'sending'] },
      },
      { $set: { status: 'canceled' } }
    );
    await enqueueEmail(updated, invoice.id, 'subscription_canceled', now, deps.EmailModel);
  }
  return Boolean(updated);
}

async function recordReconciliation(record, invoice, operationId, error, overrides = {}) {
  const deps = {
    SubscriptionModel: SubscriptionV2,
    OperationModel: SubscriptionBillingOperationV2,
    ...overrides,
  };
  await deps.SubscriptionModel.updateOne(
    { _id: record._id, recoveryInvoiceId: invoice.id, paymentRecoveryStatus: 'retrying' },
    {
      $set: { recoveryLeaseUntil: null },
      $push: {
        recoveryHistory: {
          invoiceId: invoice.id,
          action: 'reconciliation_required',
          at: (overrides.now || (() => new Date()))(),
          operationId,
        },
      },
    }
  );
  await deps.OperationModel.updateOne(
    { stripeMode: record.stripeMode, operationId },
    {
      $set: {
        status: 'reconciliation_required',
        lastErrorCode: error.code || 'stripe_recovery_outcome_unknown',
        lastErrorMessage: 'Stripe recovery cancellation requires reconciliation.',
      },
    }
  );
}

async function recordLatePayment(record, invoice, overrides = {}) {
  const deps = {
    SubscriptionModel: SubscriptionV2,
    OperationModel: SubscriptionBillingOperationV2,
    ...overrides,
  };
  const operationId = `invoice:${invoice.id}`;
  const operation = await deps.OperationModel.findOneAndUpdate(
    { stripeMode: record.stripeMode, operationId },
    {
      $setOnInsert: {
        operationId,
        idempotencyKey: operationId,
        stripeMode: record.stripeMode,
        operationType: 'renewal_recovery',
        userId: record.userId,
        subscriptionId: record._id,
      },
      $set: {
        status: 'reconciliation_required',
        stripeInvoiceId: invoice.id,
        lastErrorCode: 'late_payment_after_grace',
        lastErrorMessage: 'Payment was collected after the recovery deadline and requires reconciliation.',
      },
    },
    { upsert: true, new: true }
  );
  await deps.SubscriptionModel.updateOne(
    {
      _id: record._id,
      recoveryInvoiceId: invoice.id,
      paymentRecoveryStatus: 'retrying',
    },
    {
      $set: { recoveryLeaseUntil: null },
      $push: {
        recoveryHistory: {
          invoiceId: invoice.id,
          action: 'late_payment_reconciliation_required',
          at: (overrides.now || (() => new Date()))(),
        },
      },
    }
  );
  return operation;
}

async function cancelExpiredRecoveries(overrides = {}) {
  const env = overrides.env || process.env;
  if (!recoveryJobEnabled(env) || !recoveryEnabled(env)) return { skipped: true, processed: 0 };
  const deps = {
    SubscriptionModel: SubscriptionV2,
    OperationModel: SubscriptionBillingOperationV2,
    EmailModel: SubscriptionRecoveryEmailV2,
    stripeForMode: async (testMode) => getStripeForMode(testMode),
    now: () => new Date(),
    ...overrides,
  };
  const now = deps.now();
  const candidates = await deps.SubscriptionModel.find({
    paymentRecoveryStatus: 'retrying',
    gracePeriodEndsAt: { $lte: now },
    status: { $ne: 'canceled' },
    $or: [{ recoveryLeaseUntil: null }, { recoveryLeaseUntil: { $lte: now } }],
  }).limit(50).lean();
  let processed = 0;

  for (const candidate of candidates) {
    const claimed = await deps.SubscriptionModel.findOneAndUpdate(
      {
        _id: candidate._id,
        paymentRecoveryStatus: 'retrying',
        recoveryInvoiceId: candidate.recoveryInvoiceId,
        gracePeriodEndsAt: { $lte: now },
        $or: [{ recoveryLeaseUntil: null }, { recoveryLeaseUntil: { $lte: now } }],
      },
      { $set: { recoveryLeaseUntil: new Date(now.getTime() + LEASE_MS) } },
      { new: true }
    ).lean();
    if (!claimed) continue;

    const operationId = `grace-expiry:${claimed.stripeSubscriptionId}:${claimed.recoveryInvoiceId}`;
    const idempotencyKey = `jobblo-subv2-${claimed.stripeMode}-${operationId}`;
    try {
      const operation = await deps.OperationModel.findOneAndUpdate(
        { stripeMode: claimed.stripeMode, operationId },
        {
          $setOnInsert: {
            operationId,
            idempotencyKey,
            stripeMode: claimed.stripeMode,
            operationType: 'renewal_recovery',
            status: 'pending',
            userId: claimed.userId,
            subscriptionId: claimed._id,
            stripeSubscriptionId: claimed.stripeSubscriptionId,
            stripeCustomerId: claimed.stripeCustomerId,
            stripeInvoiceId: claimed.recoveryInvoiceId,
          },
        },
        { upsert: true, new: true }
      );
      if (
        !operation ||
        operation.operationType !== 'renewal_recovery' ||
        operation.stripeMode !== claimed.stripeMode ||
        operation.idempotencyKey !== idempotencyKey ||
        String(operation.userId) !== String(claimed.userId) ||
        String(operation.subscriptionId) !== String(claimed._id) ||
        operation.stripeSubscriptionId !== claimed.stripeSubscriptionId ||
        operation.stripeInvoiceId !== claimed.recoveryInvoiceId
      ) {
        throw new Error('recovery_operation_ownership_mismatch');
      }
      if (
        operation.status === 'reconciliation_required' &&
        operation.lastErrorCode === 'late_payment_after_grace'
      ) {
        await deps.SubscriptionModel.updateOne(
          { _id: claimed._id, recoveryInvoiceId: claimed.recoveryInvoiceId },
          { $set: { recoveryLeaseUntil: null } }
        );
        processed += 1;
        continue;
      }
      const stripe = await deps.stripeForMode(claimed.stripeMode === 'test');
      const subscription = await stripe.subscriptions.retrieve(claimed.stripeSubscriptionId, {
        expand: ['latest_invoice'],
      });
      const invoice = await stripe.invoices.retrieve(claimed.recoveryInvoiceId);
      if (
        !isOwnedSubscription(subscription, claimed, claimed.stripeMode) ||
        !invoiceMatchesSubscription(invoice, claimed, claimed.stripeMode)
      ) throw new Error('recovery_stripe_ownership_unverified');

      const paidAt = invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null;
      if (subscription.status === 'canceled') {
        if (!await markCanceled(claimed, invoice, operationId, deps)) {
          throw new Error('recovery_state_changed_during_cancellation');
        }
        await deps.OperationModel.updateOne(
          { _id: operation._id },
          { $set: { status: 'succeeded', completedAt: now } }
        );
        processed += 1;
        continue;
      }
      if (
        invoice.status === 'paid' &&
        paidAt
      ) {
        if (paidAt >= claimed.gracePeriodEndsAt) {
          await recordLatePayment(claimed, invoice, deps);
          processed += 1;
          continue;
        }
        const recovered = await markRecovered({ record: claimed, invoice, subscription, now }, deps);
        if (recovered) {
          await deps.OperationModel.updateOne(
            { _id: operation._id },
            { $set: { status: 'succeeded', completedAt: now } }
          );
        } else {
          const latestRecord = await deps.SubscriptionModel.findById(claimed._id).lean();
          if (latestRecord?.paymentRecoveryStatus === 'recovered') {
            await deps.OperationModel.updateOne(
              { _id: operation._id },
              { $set: { status: 'succeeded', completedAt: now } }
            );
          }
        }
        processed += 1;
        continue;
      }

      const latestRecord = await deps.SubscriptionModel.findById(claimed._id).lean();
      if (
        !latestRecord ||
        latestRecord.paymentRecoveryStatus !== 'retrying' ||
        latestRecord.recoveryInvoiceId !== claimed.recoveryInvoiceId
      ) {
        processed += 1;
        continue;
      }
      if (subscription.status !== 'canceled') {
        await stripe.subscriptions.cancel(
          claimed.stripeSubscriptionId,
          { invoice_now: false, prorate: false },
          { idempotencyKey: operation.idempotencyKey }
        );
      }
      const finalSubscription = await stripe.subscriptions.retrieve(claimed.stripeSubscriptionId);
      if (!isOwnedSubscription(finalSubscription, claimed, claimed.stripeMode) ||
        finalSubscription.status !== 'canceled') {
        throw new Error('recovery_cancellation_unconfirmed');
      }
      if (!await markCanceled(claimed, invoice, operationId, deps)) {
        throw new Error('recovery_state_changed_during_cancellation');
      }
      await deps.OperationModel.updateOne(
        { _id: operation._id },
        { $set: { status: 'succeeded', completedAt: now } }
      );
      processed += 1;
    } catch (error) {
      await recordReconciliation(claimed, { id: claimed.recoveryInvoiceId }, operationId, error, deps);
      console.error('[Subscription V2] grace expiry requires reconciliation:', error.message);
    }
  }
  return { scanned: candidates.length, processed };
}

async function dispatchRecoveryEmails(overrides = {}) {
  const env = overrides.env || process.env;
  if (!recoveryEmailsEnabled(env)) return { skipped: true, sent: 0 };
  const deps = {
    EmailModel: SubscriptionRecoveryEmailV2,
    SubscriptionModel: SubscriptionV2,
    UserModel: User,
    sendEmail: sendSubscriptionRecoveryEmail,
    now: () => new Date(),
    ...overrides,
  };
  const now = deps.now();
  const staleSendingBefore = new Date(now.getTime() - LEASE_MS);
  const due = await deps.EmailModel.find({
    scheduledAt: { $lte: now },
    $and: [
      {
        $or: [
          { status: 'pending' },
          { status: 'sending', claimedAt: { $lte: staleSendingBefore } },
        ],
      },
      { $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
    ],
  }).sort({ scheduledAt: 1 }).limit(50).lean();
  let sent = 0;

  for (const item of due) {
    const claimed = await deps.EmailModel.findOneAndUpdate(
      item.status === 'sending'
        ? { _id: item._id, status: 'sending', claimedAt: item.claimedAt }
        : { _id: item._id, status: 'pending' },
      { $set: { status: 'sending', claimedAt: now }, $inc: { attempts: 1 } },
      { new: true }
    ).lean();
    if (!claimed) continue;
    try {
      const subscription = await deps.SubscriptionModel.findById(item.subscriptionId).lean();
      const reminder = item.kind === 'payment_failed' || /^reminder_day_[1-6]$/.test(item.kind);
      if (reminder && (
        !subscription ||
        subscription.paymentRecoveryStatus !== 'retrying' ||
        subscription.recoveryInvoiceId !== item.invoiceId ||
        subscription.gracePeriodEndsAt <= now
      )) {
        await deps.EmailModel.updateOne({ _id: item._id, status: 'sending' }, { $set: { status: 'canceled' } });
        continue;
      }
      if (item.kind === 'payment_recovered' && subscription?.paymentRecoveryStatus !== 'recovered') {
        await deps.EmailModel.updateOne({ _id: item._id, status: 'sending' }, { $set: { status: 'canceled' } });
        continue;
      }
      if (item.kind === 'subscription_canceled' && subscription?.paymentRecoveryStatus !== 'exhausted') {
        await deps.EmailModel.updateOne({ _id: item._id, status: 'sending' }, { $set: { status: 'canceled' } });
        continue;
      }
      const user = await deps.UserModel.findById(item.userId).select('email name').lean();
      if (!user?.email) throw new Error('recovery_email_recipient_missing');
      await deps.sendEmail({
        to: user.email,
        name: user.name,
        kind: item.kind,
        gracePeriodEndsAt: subscription?.gracePeriodEndsAt,
        frontendUrl: env.FRONTEND_URL,
      });
      await deps.EmailModel.updateOne(
        { _id: item._id, status: 'sending' },
        { $set: { status: 'sent', sentAt: now }, $unset: { lastError: 1 } }
      );
      sent += 1;
    } catch (error) {
      const delay = Math.min(60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(item.attempts || 0, 6)));
      await deps.EmailModel.updateOne(
        { _id: item._id, status: 'sending' },
        {
          $set: {
            status: 'pending',
            nextAttemptAt: new Date(now.getTime() + delay),
            lastError: String(error.message || error).slice(0, 500),
          },
          $unset: { claimedAt: 1 },
        }
      );
    }
  }
  return { scanned: due.length, sent };
}

module.exports = {
  GRACE_PERIOD_MS,
  recoveryEnabled,
  recoveryJobEnabled,
  recoveryEmailsEnabled,
  reminderSchedule,
  isOwnedSubscription,
  invoiceMatchesSubscription,
  startRecovery,
  markRecovered,
  markCanceled,
  recordLatePayment,
  cancelExpiredRecoveries,
  dispatchRecoveryEmails,
};
