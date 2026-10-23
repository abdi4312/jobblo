const mongoose = require('mongoose');
const { processVerifiedEvent } = require('../services/subscriptions/v2WebhookProcessor');

const userId = new mongoose.Types.ObjectId();
const planId = new mongoose.Types.ObjectId();
const operationId = 'v2-operation-1';
const periodStart = Math.floor(new Date('2026-09-01T00:00:00Z').getTime() / 1000);
const periodEnd = Math.floor(new Date('2026-10-01T00:00:00Z').getTime() / 1000);

function query(value) {
  return {
    lean: async () => value,
    sort() { return this; },
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function fixture({ existingSubscription = null, invoiceStatus = 'paid' } = {}) {
  const metadata = {
    subscriptionV2: 'true',
    userId: String(userId),
    planId: String(planId),
    operationId,
    stripeMode: 'test',
  };
  const invoice = {
    id: 'in_v2',
    livemode: false,
    status: invoiceStatus,
    currency: 'nok',
    amount_paid: invoiceStatus === 'paid' ? 9900 : 0,
    customer: 'cus_v2',
    parent: {
      type: 'subscription_details',
      subscription_details: { subscription: 'sub_v2', metadata },
    },
  };
  const subscription = {
    id: 'sub_v2',
    livemode: false,
    customer: 'cus_v2',
    status: invoiceStatus === 'paid' ? 'active' : 'incomplete',
    cancel_at_period_end: false,
    cancel_at: null,
    metadata,
    latest_invoice: invoice,
    items: {
      data: [{
        current_period_start: periodStart,
        current_period_end: periodEnd,
        price: {
          id: 'price_test',
          currency: 'nok',
          recurring: { interval: 'month', interval_count: 1 },
        },
      }],
    },
  };
  const eventDoc = { _id: new mongoose.Types.ObjectId(), status: 'processing' };
  const operation = {
    _id: new mongoose.Types.ObjectId(),
    operationId,
    idempotencyKey: 'checkout-idempotency',
    stripeMode: 'test',
    operationType: 'checkout',
    status: 'pending',
    userId,
    targetPlanId: planId,
    stripeCheckoutSessionId: 'cs_v2',
    stripePriceId: 'price_test',
    stripeCustomerId: 'cus_v2',
  };
  const eventModel = {
    create: jest.fn(async () => eventDoc),
    findOne: jest.fn(async () => null),
    findOneAndUpdate: jest.fn(async () => eventDoc),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const subscriptionModel = {
    findOne: jest.fn(() => query(existingSubscription)),
    findOneAndUpdate: jest.fn(() => query({ _id: new mongoose.Types.ObjectId() })),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const operationModel = {
    findOne: jest.fn(async () => operation),
    findOneAndUpdate: jest.fn(async () => operation),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const plan = {
    _id: planId,
    name: 'Plus',
    price: 99,
    type: 'private',
    stripePriceIdTest: 'price_test',
    stripePriceId: 'price_live',
  };
  const planModel = { findById: jest.fn(() => ({ lean: async () => plan })) };
  const usageModel = {
    findOne: jest.fn(() => query({
      _id: new mongoose.Types.ObjectId(),
      billingPeriodStart: new Date(periodStart * 1000),
      billingPeriodEnd: new Date(periodEnd * 1000),
      periodType: 'paid',
    })),
    findOneAndUpdate: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const recoveryEmailModel = {
    updateOne: jest.fn(async () => ({ upsertedCount: 1 })),
    updateMany: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const stripe = {
    subscriptions: { retrieve: jest.fn(async () => subscription) },
    invoices: { retrieve: jest.fn(async () => invoice) },
  };
  return {
    metadata,
    invoice,
    subscription,
    eventDoc,
    operation,
    eventModel,
    subscriptionModel,
    operationModel,
    planModel,
    stripe,
    overrides: {
      EventModel: eventModel,
      SubscriptionModel: subscriptionModel,
      OperationModel: operationModel,
      PlanModel: planModel,
      UsageModel: usageModel,
      RecoveryEmailModel: recoveryEmailModel,
    },
    usageModel,
    recoveryEmailModel,
  };
}

test('does not retry a failed webhook event after it has been explicitly reconciled', async () => {
  const f = fixture();
  const duplicateKey = new Error('duplicate event');
  duplicateKey.code = 11000;
  f.eventModel.create.mockRejectedValue(duplicateKey);
  f.eventModel.findOne.mockResolvedValue({
    status: 'reconciled',
    reconciliationOperationId: operationId,
  });

  await expect(processVerifiedEvent({
    id: 'evt_checkout_v2',
    type: 'checkout.session.completed',
    livemode: false,
    data: { object: {} },
  }, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_duplicate_event',
  });
  expect(f.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  expect(f.eventModel.findOneAndUpdate).not.toHaveBeenCalled();
});

function checkoutEvent(f, patch = {}) {
  return {
    id: 'evt_checkout_v2',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: 'cs_v2',
        mode: 'subscription',
        status: 'complete',
        payment_status: 'paid',
        livemode: false,
        currency: 'nok',
        amount_total: 9900,
        customer: 'cus_v2',
        subscription: 'sub_v2',
        client_reference_id: String(userId),
        metadata: f.metadata,
        ...patch,
      },
    },
  };
}

describe('Subscription V2 webhook processor', () => {
  test('activates only after a completed, paid Checkout and canonical paid invoice', async () => {
    const f = fixture();

    await expect(
      processVerifiedEvent(checkoutEvent(f), 'test', f.stripe, f.overrides)
    ).resolves.toEqual({ handled: 'subscription_activated' });

    expect(f.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_v2', {
      expand: ['latest_invoice', 'items.data.price'],
    });
    expect(f.subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId },
      expect.objectContaining({
        $set: expect.objectContaining({
          stripeCustomerId: 'cus_v2',
          stripeSubscriptionId: 'sub_v2',
          stripeMode: 'test',
          status: 'active',
          currentPeriodStart: new Date(periodStart * 1000),
          currentPeriodEnd: new Date(periodEnd * 1000),
          nextRenewalAt: new Date(periodEnd * 1000),
          autoRenew: true,
        }),
        $addToSet: {
          planHistory: expect.objectContaining({
            planId,
            planName: 'Plus',
            stripeSubscriptionId: 'sub_v2',
            changeType: 'initial',
          }),
        },
      }),
      expect.objectContaining({ upsert: true, runValidators: true })
    );
    expect(f.eventModel.updateOne).toHaveBeenLastCalledWith(
      { _id: f.eventDoc._id, status: 'processing' },
      expect.objectContaining({ $set: { status: 'processed', processedAt: expect.any(Date) } })
    );
  });

  test('does not activate an unpaid checkout redirect', async () => {
    const f = fixture();

    await expect(
      processVerifiedEvent(
        checkoutEvent(f, { payment_status: 'unpaid' }),
        'test',
        f.stripe,
        f.overrides
      )
    ).resolves.toEqual({ handled: 'subscription_payment_not_confirmed' });
    expect(f.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(f.subscriptionModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects ownership and mode mismatches, and records the failed retry state', async () => {
    const f = fixture();
    const event = checkoutEvent(f);
    event.data.object.customer = 'cus_other';

    await expect(processVerifiedEvent(event, 'test', f.stripe, f.overrides)).rejects.toThrow(
      'subscription_checkout_ownership_mismatch'
    );
    expect(f.subscriptionModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(f.eventModel.updateOne).toHaveBeenLastCalledWith(
      { _id: f.eventDoc._id, status: 'processing' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          lastErrorMessage: 'Subscription event processing failed.',
        }),
      })
    );
  });

  test('acknowledges duplicate event IDs without reprocessing', async () => {
    const f = fixture();
    const duplicate = new Error('duplicate');
    duplicate.code = 11000;
    f.eventModel.create.mockRejectedValue(duplicate);
    f.eventModel.findOne.mockResolvedValue({ status: 'processed' });

    await expect(
      processVerifiedEvent(checkoutEvent(f), 'test', f.stripe, f.overrides)
    ).resolves.toEqual({ handled: 'subscription_duplicate_event' });
    expect(f.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  test('reconciles an out-of-order payment failure against the canonical paid invoice', async () => {
    const f = fixture({
      existingSubscription: {
        _id: new mongoose.Types.ObjectId(),
        userId,
        planId,
        stripeMode: 'test',
        stripeSubscriptionId: 'sub_v2',
        stripeCustomerId: 'cus_v2',
        status: 'past_due',
        firstPaymentFailureAt: new Date('2026-09-29T00:00:00Z'),
      },
    });
    const event = {
      id: 'evt_late_failure',
      type: 'invoice.payment_failed',
      livemode: false,
      data: { object: f.invoice },
    };

    await expect(
      processVerifiedEvent(event, 'test', f.stripe, f.overrides)
    ).resolves.toEqual({ handled: 'subscription_state_updated' });
    expect(f.subscriptionModel.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId) },
      {
        $set: expect.objectContaining({
          status: 'active',
          paymentRecoveryStatus: 'recovered',
          firstPaymentFailureAt: null,
        }),
      }
    );
  });

  test('records initial payment failure without provisioning a subscription', async () => {
    const f = fixture({ invoiceStatus: 'open' });
    f.stripe.invoices.retrieve.mockResolvedValue({
      ...f.invoice,
      status: 'open',
      parent: f.invoice.parent,
    });
    const event = {
      id: 'evt_initial_failed',
      type: 'invoice.payment_failed',
      livemode: false,
      data: { object: f.invoice },
    };

    await expect(
      processVerifiedEvent(event, 'test', f.stripe, f.overrides)
    ).resolves.toEqual({ handled: 'subscription_initial_payment_failed' });
    expect(f.operationModel.updateOne).toHaveBeenCalledWith(
      { _id: f.operation._id, status: 'pending' },
      expect.objectContaining({
        $set: expect.objectContaining({
          stripeInvoiceId: 'in_v2',
          lastErrorCode: 'initial_payment_failed',
        }),
      })
    );
    expect(f.subscriptionModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('deduplicates successful renewal invoices by invoice ID', async () => {
    const f = fixture({
      existingSubscription: {
        _id: new mongoose.Types.ObjectId(),
        userId,
        planId,
        stripeMode: 'test',
        stripeSubscriptionId: 'sub_v2',
        stripeCustomerId: 'cus_v2',
        status: 'active',
      },
    });
    f.operationModel.findOneAndUpdate.mockResolvedValue({ status: 'succeeded' });
    const event = {
      id: 'evt_invoice_paid',
      type: 'invoice.paid',
      livemode: false,
      data: { object: f.invoice },
    };

    await expect(
      processVerifiedEvent(event, 'test', f.stripe, f.overrides)
    ).resolves.toEqual({ handled: 'subscription_duplicate_invoice' });
    expect(f.subscriptionModel.updateOne).not.toHaveBeenCalled();
  });

  test('updates renewal period from the canonical Stripe subscription item', async () => {
    const f = fixture({
      existingSubscription: {
        _id: new mongoose.Types.ObjectId(),
        userId,
        planId,
        stripeMode: 'test',
        stripeSubscriptionId: 'sub_v2',
        stripeCustomerId: 'cus_v2',
        status: 'active',
      },
    });

    const event = {
      id: 'evt_invoice_paid_period',
      type: 'invoice.paid',
      livemode: false,
      created: periodEnd,
      data: { object: f.invoice },
    };

    await expect(
      processVerifiedEvent(event, 'test', f.stripe, f.overrides)
    ).resolves.toEqual({ handled: 'subscription_state_updated' });
    expect(f.subscriptionModel.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId) },
      {
        $set: expect.objectContaining({
          status: 'active',
          currentPeriodStart: new Date(periodStart * 1000),
          currentPeriodEnd: new Date(periodEnd * 1000),
          nextRenewalAt: new Date(periodEnd * 1000),
        }),
      }
    );
    expect(f.operationModel.updateOne).toHaveBeenCalledWith(
      { _id: f.operation._id, status: 'pending' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'succeeded',
          stripeInvoiceId: 'in_v2',
        }),
      })
    );
  });

  test('starts recovery only for an owned renewal failure when recovery flags are enabled', async () => {
    const record = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      planId,
      stripeMode: 'test',
      stripeSubscriptionId: 'sub_v2',
      stripeCustomerId: 'cus_v2',
      status: 'active',
      paymentRecoveryStatus: 'none',
      currentPeriodStart: new Date(periodStart * 1000),
    };
    const f = fixture({ existingSubscription: record, invoiceStatus: 'open' });
    f.invoice.billing_reason = 'subscription_cycle';
    f.subscription.status = 'past_due';
    f.subscription.latest_invoice = f.invoice;
    f.stripe.invoices.retrieve.mockResolvedValue(f.invoice);
    f.subscriptionModel.findOne.mockImplementation((filter) =>
      query(filter.recoveryInvoiceId ? null : record)
    );

    await expect(processVerifiedEvent({
      id: 'evt_renewal_payment_failed',
      type: 'invoice.payment_failed',
      livemode: false,
      created: periodEnd,
      data: { object: f.invoice },
    }, 'test', f.stripe, {
      ...f.overrides,
      env: {
        SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true',
        SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED: 'true',
      },
    })).resolves.toEqual({ handled: 'subscription_payment_failed' });

    expect(f.subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: record._id,
        paymentRecoveryStatus: { $in: ['none', 'recovered', 'exhausted'] },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          paymentRecoveryStatus: 'retrying',
          recoveryInvoiceId: f.invoice.id,
          gracePeriodEndsAt: new Date((periodEnd + 7 * 24 * 60 * 60) * 1000),
        }),
      }),
      expect.objectContaining({ new: true })
    );
    expect(f.recoveryEmailModel.updateOne).toHaveBeenCalledTimes(3);
  });

  /**
   * Real Stripe ordering: customer.subscription.updated moves the record to the NEW
   * period about an hour before the renewal charge, and only the OLD period has a paid
   * usage row. The previous test kept the record on the old period, which hid that
   * startRecovery looked for paid usage at the new period start, found none, and never
   * started grace (no emails, straight to the free tier).
   */
  test('starts grace for a real rollover: record already on the new period, paid usage only for the old one', async () => {
    const newStart = periodEnd;
    const newEnd = periodEnd + 30 * 24 * 60 * 60;
    const record = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      planId,
      stripeMode: 'test',
      stripeSubscriptionId: 'sub_v2',
      stripeCustomerId: 'cus_v2',
      status: 'active',
      paymentRecoveryStatus: 'none',
      currentPeriodStart: new Date(newStart * 1000), // advanced by subscription.updated
      currentPeriodEnd: new Date(newEnd * 1000),
    };
    const f = fixture({ existingSubscription: record, invoiceStatus: 'open' });
    f.invoice.billing_reason = 'subscription_cycle';
    f.subscription.status = 'past_due';
    f.subscription.items.data[0].current_period_start = newStart;
    f.subscription.items.data[0].current_period_end = newEnd;
    f.stripe.invoices.retrieve.mockResolvedValue(f.invoice);
    f.subscriptionModel.findOne.mockImplementation((filter) =>
      query(filter.recoveryInvoiceId ? null : record)
    );
    // Only the period that was actually paid for exists.
    const oldPaid = {
      _id: new mongoose.Types.ObjectId(),
      periodType: 'paid',
      billingPeriodStart: new Date(periodStart * 1000),
      billingPeriodEnd: new Date(periodEnd * 1000),
    };
    f.usageModel.findOne.mockImplementation((filter) => {
      const s = filter.billingPeriodStart;
      const e = filter.billingPeriodEnd;
      const startOk = s instanceof Date ? +s === +oldPaid.billingPeriodStart : +oldPaid.billingPeriodStart <= +s.$lte;
      const endOk = !e || +oldPaid.billingPeriodEnd >= +e.$gte;
      return query(filter.periodType === 'paid' && startOk && endOk ? oldPaid : null);
    });

    await processVerifiedEvent({
      id: 'evt_rollover_payment_failed',
      type: 'invoice.payment_failed',
      livemode: false,
      created: newStart + 3600,
      data: { object: f.invoice },
    }, 'test', f.stripe, {
      ...f.overrides,
      env: {
        SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true',
        SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED: 'true',
      },
    });

    expect(f.subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: record._id }),
      expect.objectContaining({
        $set: expect.objectContaining({
          paymentRecoveryStatus: 'retrying',
          recoveryUsagePeriodStart: oldPaid.billingPeriodStart, // keeps the paid allowance
          gracePeriodEndsAt: new Date((newStart + 3600 + 7 * 24 * 60 * 60) * 1000),
        }),
      }),
      expect.anything()
    );
    // payment_failed now, reminders on day 3 and day 6 of the failure.
    const scheduled = f.recoveryEmailModel.updateOne.mock.calls.map(([, u]) => [
      u.$setOnInsert.kind,
      u.$setOnInsert.scheduledAt.getTime() / 1000 - (newStart + 3600),
    ]);
    expect(scheduled).toEqual([
      ['payment_failed', 0],
      ['reminder_day_3', 3 * 86400],
      ['reminder_day_6', 6 * 86400],
    ]);
  });

  test('a paid renewal opens the NEW period with a fresh allowance; usage does not roll over', async () => {
    const newStart = periodEnd;
    const newEnd = periodEnd + 30 * 24 * 60 * 60;
    const record = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      planId,
      stripeMode: 'test',
      stripeSubscriptionId: 'sub_v2',
      stripeCustomerId: 'cus_v2',
      status: 'active',
      paymentRecoveryStatus: 'none',
      currentPeriodStart: new Date(periodStart * 1000),
    };
    const f = fixture({ existingSubscription: record });
    f.invoice.billing_reason = 'subscription_cycle';
    f.subscription.items.data[0].current_period_start = newStart;
    f.subscription.items.data[0].current_period_end = newEnd;
    f.stripe.invoices.retrieve.mockResolvedValue(f.invoice);
    f.planModel.findById.mockReturnValue({ lean: async () => ({ _id: planId, entitlements: { freeContact: 15 } }) });

    await processVerifiedEvent({
      id: 'evt_renewal_paid',
      type: 'invoice.paid',
      livemode: false,
      created: newStart + 3600,
      data: { object: f.invoice },
    }, 'test', f.stripe, f.overrides);

    expect(f.subscriptionModel.updateOne).toHaveBeenCalledWith(
      { _id: record._id },
      { $set: expect.objectContaining({
        status: 'active',
        currentPeriodStart: new Date(newStart * 1000),
        currentPeriodEnd: new Date(newEnd * 1000),
        nextRenewalAt: new Date(newEnd * 1000),
      }) }
    );
    expect(f.usageModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId, billingPeriodStart: new Date(newStart * 1000) },
      { $setOnInsert: expect.objectContaining({
        periodType: 'paid',
        billingPeriodEnd: new Date(newEnd * 1000),
        includedContacts: 15,
        consumedIncludedContacts: 0,
      }) },
      expect.objectContaining({ upsert: true })
    );
    // The invoice operation succeeds with no stale error left from earlier failed attempts.
    expect(f.operationModel.updateOne).toHaveBeenCalledWith(
      { _id: f.operation._id, status: 'pending' },
      { $set: expect.objectContaining({ status: 'succeeded', lastErrorCode: null, lastErrorMessage: null }) }
    );
  });

  test('a retried renewal failure neither restarts the grace timer nor re-queues new emails', async () => {
    const firstFailure = new Date((periodEnd + 3600) * 1000);
    const record = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      planId,
      stripeMode: 'test',
      stripeSubscriptionId: 'sub_v2',
      stripeCustomerId: 'cus_v2',
      status: 'past_due',
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_v2',
      firstPaymentFailureAt: firstFailure,
      gracePeriodEndsAt: new Date(firstFailure.getTime() + 7 * 86400 * 1000),
      currentPeriodStart: new Date(periodEnd * 1000),
    };
    const f = fixture({ existingSubscription: record, invoiceStatus: 'open' });
    f.invoice.billing_reason = 'subscription_cycle';
    f.subscription.status = 'past_due';
    f.stripe.invoices.retrieve.mockResolvedValue(f.invoice);
    f.subscriptionModel.findOne.mockReturnValue(query(record));
    f.usageModel.findOne.mockReturnValue(query({ periodType: 'paid', billingPeriodStart: new Date(periodStart * 1000) }));

    await processVerifiedEvent({
      id: 'evt_retry_failed_day_3',
      type: 'invoice.payment_failed',
      livemode: false,
      created: periodEnd + 3 * 86400,
      data: { object: f.invoice },
    }, 'test', f.stripe, {
      ...f.overrides,
      env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true', SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED: 'true' },
    });

    expect(f.subscriptionModel.findOneAndUpdate).not.toHaveBeenCalled(); // deadline untouched
    // Emails are only upserted with $setOnInsert, keyed by invoice + kind, and anchored
    // to the FIRST failure — a retry cannot add or reschedule any.
    for (const [filter, update] of f.recoveryEmailModel.updateOne.mock.calls) {
      expect(filter).toEqual(expect.objectContaining({ invoiceId: 'in_v2' }));
      expect(Object.keys(update)).toEqual(['$setOnInsert']);
    }
    expect(f.recoveryEmailModel.updateOne.mock.calls[0][1].$setOnInsert.scheduledAt).toEqual(firstFailure);
  });

  test('does not anchor grace to an old paid period that ended before the current one', async () => {
    const record = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      planId,
      stripeMode: 'test',
      stripeSubscriptionId: 'sub_v2',
      stripeCustomerId: 'cus_v2',
      status: 'active',
      paymentRecoveryStatus: 'none',
      currentPeriodStart: new Date((periodEnd + 60 * 86400) * 1000), // months later
    };
    const f = fixture({ existingSubscription: record, invoiceStatus: 'open' });
    f.invoice.billing_reason = 'subscription_cycle';
    f.subscription.status = 'past_due';
    f.stripe.invoices.retrieve.mockResolvedValue(f.invoice);
    f.subscriptionModel.findOne.mockImplementation((filter) =>
      query(filter.recoveryInvoiceId ? null : record)
    );
    f.usageModel.findOne.mockImplementation((filter) =>
      // The only paid row ends at periodEnd, well before the anchor.
      query(filter.billingPeriodEnd && periodEnd * 1000 < +filter.billingPeriodEnd.$gte ? null : {})
    );

    await processVerifiedEvent({
      id: 'evt_stale_paid_period',
      type: 'invoice.payment_failed',
      livemode: false,
      created: periodEnd + 61 * 86400,
      data: { object: f.invoice },
    }, 'test', f.stripe, { ...f.overrides, env: { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true' } });

    expect(f.subscriptionModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('does not restore access for a recovery payment paid at or after the grace deadline', async () => {
    const deadline = new Date('2026-10-01T00:00:00Z');
    const record = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      planId,
      stripeMode: 'test',
      stripeSubscriptionId: 'sub_v2',
      stripeCustomerId: 'cus_v2',
      status: 'past_due',
      paymentRecoveryStatus: 'retrying',
      recoveryInvoiceId: 'in_v2',
      gracePeriodEndsAt: deadline,
    };
    const f = fixture({ existingSubscription: record });
    f.invoice.status_transitions = { paid_at: Math.floor(deadline.getTime() / 1000) };
    f.subscription.status = 'active';
    f.subscription.latest_invoice = f.invoice;
    f.stripe.invoices.retrieve.mockResolvedValue(f.invoice);

    await expect(processVerifiedEvent({
      id: 'evt_late_recovery_payment',
      type: 'invoice.paid',
      livemode: false,
      data: { object: f.invoice },
    }, 'test', f.stripe, f.overrides)).resolves.toEqual({
      handled: 'subscription_late_payment_reconciliation_required',
    });

    expect(f.subscriptionModel.updateOne).toHaveBeenCalledWith(
      { _id: record._id, paymentRecoveryStatus: 'retrying', recoveryInvoiceId: f.invoice.id },
      expect.objectContaining({
        $push: { recoveryHistory: expect.objectContaining({
          action: 'late_payment_reconciliation_required',
          invoiceId: f.invoice.id,
        }) },
        // Parked for a day so the grace worker does not re-select it every minute.
        $set: { recoveryLeaseUntil: expect.any(Date) },
      })
    );
    const parkedUntil = f.subscriptionModel.updateOne.mock.calls
      .find(([filter]) => filter.paymentRecoveryStatus === 'retrying')[1].$set.recoveryLeaseUntil;
    expect(parkedUntil.getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(f.usageModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('a recovery invoice paid after the worker canceled the subscription opens no paid period', async () => {
    const record = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      planId,
      stripeMode: 'test',
      stripeSubscriptionId: 'sub_v2',
      stripeCustomerId: 'cus_v2',
      status: 'canceled',
      paymentRecoveryStatus: 'exhausted',
      recoveryInvoiceId: 'in_v2',
      gracePeriodEndsAt: new Date('2026-10-01T00:00:00Z'),
    };
    const f = fixture({ existingSubscription: record });
    f.invoice.status_transitions = { paid_at: Math.floor(new Date('2026-10-02T00:00:00Z').getTime() / 1000) };
    f.subscription.status = 'canceled';
    f.stripe.invoices.retrieve.mockResolvedValue(f.invoice);

    await expect(processVerifiedEvent({
      id: 'evt_paid_after_cancel',
      type: 'invoice.paid',
      livemode: false,
      data: { object: f.invoice },
    }, 'test', f.stripe, f.overrides)).resolves.toEqual({
      handled: 'subscription_paid_after_cancellation_reconciliation_required',
    });

    expect(f.usageModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(f.subscriptionModel.updateOne).not.toHaveBeenCalledWith({ _id: record._id }, expect.anything());
    expect(f.operationModel.findOneAndUpdate).toHaveBeenCalledWith(
      { stripeMode: 'test', operationId: 'invoice:in_v2' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'reconciliation_required' }) }),
      expect.anything()
    );
  });

  test('does not apply a webhook to a V2 record owned by a different plan', async () => {
    const f = fixture({
      existingSubscription: {
        _id: new mongoose.Types.ObjectId(),
        userId,
        planId: new mongoose.Types.ObjectId(),
        stripeMode: 'test',
        stripeSubscriptionId: 'sub_v2',
        stripeCustomerId: 'cus_v2',
        status: 'active',
      },
    });
    const event = {
      id: 'evt_invoice_wrong_owner',
      type: 'invoice.paid',
      livemode: false,
      data: { object: f.invoice },
    };

    await expect(
      processVerifiedEvent(event, 'test', f.stripe, f.overrides)
    ).rejects.toThrow('subscription_record_owner_mismatch');
    expect(f.subscriptionModel.updateOne).not.toHaveBeenCalled();
  });

  test('records an event retryably when another worker holds a fresh claim', async () => {
    const f = fixture();
    const duplicate = new Error('duplicate');
    duplicate.code = 11000;
    f.eventModel.create.mockRejectedValue(duplicate);
    f.eventModel.findOne.mockResolvedValue({
      _id: f.eventDoc._id,
      status: 'processing',
      updatedAt: new Date(),
    });

    await expect(
      processVerifiedEvent(checkoutEvent(f), 'test', f.stripe, f.overrides)
    ).rejects.toThrow('subscription_event_in_flight');
    expect(f.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});
