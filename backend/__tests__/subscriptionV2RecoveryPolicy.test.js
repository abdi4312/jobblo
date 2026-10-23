jest.mock('../models/SubscriptionV2', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/SubscriptionUsagePeriod', () => ({ findOne: jest.fn() }));
jest.mock('../models/SubscriptionBillingOperationV2', () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/SubscriptionRecoveryEmailV2', () => ({
  updateOne: jest.fn(),
  updateMany: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripeForMode: jest.fn() }));
jest.mock('../utils/emailService', () => ({ sendSubscriptionRecoveryEmail: jest.fn() }));

const mongoose = require('mongoose');
const Subscription = require('../models/SubscriptionV2');
const Usage = require('../models/SubscriptionUsagePeriod');
const Operation = require('../models/SubscriptionBillingOperationV2');
const RecoveryEmail = require('../models/SubscriptionRecoveryEmailV2');
const User = require('../models/User');
const {
  GRACE_PERIOD_MS,
  recoveryEnabled,
  recoveryJobEnabled,
  recoveryEmailsEnabled,
  reminderSchedule,
  startRecovery,
  markRecovered,
  cancelExpiredRecoveries,
  dispatchRecoveryEmails,
} = require('../services/subscriptions/v2RecoveryPolicy');

const now = new Date('2026-10-17T10:00:00.000Z');
const userId = new mongoose.Types.ObjectId();
const subscriptionId = new mongoose.Types.ObjectId();
const planId = new mongoose.Types.ObjectId();
const periodStart = new Date('2026-09-17T10:00:00.000Z');
const periodEnd = now;

