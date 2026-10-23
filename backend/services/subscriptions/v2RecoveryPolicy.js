const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionUsagePeriod = require('../../models/SubscriptionUsagePeriod');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const SubscriptionRecoveryEmailV2 = require('../../models/SubscriptionRecoveryEmailV2');
const User = require('../../models/User');
const { getStripeForMode } = require('../../config/stripe');
const { sendSubscriptionRecoveryEmail } = require('../../utils/emailService');

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
/**
 * A late payment (after the grace deadline) waits for manual reconciliation; the worker
 * cannot resolve it. It used to clear the lease, so every such record was re-selected
 * every minute and, with the batch capped at 50, could crowd out real expiries.
 * ponytail: parked for a day at a time; >50 unresolved late payments per day would
 * still need an index-backed exclusion.
 */
const LATE_PAYMENT_PARK_MS = 24 * 60 * 60 * 1000;
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

/**
 * Void the unpaid renewal invoice after a grace-expiry cancellation (policy Option A).
 * Default OFF: business/accounting approval is required before it may run anywhere.
 */
function graceExpiryInvoiceVoidEnabled(env = process.env) {
  return env.SUBSCRIPTION_V2_GRACE_EXPIRY_INVOICE_VOID_ENABLED === 'true';
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
  // Grace keeps the LAST PAID period's allowance. This used to look for paid usage
  // starting exactly at record.currentPeriodStart — but by the time a renewal fails,
  // customer.subscription.updated (and updateSubscriptionState on the failure itself)
  // has already moved currentPeriodStart to the new, unpaid period, which never has a
  // paid usage row. So in real renewals grace never started: no emails, straight to free.
  // Take the newest paid period that reaches currentPeriodStart (the one just ended,
  // or the current one if the record has not advanced yet); never an older one.
  const anchor = record.currentPeriodStart;
  if (!anchor) return { started: false, noPaidUsage: true };
  const paidUsage = await deps.UsageModel.findOne({
    userId: record.userId,
    subscriptionId: record._id,
    periodType: 'paid',
    billingPeriodStart: { $lte: anchor },
    billingPeriodEnd: { $gte: anchor },
  })
    .sort({ billingPeriodStart: -1 })
    .lean();
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
    OperationModel: SubscriptionBillingOperationV2,
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
  if (updated) {
    // The unpaid renewal's own operation stayed 'pending' forever after the subscription
    // ended. Its outcome is final now: it failed. (A later payment of the still-open
    // invoice moves it to reconciliation_required via recordLatePayment.)
    await deps.OperationModel.updateOne(
      { stripeMode: record.stripeMode, operationId: `invoice:${invoice.id}`, status: 'pending' },
      {
        $set: {
          status: 'failed',
          lastErrorCode: 'renewal_unpaid_subscription_canceled',
          lastErrorMessage: 'The renewal was not paid within the grace period; the subscription was canceled.',
        },
      }
    );
  }
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
  const at = (overrides.now || (() => new Date()))();
  await deps.SubscriptionModel.updateOne(
    {
      _id: record._id,
      recoveryInvoiceId: invoice.id,
      paymentRecoveryStatus: 'retrying',
    },
    {
      $set: { recoveryLeaseUntil: new Date(at.getTime() + LATE_PAYMENT_PARK_MS) },
      $push: {
        recoveryHistory: {
          invoiceId: invoice.id,
          action: 'late_payment_reconciliation_required',
          at,
        },
      },
    }
  );
  return operation;
}

const VOID_MAX_ATTEMPTS = 5;

function isRetryableStripeError(err) {
  return (
    ['StripeConnectionError', 'StripeAPIError', 'StripeRateLimitError'].includes(err?.type) ||
    ['ETIMEDOUT', 'ECONNRESET', 'lock_timeout', 'rate_limit'].includes(err?.code) ||
    Number(err?.statusCode) >= 500
  );
}

/**
 * Void the failed-renewal invoice of a subscription that THIS worker canceled at the end
 * of its 7-day grace (policy Option A, gated by SUBSCRIPTION_V2_GRACE_EXPIRY_INVOICE_VOID_ENABLED).
 *
 * Without this, the 99 NOK renewal invoice stays `open` and payable (hosted invoice page,
 * portal, Stripe emails) after the subscription is gone, so a customer can pay for nothing
 * and finance carries a stale receivable.
 *
 * Which invoice: only record.recoveryInvoiceId — the exact invoice the grace was opened
 * for — never "the customer's latest invoice". It must belong to this subscription,
 * customer and mode, be a subscription_cycle invoice, and the grace-expiry cancellation
 * operation for exactly that subscription+invoice must have succeeded.
 *
 * Who may start it: only the worker's own cancellation path (`start: true`) creates the
 * void operation. A subscription found already canceled (customer/portal/Stripe) never
 * gets one, so voluntary cancellations are never voided. Retries (`start: false`) only
 * continue an operation that already exists.
 *
 * Races: the invoice is re-read right before voiding; paid -> the existing late-payment
 * policy (reconciliation, nothing restored); payment in flight -> retry later; void
 * failing because a payment just won -> re-read and treat as paid.
 */