function query(value) {
  return {
    lean: async () => value,
    sort() { return this; },
    limit() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

function recoveryRecord(overrides = {}) {
  return {
    _id: subscriptionId,
    userId,
    stripeMode: 'test',
    stripeSubscriptionId: 'sub_test',
    stripeCustomerId: 'cus_test',
    planId,
    status: 'past_due',
    currentPeriodStart: periodStart,
    paymentRecoveryStatus: 'none',
    metadata: undefined,
    ...overrides,
  };
}

function invoice(overrides = {}) {
  return {
    id: 'in_failed',
    billing_reason: 'subscription_cycle',
    livemode: false,
    customer: 'cus_test',
    status: 'open',
    parent: { subscription_details: { subscription: 'sub_test' } },
    ...overrides,
  };
}

function stripeSubscription(overrides = {}) {
  return {
    id: 'sub_test',
    customer: 'cus_test',
    livemode: false,
    status: 'active',
    cancel_at_period_end: false,
    metadata: {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(planId),
      stripeMode: 'test',
    },
    items: {
      data: [{
        current_period_start: periodStart.getTime() / 1000,
        current_period_end: periodEnd.getTime() / 1000,
      }],
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Usage.findOne.mockReturnValue(query({
    _id: new mongoose.Types.ObjectId(),
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    periodType: 'paid',
    consumedIncludedContacts: 3,
  }));
  Subscription.findOne.mockReturnValue(query(null));
  Subscription.findOneAndUpdate.mockReturnValue(query({
    ...recoveryRecord(),
    paymentRecoveryStatus: 'retrying',
    recoveryInvoiceId: 'in_failed',
    firstPaymentFailureAt: now,
    gracePeriodEndsAt: new Date(now.getTime() + GRACE_PERIOD_MS),
  }));
  Subscription.updateOne.mockResolvedValue({ modifiedCount: 1 });
  RecoveryEmail.updateOne.mockResolvedValue({ upsertedCount: 1 });
  RecoveryEmail.updateMany.mockResolvedValue({ modifiedCount: 1 });
});

describe('Subscription V2 recovery policy flags and grace tracking', () => {
  test('all recovery flags default off and reminder schedule is configurable', () => {
    expect(recoveryEnabled({})).toBe(false);
    expect(recoveryJobEnabled({})).toBe(false);
    expect(recoveryEmailsEnabled({})).toBe(false);
    expect(reminderSchedule({})).toEqual([
      { kind: 'reminder_day_3', day: 3 },
      { kind: 'reminder_day_6', day: 6 },
    ]);
    expect(reminderSchedule({ SUBSCRIPTION_V2_RECOVERY_REMINDER_DAYS: '2,5,5,9' })).toEqual([
      { kind: 'reminder_day_2', day: 2 },
      { kind: 'reminder_day_5', day: 5 },
    ]);
  });

  test('starts an exact seven-day renewal grace and schedules emails once', async () => {
    const record = recoveryRecord();
    Subscription.findOneAndUpdate.mockReturnValue(query({
      ...record,
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_failed',
      firstPaymentFailureAt: now,
      gracePeriodEndsAt: new Date(now.getTime() + GRACE_PERIOD_MS),
    }));
    const result = await startRecovery({
      record,
      invoice: invoice(),
      subscription: stripeSubscription(),
      mode: 'test',
      now,
    }, {
      env: {
        SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true',
        SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED: 'true',
      },
    });

    expect(result.started).toBe(true);
    expect(Subscription.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ paymentRecoveryStatus: { $in: ['none', 'recovered', 'exhausted'] } }),
      expect.objectContaining({
        $set: expect.objectContaining({
          firstPaymentFailureAt: now,
          gracePeriodEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          recoveryInvoiceId: 'in_failed',
          recoveryUsagePeriodStart: periodStart,
        }),
      }),
      expect.objectContaining({ new: true })
    );
    expect(RecoveryEmail.updateOne).toHaveBeenCalledTimes(3);
    expect(RecoveryEmail.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ stripeMode: 'test', invoiceId: 'in_failed', kind: 'payment_failed' }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ status: 'pending', attempts: 0 }),
      }),
      { upsert: true }
    );
  });

  test('duplicate retry failures do not restart grace; checkout failures and missing paid usage do not start it', async () => {
    const alreadyRetrying = recoveryRecord({
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_failed',
    });
    Subscription.findOne.mockReturnValue(query(alreadyRetrying));
    const duplicate = await startRecovery({
      record: alreadyRetrying,
      invoice: invoice(),
      subscription: stripeSubscription(),
      mode: 'test',
      now: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
    }, { env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true' } });
    expect(duplicate.duplicate).toBe(true);
    expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();

    const exhausted = recoveryRecord({
      paymentRecoveryStatus: 'exhausted',
      recoveryInvoiceId: 'in_failed',
    });
    Subscription.findOne.mockReturnValue(query(exhausted));
    const duplicateAfterExpiry = await startRecovery({
      record: exhausted,
      invoice: invoice(),
      subscription: stripeSubscription(),
      mode: 'test',
      now,
    }, { env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true' } });
    expect(duplicateAfterExpiry.duplicate).toBe(true);
    expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();

    const initialFailure = await startRecovery({
      record: recoveryRecord(),
      invoice: invoice({ billing_reason: 'subscription_create' }),
      subscription: stripeSubscription(),
      mode: 'test',
      now,
    }, { env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true' } });
    expect(initialFailure.ignored).toBe(true);

    Subscription.findOne.mockReturnValue(query(null));
    Usage.findOne.mockReturnValue(query(null));
    const noPaidPeriod = await startRecovery({
      record: recoveryRecord(),
      invoice: invoice(),
      subscription: stripeSubscription(),
      mode: 'test',
      now,
    }, { env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true' } });
    expect(noPaidPeriod.noPaidUsage).toBe(true);
    expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('does not start recovery for a different Stripe mode or subscription plan', async () => {
    const record = recoveryRecord();
    const wrongPlan = stripeSubscription({
      metadata: {
        subscriptionV2: 'true',
        userId: String(userId),
        planId: String(new mongoose.Types.ObjectId()),
        stripeMode: 'test',
      },
    });
    const wrongMode = await startRecovery({
      record,
      invoice: invoice(),
      subscription: stripeSubscription({}, record),
      mode: 'live',
      now,
    }, { env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true' } });
    const wrongOwnership = await startRecovery({
      record,
      invoice: invoice(),
      subscription: wrongPlan,
      mode: 'test',
      now,
    }, { env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true' } });

    expect(wrongMode.ignored).toBe(true);
    expect(wrongOwnership.ignored).toBe(true);
    expect(Usage.findOne).not.toHaveBeenCalled();
    expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('successful paid invoice within the grace closes recovery and stops reminders', async () => {
    const record = recoveryRecord({
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_failed',
      gracePeriodEndsAt: new Date(now.getTime() + GRACE_PERIOD_MS),
    });
    const paidInvoice = invoice({
      status: 'paid',
      status_transitions: { paid_at: Math.floor(now.getTime() / 1000) + 60 },
    });
    Subscription.findOneAndUpdate.mockReturnValue(query({
      ...record,
      paymentRecoveryStatus: 'recovered',
    }));
    const recovered = await markRecovered({
      record,
      invoice: paidInvoice,
      subscription: stripeSubscription(),
      now,
    }, {
      env: { SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED: 'true' },
    });

    expect(recovered).toBe(true);
    expect(Subscription.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ recoveryInvoiceId: 'in_failed', paymentRecoveryStatus: 'retrying' }),
      expect.objectContaining({
        $set: expect.objectContaining({ paymentRecoveryStatus: 'recovered', status: 'active' }),
      }),
      expect.objectContaining({ new: true })
    );
    expect(RecoveryEmail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ['pending', 'sending'] },
        invoiceId: 'in_failed',
      }),
      expect.objectContaining({ $set: { status: 'canceled' } })
    );
    expect(RecoveryEmail.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'payment_recovered' }),
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('does not recover from an unpaid invoice or a payment made at/after the deadline', async () => {
    const record = recoveryRecord({
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_failed',
      gracePeriodEndsAt: now,
    });
    expect(await markRecovered({
      record,
      invoice: invoice({ status: 'open' }),
      subscription: stripeSubscription(),
      now,
    })).toBe(false);
    expect(await markRecovered({
      record,
      invoice: invoice({
        status: 'paid',
        status_transitions: { paid_at: Math.floor(now.getTime() / 1000) },
      }),
      subscription: stripeSubscription(),
      now,
    })).toBe(false);
    expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('grace-expiry recovery worker', () => {
  function candidateQuery(value) {
    return {
      limit: () => ({ lean: async () => value }),
    };
  }

  function workerFixture({ invoiceStatus = 'open', cancelThrows = false } = {}) {
    const record = recoveryRecord({
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_failed',
      gracePeriodEndsAt: new Date(now.getTime() - 1),
    });
    let locked = false;
    let canceled = false;
    Subscription.find.mockReturnValue(candidateQuery([record]));
    Subscription.findById.mockReturnValue(query(record));
    Subscription.findOneAndUpdate.mockImplementation((filter, update) => {
      if (filter._id && update?.$set?.recoveryLeaseUntil) {
        if (locked) return query(null);
        locked = true;
        return query({ ...record, recoveryLeaseUntil: new Date(now.getTime() + 120000) });
      }
      return query({ ...record, paymentRecoveryStatus: 'exhausted' });
    });
    Operation.findOneAndUpdate.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      operationId: `grace-expiry:${record.stripeSubscriptionId}:${record.recoveryInvoiceId}`,
      idempotencyKey: `jobblo-subv2-${record.stripeMode}-grace-expiry:${record.stripeSubscriptionId}:${record.recoveryInvoiceId}`,
      stripeMode: record.stripeMode,
      operationType: 'renewal_recovery',
      userId: record.userId,
      subscriptionId: record._id,
      stripeSubscriptionId: record.stripeSubscriptionId,
      stripeInvoiceId: record.recoveryInvoiceId,
    });
    Operation.updateOne.mockResolvedValue({ modifiedCount: 1 });
    const canonical = stripeSubscription({
      status: 'active',
      latest_invoice: 'in_failed',
    });
    const stripe = {
      subscriptions: {
        retrieve: jest.fn(async () => canceled ? { ...canonical, status: 'canceled' } : canonical),
        cancel: jest.fn(async () => {
          if (cancelThrows) throw new Error('timeout');
          canceled = true;
          return { ...canonical, status: 'canceled' };
        }),
      },
      invoices: {
        retrieve: jest.fn(async () => invoice({ status: invoiceStatus })),
      },
    };
    return { record, stripe, getCanceled: () => canceled };
  }

  test('does not cancel a payment recovered before the grace deadline', async () => {
    const f = workerFixture({ invoiceStatus: 'paid' });
    f.stripe.invoices.retrieve.mockResolvedValue(invoice({
      status: 'paid',
      status_transitions: { paid_at: Math.floor((now.getTime() - GRACE_PERIOD_MS) / 1000) },
    }));
    const result = await cancelExpiredRecoveries({
      env: {
        SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true',
        SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true',
      },
      now: () => now,
      SubscriptionModel: Subscription,
      OperationModel: Operation,
      EmailModel: RecoveryEmail,
      stripeForMode: async () => f.stripe,
      markRecovered: jest.fn(),
    });
    expect(result.processed).toBe(1);
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  test('cancels unpaid subscriptions with a stable idempotency key and records success', async () => {
    const f = workerFixture();
    const result = await cancelExpiredRecoveries({
      env: {
        SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true',
        SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true',
      },
      now: () => now,
      SubscriptionModel: Subscription,
      OperationModel: Operation,
      EmailModel: RecoveryEmail,
      stripeForMode: async () => f.stripe,
    });
    expect(result.processed).toBe(1);
    expect(f.stripe.subscriptions.cancel).toHaveBeenCalledWith(
      'sub_test',
      { invoice_now: false, prorate: false },
      { idempotencyKey: 'jobblo-subv2-test-grace-expiry:sub_test:in_failed' }
    );
    expect(Subscription.findOneAndUpdate).toHaveBeenCalled();
    // The unpaid renewal's operation no longer stays 'pending' after the cancellation.
    expect(Operation.updateOne).toHaveBeenCalledWith(
      { stripeMode: 'test', operationId: 'invoice:in_failed', status: 'pending' },
      { $set: expect.objectContaining({ status: 'failed', lastErrorCode: 'renewal_unpaid_subscription_canceled' }) }
    );
  });

  test('a cancellation that did not apply leaves the invoice operation untouched', async () => {
    const f = workerFixture();
    // markCanceled's compare-and-swap loses (the recovery changed state meanwhile).
    Subscription.findOneAndUpdate.mockImplementation((filter, update) =>
      query(update?.$set?.recoveryLeaseUntil ? { ...f.record, recoveryLeaseUntil: new Date(now.getTime() + 120000) } : null)
    );
    await cancelExpiredRecoveries({
      env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true', SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true' },
      now: () => now,
      SubscriptionModel: Subscription,
      OperationModel: Operation,
      EmailModel: RecoveryEmail,
      stripeForMode: async () => f.stripe,
    });
    expect(Operation.updateOne).not.toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'invoice:in_failed' }),
      expect.anything()
    );
  });

  test('a concurrent expiry worker cannot claim and cancel the same recovery twice', async () => {
    const f = workerFixture();
    const options = {
      env: {
        SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true',
        SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true',
      },
      now: () => now,
      SubscriptionModel: Subscription,
      OperationModel: Operation,
      EmailModel: RecoveryEmail,
      stripeForMode: async () => f.stripe,
    };
    const results = await Promise.all([
      cancelExpiredRecoveries(options),
      cancelExpiredRecoveries(options),
    ]);

    expect(results.reduce((sum, result) => sum + result.processed, 0)).toBe(1);
    expect(f.stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
  });

  test('records uncertain Stripe cancellation for reconciliation without changing idempotency key', async () => {
    const f = workerFixture({ cancelThrows: true });
    await cancelExpiredRecoveries({
      env: {
        SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true',
        SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true',
      },
      now: () => now,
      SubscriptionModel: Subscription,
      OperationModel: Operation,
      EmailModel: RecoveryEmail,
      stripeForMode: async () => f.stripe,
    });
    expect(Operation.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ stripeMode: 'test', operationId: 'grace-expiry:sub_test:in_failed' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'reconciliation_required' }),
      })
    );
  });

  const workerOptions = (f) => ({
    env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true', SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true' },
    now: () => now,
    SubscriptionModel: Subscription,
    OperationModel: Operation,
    EmailModel: RecoveryEmail,
    stripeForMode: async () => f.stripe,
  });

  describe('race: the customer pays while the worker is expiring the recovery', () => {
    // First read: still open. Second read (right before cancel): paid.
    function racing(paidAt) {
      const f = workerFixture();
      f.stripe.invoices.retrieve
        .mockResolvedValueOnce(invoice({ status: 'open' }))
        .mockResolvedValue(invoice({ status: 'paid', status_transitions: { paid_at: Math.floor(paidAt.getTime() / 1000) } }));
      return f;
    }

    test('a payment made before the deadline is honoured, not canceled', async () => {
      const f = racing(new Date(f0Deadline().getTime() - 60 * 1000));
      await cancelExpiredRecoveries(workerOptions(f));
      expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(f.stripe.invoices.retrieve).toHaveBeenCalledTimes(2);
    });

    test('a payment made after the deadline goes to late-payment reconciliation, not cancellation', async () => {
      const f = racing(new Date(now.getTime()));
      await cancelExpiredRecoveries(workerOptions(f));
      expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(Operation.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: 'invoice:in_failed' }),
        expect.objectContaining({ $set: expect.objectContaining({
          status: 'reconciliation_required',
          lastErrorCode: 'late_payment_after_grace',
        }) }),
        expect.anything()
      );
    });

    function f0Deadline() {
      return new Date(now.getTime() - 1); // workerFixture's gracePeriodEndsAt
    }
  });

  test('a late payment is parked for a day instead of being re-selected every minute', async () => {
    const f = workerFixture();
    Operation.findOneAndUpdate.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      operationId: 'grace-expiry:sub_test:in_failed',
      idempotencyKey: 'jobblo-subv2-test-grace-expiry:sub_test:in_failed',
      stripeMode: 'test',
      operationType: 'renewal_recovery',
      status: 'reconciliation_required',
      lastErrorCode: 'late_payment_after_grace',
      userId: f.record.userId,
      subscriptionId: f.record._id,
      stripeSubscriptionId: f.record.stripeSubscriptionId,
      stripeInvoiceId: 'in_failed',
    });
    await cancelExpiredRecoveries(workerOptions(f));
    const [, update] = Subscription.updateOne.mock.calls.at(-1);
    expect(update.$set.recoveryLeaseUntil.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
    // The candidate query skips any record whose lease is still in the future.
    expect(Subscription.find.mock.calls[0][0].$or).toEqual([
      { recoveryLeaseUntil: null },
      { recoveryLeaseUntil: { $lte: now } },
    ]);
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  test('the job performs no Stripe work unless both dedicated flags are enabled', async () => {
    const stripeForMode = jest.fn();
    const result = await cancelExpiredRecoveries({ env: {}, stripeForMode });
    expect(result.skipped).toBe(true);
    expect(stripeForMode).not.toHaveBeenCalled();
  });
});

describe('recovery email outbox', () => {
  test('sends a due reminder once and retries transport failures without affecting Stripe', async () => {
    const item = {
      _id: new mongoose.Types.ObjectId(),
      subscriptionId,
      userId,
      invoiceId: 'in_failed',
      kind: 'reminder_day_3',
      attempts: 0,
    };
    RecoveryEmail.find.mockReturnValue(query([item]));
    RecoveryEmail.findOneAndUpdate.mockReturnValue(query({ ...item, status: 'sending' }));
    Subscription.findById.mockReturnValue(query({
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_failed',
      gracePeriodEndsAt: new Date(now.getTime() + GRACE_PERIOD_MS),
    }));
    User.findById.mockReturnValue({
      select: () => query({ email: 'user@example.no', name: 'Test' }),
    });
    const sendEmail = jest.fn().mockRejectedValue(new Error('SMTP unavailable'));
    const result = await dispatchRecoveryEmails({
      env: {
        SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED: 'true',
        FRONTEND_URL: 'https://jobblo.example',
      },
      now: () => now,
      EmailModel: RecoveryEmail,
      SubscriptionModel: Subscription,
      UserModel: User,
      sendEmail,
    });
    expect(result.sent).toBe(0);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.no',
      kind: 'reminder_day_3',
    }));
    expect(RecoveryEmail.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: item._id, status: 'sending' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'pending', lastError: 'SMTP unavailable' }),
      })
    );
  });
});