async function voidGraceExpiredInvoice({ record, stripe, now = new Date(), start = false }, overrides = {}) {
  const deps = {
    SubscriptionModel: SubscriptionV2,
    OperationModel: SubscriptionBillingOperationV2,
    ...overrides,
  };
  if (!graceExpiryInvoiceVoidEnabled(deps.env || process.env)) return { skipped: 'disabled' };
  const mode = record?.stripeMode;
  const invoiceId = record?.recoveryInvoiceId;
  const subscriptionId = record?.stripeSubscriptionId;
  if (!invoiceId || !subscriptionId || !['test', 'live'].includes(mode)) return { skipped: 'no_recovery_invoice' };

  const expiry = await deps.OperationModel.findOne({
    stripeMode: mode,
    operationId: `grace-expiry:${subscriptionId}:${invoiceId}`,
  }).lean();
  if (
    !expiry ||
    expiry.status !== 'succeeded' ||
    expiry.operationType !== 'renewal_recovery' ||
    expiry.stripeInvoiceId !== invoiceId ||
    expiry.stripeSubscriptionId !== subscriptionId ||
    String(expiry.subscriptionId) !== String(record._id)
  ) return { skipped: 'not_a_confirmed_grace_expiry' };

  const current = await deps.SubscriptionModel.findById(record._id).lean();
  if (
    !current ||
    current.status !== 'canceled' ||
    current.paymentRecoveryStatus !== 'exhausted' ||
    current.recoveryInvoiceId !== invoiceId ||
    current.stripeSubscriptionId !== subscriptionId ||
    current.stripeMode !== mode
  ) return { skipped: 'record_not_exhausted' };

  const operationId = `grace-expiry-void:${subscriptionId}:${invoiceId}`;
  const idempotencyKey = `jobblo-subv2-${mode}-${operationId}`;
  const operation = start
    ? await deps.OperationModel.findOneAndUpdate(
        { stripeMode: mode, operationId },
        {
          $setOnInsert: {
            operationId,
            idempotencyKey,
            stripeMode: mode,
            operationType: 'renewal_recovery',
            status: 'pending',
            userId: current.userId,
            subscriptionId: current._id,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: current.stripeCustomerId,
            stripeInvoiceId: invoiceId,
          },
        },
        { upsert: true, new: true }
      ).lean()
    : await deps.OperationModel.findOne({ stripeMode: mode, operationId }).lean();
  if (!operation) return { skipped: 'no_void_operation' };
  if (operation.status !== 'pending') return { skipped: `already_${operation.status}` };
  if (
    operation.idempotencyKey !== idempotencyKey ||
    operation.stripeInvoiceId !== invoiceId ||
    operation.stripeSubscriptionId !== subscriptionId ||
    String(operation.subscriptionId) !== String(current._id)
  ) throw new Error('invoice_void_operation_ownership_mismatch');

  const finish = async (status, fields = {}) => {
    await deps.OperationModel.updateOne(
      { _id: operation._id, status: 'pending' },
      { $set: { status, attemptedAt: now, ...fields } }
    );
    return { status, ...fields };
  };
  const review = (code) => finish('reconciliation_required', {
    lastErrorCode: code,
    lastErrorMessage: 'Grace-expiry invoice void needs manual review.',
  });
  const paidMeanwhile = async (invoice) => {
    // A payment won the race: existing late-payment policy, nothing restored.
    await recordLatePayment(current, invoice, deps);
    return finish('failed', { lastErrorCode: 'invoice_paid_before_void', lastErrorMessage: 'The invoice was paid before it could be voided.' });
  };
  const retryLater = async (code) => {
    if ((operation.attempts || 0) + 1 >= VOID_MAX_ATTEMPTS) return review(code);
    await deps.OperationModel.updateOne(
      { _id: operation._id, status: 'pending' },
      { $set: { lastErrorCode: code, attemptedAt: now }, $inc: { attempts: 1 } }
    );
    return { status: 'pending', retry: true, lastErrorCode: code };
  };

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!isOwnedSubscription(subscription, current, mode) || subscription.status !== 'canceled') {
      return review('void_subscription_unverified');
    }
    // Authoritative state, read immediately before the irreversible void.
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (!invoiceMatchesSubscription(invoice, current, mode) || invoice.billing_reason !== 'subscription_cycle') {
      return review('void_invoice_unverified');
    }
    if (invoice.status === 'void') return finish('succeeded', { completedAt: now, lastErrorCode: null });
    if (invoice.status === 'paid') return paidMeanwhile(invoice);
    if (invoice.status !== 'open') return review(`void_invoice_not_open_${invoice.status}`);
    if ((invoice.amount_paid || 0) > 0) return review('void_invoice_partially_paid');

    const payments = await stripe.invoicePayments.list({
      invoice: invoiceId,
      limit: 100,
      expand: ['data.payment.payment_intent'],
    });
    const inFlight = (payments.data || []).some((p) =>
      p.status === 'paid' ||
      ['processing', 'requires_capture', 'succeeded'].includes(p.payment?.payment_intent?.status)
    );
    if (inFlight) return retryLater('payment_in_progress');

    const voided = await stripe.invoices.voidInvoice(invoiceId, {}, { idempotencyKey });
    if (voided?.id !== invoiceId || voided.status !== 'void') return review('void_unconfirmed');
    await deps.SubscriptionModel.updateOne(
      { _id: current._id, recoveryInvoiceId: invoiceId },
      { $push: { recoveryHistory: { invoiceId, action: 'renewal_invoice_voided', at: now, operationId } } }
    );
    return finish('succeeded', { completedAt: now, lastErrorCode: null });
  } catch (err) {
    // The void may have lost to a payment, or its outcome may be unknown: ask Stripe.
    try {
      const again = await stripe.invoices.retrieve(invoiceId);
      if (again?.id === invoiceId && again.status === 'paid') return paidMeanwhile(again);
      if (again?.id === invoiceId && again.status === 'void') return finish('succeeded', { completedAt: now, lastErrorCode: null });
    } catch { /* fall through */ }
    if (isRetryableStripeError(err)) return retryLater(err.code || err.type || 'stripe_unavailable');
    return review(err?.code || 'invoice_void_failed');
  }
}

/** Continue void operations left pending (timeouts, payment in flight). */
async function retryPendingInvoiceVoids(deps, now) {
  const pending = await deps.OperationModel.find({
    operationId: /^grace-expiry-void:/,
    status: 'pending',
  }).limit(20).lean();
  for (const operation of pending) {
    try {
      const record = await deps.SubscriptionModel.findById(operation.subscriptionId).lean();
      if (!record) continue;
      const stripe = await deps.stripeForMode(operation.stripeMode === 'test');
      await voidGraceExpiredInvoice({ record, stripe, now, start: false }, deps);
    } catch (error) {
      console.error('[Subscription V2] grace-expiry invoice void retry failed:', error.message);
    }
  }
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
          { $set: { recoveryLeaseUntil: new Date(now.getTime() + LATE_PAYMENT_PARK_MS) } }
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

      const paidAtOf = (inv) => (inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000)
        : null);
      const paidAt = paidAtOf(invoice);
      // Paid invoice: recovered if paid before the deadline, otherwise the existing
      // late-payment policy (manual reconciliation, access not restored).
      const settlePaid = async (paidInvoice) => {
        if (paidAtOf(paidInvoice) >= claimed.gracePeriodEndsAt) {
          await recordLatePayment(claimed, paidInvoice, deps);
          return;
        }
        const recovered = await markRecovered({ record: claimed, invoice: paidInvoice, subscription, now }, deps);
        const latestRecord = recovered ? null : await deps.SubscriptionModel.findById(claimed._id).lean();
        if (recovered || latestRecord?.paymentRecoveryStatus === 'recovered') {
          await deps.OperationModel.updateOne(
            { _id: operation._id },
            { $set: { status: 'succeeded', completedAt: now } }
          );
        }
      };
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
      if (invoice.status === 'paid' && paidAt) {
        await settlePaid(invoice);
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
      // The customer may have paid since the invoice was read above. Re-read it right
      // before the irreversible cancel, so a payment is never answered with cancellation.
      const freshInvoice = await stripe.invoices.retrieve(claimed.recoveryInvoiceId);
      if (freshInvoice.status === 'paid' && paidAtOf(freshInvoice)) {
        await settlePaid(freshInvoice);
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
      // Only here — after THIS worker canceled the subscription — may the unpaid renewal
      // invoice be voided. Its own errors are recorded on its own operation and must not
      // turn the completed cancellation into a reconciliation.
      if (graceExpiryInvoiceVoidEnabled(env)) {
        try {
          await voidGraceExpiredInvoice({ record: claimed, stripe, now, start: true }, { ...deps, env });
        } catch (voidError) {
          console.error('[Subscription V2] grace-expiry invoice void failed:', voidError.message);
        }
      }
    } catch (error) {
      await recordReconciliation(claimed, { id: claimed.recoveryInvoiceId }, operationId, error, deps);
      console.error('[Subscription V2] grace expiry requires reconciliation:', error.message);
    }
  }
  if (graceExpiryInvoiceVoidEnabled(env)) await retryPendingInvoiceVoids({ ...deps, env }, now);
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
  graceExpiryInvoiceVoidEnabled,
  voidGraceExpiredInvoice,
};
