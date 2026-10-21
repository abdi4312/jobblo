const mongoose = require('mongoose');
const {
  SubscriptionManagementError,
  cancelSubscription,
  cancelScheduledPlanChange,
  resumeSubscription,
  getCurrentSubscription,
  createBillingPortalSession,
  previewPlanChange,
  changePlan,
} = require('../services/subscriptions/v2Management');
const { processVerifiedEvent } = require('../services/subscriptions/v2WebhookProcessor');
const SubscriptionBillingOperationV2 = require('../models/SubscriptionBillingOperationV2');

const userId = new mongoose.Types.ObjectId();
const currentPlanId = new mongoose.Types.ObjectId();
const targetPlanId = new mongoose.Types.ObjectId();
const subscriptionId = 'sub_management';
const customerId = 'cus_management';
const periodStart = Math.floor(new Date('2026-10-01T00:00:00Z').getTime() / 1000);
const periodEnd = Math.floor(new Date('2026-11-01T00:00:00Z').getTime() / 1000);

function lean(value) {
  return {
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function managementFixture({ cancelAtPeriodEnd = false, recovery = false } = {}) {
  const record = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    planId: currentPlanId,
    planType: 'private',
    stripeMode: 'test',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: 'active',
    pendingPlanChange: null,
    paymentRecoveryStatus: recovery ? 'retrying' : 'none',
    firstPaymentFailureAt: recovery ? new Date('2026-10-16T00:00:00Z') : null,
    gracePeriodEndsAt: recovery ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
  };
  const subscription = {
    id: subscriptionId,
    customer: customerId,
    livemode: false,
    status: 'active',
    cancel_at_period_end: cancelAtPeriodEnd,
    cancel_at: cancelAtPeriodEnd ? periodEnd : null,
    metadata: {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(currentPlanId),
      operationId: 'checkout-op',
      stripeMode: 'test',
    },
    items: {
      data: [{
        id: 'si_management',
        quantity: 1,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        price: {
          id: 'price_current',
          active: true,
          livemode: false,
          type: 'recurring',
          currency: 'nok',
          unit_amount: 9900,
          recurring: { interval: 'month', interval_count: 1 },
        },
      }],
    },
  };
  const currentPlan = {
    _id: currentPlanId,
    name: 'Current',
    price: 99,
    type: 'private',
    stripePriceIdTest: 'price_current',
    entitlements: { freeContact: 15 },
  };
  const targetPlan = {
    _id: targetPlanId,
    name: 'Target',
    price: 199,
    type: 'private',
    stripePriceIdTest: 'price_target',
    entitlements: { freeContact: 35 },
  };
  const operation = {
    _id: new mongoose.Types.ObjectId(),
    operationId: 'management-op',
    idempotencyKey: 'management-key',
    stripeMode: 'test',
    operationType: 'cancel',
    status: 'pending',
    lifecycleLock: true,
    userId,
    targetPlanId: null,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    prorationDate: new Date(),
  };
  let scheduleMetadata;
  let scheduleUpdate;
  const plans = new Map([
    [String(currentPlanId), currentPlan],
    [String(targetPlanId), targetPlan],
  ]);
  const SubscriptionModel = {
    findOne: jest.fn(() => lean(record)),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const OperationModel = {
    findOne: jest.fn(async () => null),
    create: jest.fn(async (data) => ({ ...operation, ...data })),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const PlanModel = {
    findById: jest.fn((id) => lean(plans.get(String(id)) || null)),
  };
  const UsageModel = {
    findOneAndUpdate: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const stripe = {
    subscriptions: {
      retrieve: jest.fn(async () => subscription),
      update: jest.fn(async (_id, params) => ({
        ...subscription,
        ...params,
        metadata: params.metadata || subscription.metadata,
        cancel_at: params.cancel_at_period_end ? periodEnd : null,
      })),
    },
    prices: {
      retrieve: jest.fn(async () => ({
        id: 'price_target',
        active: true,
        livemode: false,
        type: 'recurring',
        currency: 'nok',
        unit_amount: 19900,
        recurring: { interval: 'month', interval_count: 1 },
      })),
    },
    invoices: {
      createPreview: jest.fn(async () => ({ amount_due: 5000 })),
      retrieve: jest.fn(),
      list: jest.fn(async () => ({ data: [] })),
    },
    billingPortal: {
      sessions: {
        create: jest.fn(async () => ({ url: 'https://billing.stripe.test/session' })),
      },
    },
    customers: {
      retrieve: jest.fn(async () => ({
        id: customerId,
        deleted: false,
        metadata: { userId: String(userId) },
        invoice_settings: {
          default_payment_method: {
            card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2030 },
          },
        },
        address: { line1: 'Testgata 1', city: 'Oslo' },
      })),
    },
    subscriptionSchedules: {
      create: jest.fn(async (params) => {
        scheduleMetadata = params.metadata;
        return {
          id: 'sub_sched',
          status: 'active',
          metadata: scheduleMetadata,
        };
      }),
      retrieve: jest.fn(async () => ({
        id: 'sub_sched',
        status: 'active',
        metadata: scheduleUpdate?.metadata || scheduleMetadata || {
          subscriptionV2: 'true',
          userId: String(userId),
          subscriptionId: String(record._id),
          stripeMode: 'test',
        },
        current_phase: { start_date: periodStart },
        phases: scheduleUpdate?.phases || [{
          start_date: periodStart,
          end_date: periodEnd,
          items: [{ price: 'price_current', quantity: 1 }],
        }],
      })),
      update: jest.fn(async (_id, params) => {
        scheduleUpdate = {
          ...params,
          phases: params.phases.map((phase, index) => ({
            ...phase,
            ...(index > 0 && !phase.start_date
              ? { start_date: params.phases[index - 1].end_date }
              : {}),
          })),
        };
        return { id: 'sub_sched' };
      }),
    },
  };
  const overrides = {
    SubscriptionModel,
    PlanModel,
    OperationModel,
    UsageModel,
    stripeForMode: jest.fn(async (testMode) => {
      expect(testMode).toBe(true);
      return stripe;
    }),
  };
  return {
    record,
    subscription,
    currentPlan,
    targetPlan,
    operation,
    SubscriptionModel,
    OperationModel,
    PlanModel,
    UsageModel,
    stripe,
    overrides,
  };
}

describe('Subscription V2 management lifecycle', () => {
  test('exposes authenticated payment-recovery status and deadline in the current subscription API shape', async () => {
    const f = managementFixture({ recovery: true });
    const result = await getCurrentSubscription(userId, f.overrides);

    expect(result.subscription.paymentRecovery).toEqual(expect.objectContaining({
      active: true,
      status: 'retrying',
      startedAt: '2026-10-16T00:00:00.000Z',
      deadline: f.record.gracePeriodEndsAt.toISOString(),
      action: 'update_payment_method',
    }));
  });

  test('returns only invoices belonging to this V2 subscription and customer', async () => {
    const f = managementFixture();
    f.stripe.invoices.list.mockResolvedValue({
      data: [
        {
          id: 'in_owned',
          customer: customerId,
          subscription: subscriptionId,
          livemode: false,
          number: 'INV-1',
          created: periodStart,
          amount_paid: 9900,
          amount_due: 0,
          currency: 'nok',
          status: 'paid',
          invoice_pdf: 'https://invoice.stripe.test/in_owned.pdf',
        },
        {
          id: 'in_other',
          customer: 'cus_other',
          subscription: 'sub_other',
          livemode: false,
        },
      ],
    });

    const result = await require('../services/subscriptions/v2Management')
      .getBillingHistory(userId, f.overrides);

    expect(result.invoices).toEqual([expect.objectContaining({
      id: 'in_owned',
      amountPaid: 99,
      amountDue: 0,
      mode: 'test',
      hasPdf: true,
    })]);
    expect(result.paymentMethod).toEqual({
      brand: 'visa',
      last4: '4242',
      expMonth: 4,
      expYear: 2030,
    });
    expect(result.billingAddress).toEqual({
      name: null,
      line1: 'Testgata 1',
      city: 'Oslo',
    });
  });

  test('returns billing portal customers to the existing subscription settings route', async () => {
    const f = managementFixture();

    await expect(createBillingPortalSession(userId, {
      ...f.overrides,
      env: { FRONTEND_URL: 'http://localhost:5173' },
    })).resolves.toEqual({ url: 'https://billing.stripe.test/session' });

    expect(f.stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: customerId,
      return_url: 'http://localhost:5173/settings/subscriptions',
    });
  });

  test('returns an invoice PDF only for the authenticated customer and recorded Stripe mode', async () => {
    const f = managementFixture();
    f.stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_owned',
      customer: customerId,
      subscription: subscriptionId,
      livemode: false,
      invoice_pdf: 'https://invoice.stripe.test/in_owned.pdf',
    });
    const management = require('../services/subscriptions/v2Management');
    await expect(management.getInvoicePdf(userId, 'in_owned', 'test', f.overrides))
      .resolves.toEqual({ url: 'https://invoice.stripe.test/in_owned.pdf' });
    await expect(management.getInvoicePdf(userId, 'in_owned', 'live', f.overrides))
      .rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });

    f.stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_other',
      customer: 'cus_other',
      subscription: 'sub_other',
      livemode: false,
      invoice_pdf: 'https://invoice.stripe.test/in_other.pdf',
    });
    await expect(management.getInvoicePdf(userId, 'in_other', 'test', f.overrides))
      .rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });
  });

  test('cancels at the verified billing-period end without proration or refund', async () => {
    const f = managementFixture();
    const result = await cancelSubscription(userId, f.overrides);

    expect(result.effectiveAt).toBe(new Date(periodEnd * 1000).toISOString());
    expect(f.stripe.subscriptions.update).toHaveBeenCalledWith(
      subscriptionId,
      expect.objectContaining({
        cancel_at_period_end: true,
        proration_behavior: 'none',
      }),
      { idempotencyKey: expect.stringContaining('jobblo-subv2-test-') }
    );
    expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
      { _id: f.record._id },
      { $set: expect.objectContaining({ status: 'canceling', autoRenew: false }) }
    );
  });

  test('resume clears scheduled cancellation without creating a new subscription', async () => {
    const f = managementFixture({ cancelAtPeriodEnd: true });
    const result = await resumeSubscription(userId, f.overrides);

    expect(result.effectiveAt).toBe(new Date(periodEnd * 1000).toISOString());
    expect(f.stripe.subscriptions.update).toHaveBeenCalledWith(
      subscriptionId,
      expect.objectContaining({ cancel_at_period_end: false }),
      expect.any(Object)
    );
    expect(f.stripe.subscriptions.update.mock.calls[0][1]).not.toHaveProperty('cancel_at');
  });

  test('repeated cancellation is idempotent and a fully canceled subscription cannot resume', async () => {
    const canceledAtPeriodEnd = managementFixture({ cancelAtPeriodEnd: true });
    canceledAtPeriodEnd.OperationModel.findOne.mockResolvedValue({
      ...canceledAtPeriodEnd.operation,
      operationType: 'cancel',
      status: 'reconciliation_required',
      lifecycleLock: true,
    });
    await cancelSubscription(userId, canceledAtPeriodEnd.overrides);
    expect(canceledAtPeriodEnd.stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(canceledAtPeriodEnd.OperationModel.updateOne).toHaveBeenCalledWith(
      { _id: canceledAtPeriodEnd.operation._id },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'succeeded' }),
        $unset: { lifecycleLock: 1 },
      })
    );

    const alreadyResumed = managementFixture();
    alreadyResumed.OperationModel.findOne.mockResolvedValue({
      ...alreadyResumed.operation,
      operationType: 'resume',
      status: 'reconciliation_required',
      lifecycleLock: true,
    });
    await resumeSubscription(userId, alreadyResumed.overrides);
    expect(alreadyResumed.OperationModel.updateOne).toHaveBeenCalledWith(
      { _id: alreadyResumed.operation._id },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'succeeded' }),
        $unset: { lifecycleLock: 1 },
      })
    );

    const fullyCanceled = managementFixture({ cancelAtPeriodEnd: true });
    fullyCanceled.subscription.status = 'canceled';
    await expect(resumeSubscription(userId, fullyCanceled.overrides)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_NOT_RESUMABLE',
    });
    expect(fullyCanceled.stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  test('cancels only the verified V2 downgrade schedule and keeps the current plan', async () => {
    const f = managementFixture();
    const downgradeOperation = {
      operationId: 'downgrade-op',
      operationType: 'downgrade',
      status: 'succeeded',
      userId,
      subscriptionId: f.record._id,
      targetPlanId,
      stripeScheduleId: 'sub_sched',
      stripeSubscriptionId: subscriptionId,
      stripeMode: 'test',
    };
    const pending = {
      targetPlanId,
      targetPlanType: 'private',
      targetStripePriceId: 'price_target',
      effectiveAt: new Date(periodEnd * 1000),
      operationId: downgradeOperation.operationId,
      stripeScheduleId: downgradeOperation.stripeScheduleId,
    };
    f.record.pendingPlanChange = pending;
    f.OperationModel.findOne.mockImplementation((query) =>
      query.operationType === 'downgrade' ? Promise.resolve(downgradeOperation) : Promise.resolve(null)
    );
    const schedule = {
      id: pending.stripeScheduleId,
      subscription: subscriptionId,
      status: 'active',
      metadata: {
        subscriptionV2: 'true',
        userId: String(userId),
        subscriptionId: String(f.record._id),
        planId: String(targetPlanId),
        operationId: pending.operationId,
        stripeMode: 'test',
      },
      phases: [
        {
          start_date: periodStart,
          end_date: periodEnd,
          items: [{ price: 'price_current', quantity: 1 }],
        },
        {
          start_date: periodEnd,
          items: [{ price: pending.targetStripePriceId, quantity: 1 }],
        },
      ],
    };
    let scheduleStatus = 'active';
    f.stripe.subscriptionSchedules.retrieve.mockImplementation(async () => ({
      ...schedule,
      status: scheduleStatus,
    }));
    f.stripe.subscriptionSchedules.release = jest.fn(async () => {
      scheduleStatus = 'released';
    });

    await expect(cancelScheduledPlanChange(userId, f.overrides)).resolves.toEqual({
      canceled: true,
      message: 'Den planlagte nedgraderingen er avbrutt',
    });
    expect(f.stripe.subscriptionSchedules.release).toHaveBeenCalledWith(
      pending.stripeScheduleId,
      { preserve_cancel_date: false },
      { idempotencyKey: expect.stringMatching(/^jobblo-subv2-test-/) }
    );
    expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
      {
        _id: f.record._id,
        'pendingPlanChange.operationId': pending.operationId,
        'pendingPlanChange.stripeScheduleId': pending.stripeScheduleId,
      },
      { $set: { pendingPlanChange: null } }
    );
  });

  test('does not release an unowned downgrade schedule', async () => {
    const f = managementFixture();
    f.record.pendingPlanChange = {
      targetPlanId,
      targetPlanType: 'private',
      targetStripePriceId: 'price_target',
      effectiveAt: new Date(periodEnd * 1000),
      operationId: 'downgrade-op',
      stripeScheduleId: 'sub_sched',
    };
    f.OperationModel.findOne.mockResolvedValue({
      operationId: 'downgrade-op',
      operationType: 'downgrade',
      status: 'succeeded',
      userId,
      subscriptionId: f.record._id,
      targetPlanId,
      stripeScheduleId: 'sub_sched',
      stripeSubscriptionId: subscriptionId,
      stripeMode: 'test',
    });
    f.stripe.subscriptionSchedules.retrieve.mockResolvedValue({
      id: 'sub_sched',
      subscription: subscriptionId,
      status: 'active',
      metadata: { subscriptionV2: 'true', userId: 'someone-else' },
      phases: [{ start_date: periodEnd, items: [{ price: 'price_target', quantity: 1 }] }],
    });
    f.stripe.subscriptionSchedules.release = jest.fn();

    await expect(cancelScheduledPlanChange(userId, f.overrides)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_SCHEDULE_NOT_OWNED',
    });
    expect(f.stripe.subscriptionSchedules.release).not.toHaveBeenCalled();
  });

  test('reconciles an already released schedule after a concurrent request cleared the pending change', async () => {
    const f = managementFixture();
    const pending = {
      targetPlanId,
      targetPlanType: 'private',
      targetStripePriceId: 'price_target',
      effectiveAt: new Date(periodEnd * 1000),
      operationId: 'downgrade-op',
      stripeScheduleId: 'sub_sched',
    };
    f.record.pendingPlanChange = pending;
    f.SubscriptionModel.findOne
      .mockReturnValueOnce(lean(f.record))
      .mockReturnValueOnce(lean({ ...f.record, pendingPlanChange: null }));
    f.OperationModel.findOne.mockImplementation((query) =>
      query.operationType === 'downgrade'
        ? Promise.resolve({
            operationId: pending.operationId,
            operationType: 'downgrade',
            status: 'succeeded',
            userId,
            subscriptionId: f.record._id,
            targetPlanId,
            stripeScheduleId: pending.stripeScheduleId,
            stripeSubscriptionId: subscriptionId,
            stripeMode: 'test',
          })
        : Promise.resolve(null)
    );
    const schedule = {
      id: pending.stripeScheduleId,
      subscription: subscriptionId,
      status: 'released',
      metadata: {
        subscriptionV2: 'true',
        userId: String(userId),
        subscriptionId: String(f.record._id),
        planId: String(targetPlanId),
        operationId: pending.operationId,
        stripeMode: 'test',
      },
      phases: [
        {
          start_date: periodStart,
          end_date: periodEnd,
          items: [{ price: 'price_current', quantity: 1 }],
        },
        { start_date: periodEnd, items: [{ price: 'price_target', quantity: 1 }] },
      ],
    };
    f.stripe.subscriptionSchedules.retrieve.mockResolvedValue(schedule);
    f.stripe.subscriptionSchedules.release = jest.fn();
    f.SubscriptionModel.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    await expect(cancelScheduledPlanChange(userId, f.overrides)).resolves.toMatchObject({
      canceled: true,
    });
    expect(f.stripe.subscriptionSchedules.release).not.toHaveBeenCalled();
  });

  test('clears a pending change whose schedule was already released in Stripe (subscription: null)', async () => {
    // Stripe nulls `subscription` on release and moves the id to `released_subscription`.
    // The verification compared only `subscription`, so a downgrade cancelled in the
    // billing portal could never be cleared from the app: 409 SCHEDULE_NOT_OWNED forever.
    const f = managementFixture();
    const pending = {
      targetPlanId,
      targetPlanType: 'private',
      targetStripePriceId: 'price_target',
      effectiveAt: new Date(periodEnd * 1000),
      operationId: 'downgrade-op',
      stripeScheduleId: 'sub_sched',
    };
    f.record.pendingPlanChange = pending;
    f.OperationModel.findOne.mockImplementation((query) =>
      query.operationType === 'downgrade'
        ? Promise.resolve({
            operationId: pending.operationId,
            operationType: 'downgrade',
            status: 'succeeded',
            userId,
            subscriptionId: f.record._id,
            targetPlanId,
            stripeScheduleId: pending.stripeScheduleId,
            stripeSubscriptionId: subscriptionId,
            stripeMode: 'test',
          })
        : Promise.resolve(null)
    );
    f.stripe.subscriptionSchedules.retrieve.mockResolvedValue({
      id: pending.stripeScheduleId,
      subscription: null,
      released_subscription: subscriptionId,
      status: 'released',
      metadata: {
        subscriptionV2: 'true',
        userId: String(userId),
        subscriptionId: String(f.record._id),
        planId: String(targetPlanId),
        operationId: pending.operationId,
        stripeMode: 'test',
      },
      phases: [
        { start_date: periodStart, end_date: periodEnd, items: [{ price: 'price_current', quantity: 1 }] },
        { start_date: periodEnd, items: [{ price: 'price_target', quantity: 1 }] },
      ],
    });
    f.stripe.subscriptionSchedules.release = jest.fn();

    await expect(cancelScheduledPlanChange(userId, f.overrides)).resolves.toMatchObject({ canceled: true });
    expect(f.stripe.subscriptionSchedules.release).not.toHaveBeenCalled();
    expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'pendingPlanChange.stripeScheduleId': pending.stripeScheduleId }),
      { $set: { pendingPlanChange: null } }
    );
  });

  test('previews an immediate upgrade and applies it with the same proration policy', async () => {
    const f = managementFixture();
    f.OperationModel.create.mockImplementation(async (data) =>
      new SubscriptionBillingOperationV2(data)
    );
    const preview = await previewPlanChange(userId, targetPlanId, f.overrides);
    expect(preview).toEqual(expect.objectContaining({
      strategy: 'immediate',
      amountDueNow: 5000,
      currency: 'nok',
      targetPlan: 'Target',
    }));
    expect(f.stripe.invoices.createPreview).toHaveBeenCalledWith(expect.objectContaining({
      subscription: subscriptionId,
      subscription_details: expect.objectContaining({
        proration_behavior: 'always_invoice',
        billing_cycle_anchor: 'unchanged',
      }),
    }));

    await changePlan(userId, targetPlanId, f.overrides);
    const operationId = f.OperationModel.create.mock.calls[0][0].operationId;
    expect(f.stripe.subscriptions.update).toHaveBeenCalledWith(
      subscriptionId,
      expect.objectContaining({
        proration_behavior: 'always_invoice',
        payment_behavior: 'pending_if_incomplete',
        billing_cycle_anchor: 'unchanged',
        items: [{ id: 'si_management', price: 'price_target', quantity: 1 }],
        metadata: {
          subscriptionV2: 'true',
          userId: String(userId),
          planId: String(targetPlanId),
          operationId,
          stripeMode: 'test',
        },
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining('jobblo-subv2-test-') })
    );
    expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  });

  test('schedules downgrade at period end without changing the active subscription item now', async () => {
    const f = managementFixture();
    f.targetPlan.price = 49;
    f.stripe.prices.retrieve.mockResolvedValue({
      id: 'price_target',
      active: true,
      livemode: false,
      type: 'recurring',
      currency: 'nok',
      unit_amount: 4900,
      recurring: { interval: 'month', interval_count: 1 },
    });
    const result = await changePlan(userId, targetPlanId, f.overrides);
    const operationKey = f.OperationModel.create.mock.calls[0][0].idempotencyKey;

    expect(result.strategy).toBe('period_end');
    expect(result.effectiveAt).toBe(new Date(periodEnd * 1000).toISOString());
    expect(f.stripe.subscriptionSchedules.create).toHaveBeenCalledWith(
      expect.objectContaining({
        from_subscription: subscriptionId,
      }),
      expect.any(Object)
    );
    expect(f.stripe.subscriptionSchedules.create.mock.calls[0][0]).not.toHaveProperty('metadata');
    expect(f.stripe.subscriptionSchedules.create.mock.calls[0][0]).not.toHaveProperty('end_behavior');
    expect(f.stripe.subscriptionSchedules.create.mock.calls[0][1]).toEqual({
      idempotencyKey: `jobblo-subv2-test-${operationKey}-schedule-create`,
    });
    expect(f.stripe.subscriptionSchedules.update).toHaveBeenCalledWith(
      'sub_sched',
      expect.objectContaining({
        end_behavior: 'release',
        metadata: {
          subscriptionV2: 'true',
          userId: String(userId),
          subscriptionId: String(f.record._id),
          planId: String(targetPlanId),
          operationId: expect.any(String),
          stripeMode: 'test',
        },
        phases: expect.arrayContaining([
          expect.objectContaining({ end_date: periodEnd }),
          expect.objectContaining({
            items: [{ price: 'price_target', quantity: 1 }],
            proration_behavior: 'none',
          }),
        ]),
      }),
      {
        idempotencyKey: `jobblo-subv2-test-${operationKey}-schedule-update`,
      }
    );
    expect(f.stripe.subscriptionSchedules.create.mock.calls[0][1].idempotencyKey)
      .not.toBe(f.stripe.subscriptionSchedules.update.mock.calls[0][2].idempotencyKey);
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
      { _id: f.record._id },
      { $set: { pendingPlanChange: expect.objectContaining({ targetPlanId }) } }
    );
  });

  test('fails and releases the lifecycle lock when Stripe rejects schedule creation before execution', async () => {
    const f = managementFixture();
    f.targetPlan.price = 49;
    f.stripe.prices.retrieve.mockResolvedValue({
      id: 'price_target',
      active: true,
      livemode: false,
      type: 'recurring',
      currency: 'nok',
      unit_amount: 4900,
      recurring: { interval: 'month', interval_count: 1 },
    });
    const stripeError = new Error('sensitive raw Stripe message');
    Object.assign(stripeError, {
      type: 'StripeInvalidRequestError',
      rawType: 'invalid_request_error',
      statusCode: 400,
      requestId: 'req_test_invalid_schedule',
    });
    f.stripe.subscriptionSchedules.create.mockRejectedValue(stripeError);

    await expect(changePlan(userId, targetPlanId, f.overrides)).rejects.toMatchObject({
      status: 502,
      code: 'SUBSCRIPTION_SCHEDULE_REJECTED',
    });

    expect(f.OperationModel.updateOne).toHaveBeenLastCalledWith(
      { _id: f.operation._id, status: 'pending', lifecycleLock: true },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          lastErrorType: 'invalid_request_error',
          lastErrorHttpStatus: 400,
          stripeRequestId: 'req_test_invalid_schedule',
          lastFailureStage: 'schedule_create',
          lastErrorMessage: 'Stripe rejected schedule creation before execution.',
        }),
        $unset: { lifecycleLock: 1 },
      })
    );
    expect(f.OperationModel.updateOne.mock.calls.at(-1)[1].$set.lastErrorMessage)
      .not.toContain('sensitive raw Stripe message');
    expect(f.stripe.subscriptionSchedules.update).not.toHaveBeenCalled();
    expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  });

  test('keeps the lifecycle lock and records the stage when schedule creation has an unknown outcome', async () => {
    const f = managementFixture();
    f.targetPlan.price = 49;
    f.stripe.prices.retrieve.mockResolvedValue({
      id: 'price_target',
      active: true,
      livemode: false,
      type: 'recurring',
      currency: 'nok',
      unit_amount: 4900,
      recurring: { interval: 'month', interval_count: 1 },
    });
    const stripeError = Object.assign(new Error('network timeout'), {
      type: 'StripeConnectionError',
    });
    f.stripe.subscriptionSchedules.create.mockRejectedValue(stripeError);

    await expect(changePlan(userId, targetPlanId, f.overrides)).rejects.toMatchObject({
      status: 503,
      code: 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
    });

    expect(f.OperationModel.updateOne).toHaveBeenLastCalledWith(
      { _id: f.operation._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'reconciliation_required',
          lastErrorType: 'StripeConnectionError',
          lastFailureStage: 'schedule_create',
        }),
      })
    );
    const audit = f.OperationModel.updateOne.mock.calls.at(-1)[1].$set;
    expect(audit.lastErrorCode).toBe('stripe_outcome_unknown');
    expect(f.OperationModel.updateOne.mock.calls.at(-1)[1].$unset).toBeUndefined();
    expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  });

  test('reuses a pending operation idempotency key and does not replace an unknown Stripe schedule', async () => {
    const retry = managementFixture();
    retry.OperationModel.findOne.mockResolvedValue({
      ...retry.operation,
      operationType: 'upgrade',
      targetPlanId,
      status: 'pending',
      lifecycleLock: true,
    });
    await changePlan(userId, targetPlanId, retry.overrides);
    expect(retry.OperationModel.create).not.toHaveBeenCalled();
    expect(retry.stripe.subscriptions.update.mock.calls[0][2]).toEqual({
      idempotencyKey: 'jobblo-subv2-test-management-key',
    });

    const scheduled = managementFixture();
    scheduled.targetPlan.price = 49;
    scheduled.subscription.schedule = 'sub_existing_schedule';
    scheduled.stripe.prices.retrieve.mockResolvedValue({
      id: 'price_target',
      active: true,
      livemode: false,
      type: 'recurring',
      currency: 'nok',
      unit_amount: 4900,
      recurring: { interval: 'month', interval_count: 1 },
    });
    await expect(changePlan(userId, targetPlanId, scheduled.overrides)).rejects.toMatchObject({
      status: 409,
      code: 'SUBSCRIPTION_PLAN_CHANGE_PENDING',
    });
    expect(scheduled.stripe.subscriptionSchedules.update).not.toHaveBeenCalled();
  });

  test('rejects owner mismatches and holds an existing reconciliation lock', async () => {
    const ownerMismatch = managementFixture();
    ownerMismatch.subscription.customer = 'cus_other';
    await expect(cancelSubscription(userId, ownerMismatch.overrides)).rejects.toMatchObject({
      status: 403,
      code: 'SUBSCRIPTION_OWNERSHIP_MISMATCH',
    });

    const locked = managementFixture();
    locked.OperationModel.findOne.mockResolvedValue({
      ...locked.operation,
      operationType: 'cancel',
      status: 'reconciliation_required',
      lifecycleLock: true,
    });
    await expect(cancelSubscription(userId, locked.overrides)).rejects.toBeInstanceOf(
      SubscriptionManagementError
    );
    expect(locked.stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  test('rejects a concurrent different lifecycle operation and reconciles an unknown Stripe result', async () => {
    const concurrent = managementFixture();
    const competingOperation = {
      ...concurrent.operation,
      operationType: 'upgrade',
      targetPlanId,
      status: 'pending',
      lifecycleLock: true,
    };
    concurrent.OperationModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(competingOperation);
    const duplicate = new Error('duplicate key');
    duplicate.code = 11000;
    concurrent.OperationModel.create.mockRejectedValue(duplicate);
    await expect(cancelSubscription(userId, concurrent.overrides)).rejects.toMatchObject({
      status: 409,
      code: 'SUBSCRIPTION_OPERATION_IN_PROGRESS',
    });
    expect(concurrent.stripe.subscriptions.update).not.toHaveBeenCalled();

    const unknown = managementFixture();
    unknown.stripe.subscriptions.update.mockRejectedValue(new Error('network timeout'));
    await expect(changePlan(userId, targetPlanId, unknown.overrides)).rejects.toMatchObject({
      status: 503,
      code: 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
    });
    expect(unknown.OperationModel.updateOne).toHaveBeenLastCalledWith(
      { _id: unknown.operation._id },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'reconciliation_required' }),
      })
    );
    expect(unknown.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  });

  test('reconciles a verified paid upgrade webhook before changing the stored plan', async () => {
    const f = managementFixture();
    const upgradeOperation = {
      ...f.operation,
      operationId: 'upgrade-op',
      operationType: 'upgrade',
      status: 'pending',
      targetPlanId,
      subscriptionId: f.record._id,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: 'price_target',
    };
    const metadata = {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(targetPlanId),
      operationId: upgradeOperation.operationId,
      stripeMode: 'test',
    };
    const invoice = {
      id: 'in_upgrade',
      status: 'paid',
      livemode: false,
      billing_reason: 'subscription_update',
      customer: customerId,
      currency: 'nok',
      parent: {
        subscription_details: { subscription: subscriptionId, metadata },
      },
    };
    const updatedSubscription = {
      ...f.subscription,
      metadata,
      latest_invoice: invoice,
      items: {
        data: [{
          current_period_start: periodStart,
          current_period_end: periodEnd,
          price: {
            id: 'price_target',
            active: true,
            livemode: false,
            type: 'recurring',
            currency: 'nok',
            recurring: { interval: 'month', interval_count: 1 },
          },
        }],
      },
    };
    f.OperationModel.findOne.mockResolvedValue(upgradeOperation);
    f.SubscriptionModel.findOne.mockReturnValue(lean(f.record));
    f.stripe.invoices.retrieve.mockResolvedValue(invoice);
    f.stripe.subscriptions.retrieve.mockResolvedValue(updatedSubscription);
    f.PlanModel.findById.mockReturnValue(lean(f.targetPlan));
    f.EventModel = {
      create: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })),
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    };

    const result = await processVerifiedEvent({
      id: 'evt_upgrade_paid',
      type: 'invoice.paid',
      livemode: false,
      data: { object: invoice },
    }, 'test', f.stripe, {
      EventModel: f.EventModel,
      SubscriptionModel: f.SubscriptionModel,
      OperationModel: f.OperationModel,
      PlanModel: f.PlanModel,
      UsageModel: f.UsageModel,
    });

    expect(result).toEqual({ handled: 'subscription_upgrade_confirmed' });
    expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: f.record._id,
        userId,
        stripeMode: 'test',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        planId: { $in: [currentPlanId, targetPlanId] },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          planId: targetPlanId,
          stripePriceId: 'price_target',
        }),
        $addToSet: { planHistory: expect.objectContaining({ changeType: 'upgrade' }) },
      }),
      { runValidators: true }
    );
    expect(f.OperationModel.updateOne).toHaveBeenCalledWith(
      { _id: upgradeOperation._id, status: { $in: ['pending', 'reconciliation_required'] } },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'succeeded' }),
        $unset: { lifecycleLock: 1 },
      })
    );
  });

  test('acknowledges a late paid-upgrade event after its operation is already reconciled', async () => {
    const f = managementFixture();
    const operation = {
      ...f.operation,
      operationId: 'upgrade-op',
      operationType: 'upgrade',
      status: 'succeeded',
      targetPlanId,
      subscriptionId: f.record._id,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: 'price_target',
      stripeInvoiceId: 'in_upgrade',
      lifecycleLock: false,
    };
    const metadata = {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(targetPlanId),
      operationId: operation.operationId,
      stripeMode: 'test',
    };
    const invoice = {
      id: operation.stripeInvoiceId,
      status: 'paid',
      livemode: false,
      billing_reason: 'subscription_update',
      customer: customerId,
      parent: {
        subscription_details: { subscription: subscriptionId, metadata },
      },
    };
    f.record.planId = targetPlanId;
    f.record.stripePriceId = operation.stripePriceId;
    f.OperationModel.findOne.mockResolvedValue(operation);
    f.SubscriptionModel.findOne.mockReturnValue(lean(f.record));
    f.stripe.invoices.retrieve.mockResolvedValue(invoice);
    f.stripe.subscriptions.retrieve.mockResolvedValue({
      ...f.subscription,
      metadata,
      latest_invoice: invoice,
    });
    f.EventModel = {
      create: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })),
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    };

    await expect(processVerifiedEvent({
      id: 'evt_late_upgrade_paid',
      type: 'invoice.paid',
      livemode: false,
      data: { object: invoice },
    }, 'test', f.stripe, {
      EventModel: f.EventModel,
      SubscriptionModel: f.SubscriptionModel,
      OperationModel: f.OperationModel,
      PlanModel: f.PlanModel,
      UsageModel: f.UsageModel,
    })).resolves.toEqual({ handled: 'subscription_upgrade_already_confirmed' });

    expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
    expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(f.OperationModel.updateOne).not.toHaveBeenCalled();
  });

  test.each([
    ['customer.subscription.updated', 'usage-period creation'],
    ['customer.subscription.updated', 'allowance update'],
    ['customer.subscription.updated', 'operation completion'],
    ['invoice.paid', 'usage-period creation'],
    ['invoice.paid', 'allowance update'],
    ['invoice.paid', 'operation completion'],
  ])('resumes a %s paid upgrade safely after a %s failure', async (eventType, failAt) => {
    const f = managementFixture();
    f.record.planHistory = [];
    const upgradeOperation = {
      ...f.operation,
      operationId: 'upgrade-op',
      operationType: 'upgrade',
      status: 'pending',
      targetPlanId,
      subscriptionId: f.record._id,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: 'price_target',
    };
    const metadata = {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(targetPlanId),
      operationId: upgradeOperation.operationId,
      stripeMode: 'test',
    };
    const invoice = {
      id: 'in_upgrade',
      status: 'paid',
      livemode: false,
      billing_reason: 'subscription_update',
      customer: customerId,
      parent: {
        subscription_details: { subscription: subscriptionId, metadata },
      },
    };
    const updatedSubscription = {
      ...f.subscription,
      metadata,
      latest_invoice: invoice,
      items: {
        data: [{
          current_period_start: periodStart,
          current_period_end: periodEnd,
          price: {
            id: 'price_target',
            active: true,
            livemode: false,
            type: 'recurring',
            currency: 'nok',
            recurring: { interval: 'month', interval_count: 1 },
          },
        }],
      },
    };
    const usage = {
      _id: new mongoose.Types.ObjectId(),
      periodType: 'paid',
      includedContacts: 15,
      consumedIncludedContacts: 7,
    };
    let faultInjected = false;
    f.SubscriptionModel.findOne.mockReturnValue(lean(f.record));
    f.SubscriptionModel.updateOne.mockImplementation(async (_filter, update) => {
      Object.assign(f.record, update.$set);
      const history = update.$addToSet?.planHistory;
      if (history && !f.record.planHistory.some((entry) => entry.operationId === history.operationId)) {
        f.record.planHistory.push(history);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    });
    f.OperationModel.findOne.mockResolvedValue(upgradeOperation);
    f.OperationModel.updateOne.mockImplementation(async (_filter, update) => {
      if (failAt === 'operation completion' && update.$set?.status === 'succeeded' && !faultInjected) {
        faultInjected = true;
        throw new Error('injected operation completion failure');
      }
      if (update.$set) Object.assign(upgradeOperation, update.$set);
      if (update.$unset?.lifecycleLock) delete upgradeOperation.lifecycleLock;
      return { matchedCount: 1, modifiedCount: 1 };
    });
    f.UsageModel.findOneAndUpdate.mockImplementation(async () => {
      if (failAt === 'usage-period creation' && !faultInjected) {
        faultInjected = true;
        throw new Error('injected usage period creation failure');
      }
      return usage;
    });
    f.UsageModel.updateOne.mockImplementation(async (_filter, update) => {
      if (failAt === 'allowance update' && !faultInjected) {
        faultInjected = true;
        throw new Error('injected usage allowance failure');
      }
      Object.assign(usage, update.$set);
      return { matchedCount: 1, modifiedCount: 1 };
    });
    f.stripe.invoices.retrieve.mockResolvedValue(invoice);
    f.stripe.subscriptions.retrieve.mockResolvedValue(updatedSubscription);
    f.PlanModel.findById.mockReturnValue(lean(f.targetPlan));

    let savedEvent;
    const EventModel = {
      create: jest.fn(async (data) => {
        if (savedEvent) {
          const duplicate = new Error('duplicate event');
          duplicate.code = 11000;
          throw duplicate;
        }
        savedEvent = { ...data, _id: new mongoose.Types.ObjectId(), updatedAt: new Date() };
        return savedEvent;
      }),
      findOne: jest.fn(async () => savedEvent),
      findOneAndUpdate: jest.fn(async (_filter, update) => {
        if (savedEvent.status === 'failed') {
          Object.assign(savedEvent, update.$set);
          return savedEvent;
        }
        return null;
      }),
      updateOne: jest.fn(async (_filter, update) => {
        Object.assign(savedEvent, update.$set);
        return { matchedCount: 1, modifiedCount: 1 };
      }),
    };
    const event = {
      id: 'evt_upgrade_retry',
      type: eventType,
      livemode: false,
      data: {
        object: eventType === 'invoice.paid'
          ? invoice
          : { id: subscriptionId, metadata },
      },
    };
    const dependencies = {
      EventModel,
      SubscriptionModel: f.SubscriptionModel,
      OperationModel: f.OperationModel,
      PlanModel: f.PlanModel,
      UsageModel: f.UsageModel,
    };

    await expect(processVerifiedEvent(event, 'test', f.stripe, dependencies))
      .rejects.toThrow(`injected ${failAt === 'usage-period creation'
        ? 'usage period creation'
        : failAt === 'allowance update'
          ? 'usage allowance'
          : 'operation completion'} failure`);
    expect(upgradeOperation.status).toBe('pending');
    expect(upgradeOperation.lifecycleLock).toBe(true);
    await expect(processVerifiedEvent(event, 'test', f.stripe, dependencies))
      .resolves.toEqual({ handled: 'subscription_upgrade_confirmed' });

    expect(f.record.planId).toEqual(targetPlanId);
    expect(f.record.planHistory.filter((entry) => entry.operationId === upgradeOperation.operationId))
      .toHaveLength(1);
    expect(usage.includedContacts).toBe(35);
    expect(usage.consumedIncludedContacts).toBe(7);
    expect(upgradeOperation.status).toBe('succeeded');
    expect(upgradeOperation.lifecycleLock).toBeUndefined();
    expect(faultInjected).toBe(true);
  });

  const nextEnd = Math.floor(new Date('2026-12-01T00:00:00Z').getTime() / 1000);
  const renewalLine = (start, end) => ({ lines: { data: [{ period: { start, end } }] } });
  test.each([
    // The renewal invoice for the new period is created but not charged yet: the plan
    // changes, but no paid allowance for an unpaid period (invoice.paid grants it).
    ['renewal invoice not paid yet', { id: 'in_r', status: 'draft' }, false],
    ['renewal invoice paid', { id: 'in_r', status: 'paid', billing_reason: 'subscription_cycle', ...renewalLine(periodEnd, nextEnd) }, true],
    ["only the previous period's invoice is paid", { id: 'in_old', status: 'paid', billing_reason: 'subscription_cycle', ...renewalLine(periodEnd - 30 * 86400, periodEnd) }, false],
  ])('applies a downgrade only after the owned Stripe schedule reaches its target phase (%s)', async (_label, latestInvoice, grantsAllowance) => {
    const f = managementFixture();
    const operation = {
      ...f.operation,
      operationId: 'downgrade-op',
      operationType: 'downgrade',
      status: 'succeeded',
      targetPlanId,
      subscriptionId: f.record._id,
      stripeScheduleId: 'sub_sched',
      stripeSubscriptionId: subscriptionId,
      stripePriceId: 'price_target',
    };
    const effectiveAt = new Date(periodEnd * 1000);
    f.record.pendingPlanChange = {
      targetPlanId,
      effectiveAt,
      operationId: operation.operationId,
      stripeScheduleId: operation.stripeScheduleId,
    };
    f.targetPlan.price = 49;
    f.targetPlan.stripePriceIdTest = 'price_target';
    const nextPeriodEnd = Math.floor(new Date('2026-12-01T00:00:00Z').getTime() / 1000);
    const metadata = {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(targetPlanId),
      operationId: operation.operationId,
      stripeMode: 'test',
    };
    const canonical = {
      ...f.subscription,
      metadata,
      latest_invoice: {
        customer: customerId,
        parent: { subscription_details: { subscription: subscriptionId } },
        ...latestInvoice,
      },
      items: {
        data: [{
          current_period_start: periodEnd,
          current_period_end: nextPeriodEnd,
          price: {
            id: 'price_target',
            active: true,
            livemode: false,
            type: 'recurring',
            currency: 'nok',
            recurring: { interval: 'month', interval_count: 1 },
          },
        }],
      },
    };
    f.OperationModel.findOne.mockResolvedValue(operation);
    f.SubscriptionModel.findOne.mockReturnValue(lean(f.record));
    f.stripe.subscriptions.retrieve.mockResolvedValue(canonical);
    f.stripe.subscriptionSchedules.retrieve.mockResolvedValue({
      id: 'sub_sched',
      status: 'active',
      metadata: {
        subscriptionV2: 'true',
        userId: String(userId),
        subscriptionId: String(f.record._id),
        stripeMode: 'test',
        planId: String(targetPlanId),
        operationId: operation.operationId,
      },
      current_phase: { start_date: periodEnd },
      phases: [{
        start_date: periodEnd,
        items: [{ price: 'price_target', quantity: 1 }],
      }],
    });
    f.EventModel = {
      create: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })),
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    };

    const result = await processVerifiedEvent({
      id: 'evt_downgrade_effective',
      type: 'customer.subscription.updated',
      livemode: false,
      data: { object: { id: subscriptionId, metadata } },
    }, 'test', f.stripe, {
      EventModel: f.EventModel,
      SubscriptionModel: f.SubscriptionModel,
      OperationModel: f.OperationModel,
      PlanModel: f.PlanModel,
      UsageModel: f.UsageModel,
    });

    expect(result).toEqual({ handled: 'subscription_downgrade_confirmed' });
    expect(f.stripe.subscriptionSchedules.retrieve).toHaveBeenCalledWith('sub_sched');
    expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: f.record._id,
        userId,
        stripeMode: 'test',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        planId: { $in: [currentPlanId, targetPlanId] },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ planId: targetPlanId, pendingPlanChange: null }),
        $addToSet: { planHistory: expect.objectContaining({ changeType: 'downgrade' }) },
      }),
      { runValidators: true }
    );
    if (grantsAllowance) {
      expect(f.UsageModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId, billingPeriodStart: new Date(periodEnd * 1000) },
        expect.anything(),
        expect.anything()
      );
    } else {
      expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(f.UsageModel.updateOne).not.toHaveBeenCalled();
    }
  });

  test('does not grant an upgrade when the canonical invoice payment failed', async () => {
    const f = managementFixture();
    const upgradeOperation = {
      ...f.operation,
      operationId: 'upgrade-failed-op',
      operationType: 'upgrade',
      status: 'pending',
      targetPlanId,
      stripeSubscriptionId: subscriptionId,
    };
    const metadata = {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(targetPlanId),
      operationId: upgradeOperation.operationId,
      stripeMode: 'test',
    };
    const invoice = {
      id: 'in_upgrade_failed',
      status: 'open',
      customer: customerId,
      currency: 'nok',
      parent: {
        subscription_details: { subscription: subscriptionId, metadata },
      },
    };
    const canonical = { ...f.subscription, metadata };
    f.OperationModel.findOne.mockResolvedValue(upgradeOperation);
    f.OperationModel.findOneAndUpdate = jest.fn(async () => upgradeOperation);
    f.SubscriptionModel.findOne.mockReturnValue(lean(f.record));
    f.stripe.invoices.retrieve.mockResolvedValue(invoice);
    f.stripe.subscriptions.retrieve.mockResolvedValue(canonical);
    f.EventModel = {
      create: jest.fn(async () => ({ _id: new mongoose.Types.ObjectId() })),
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    };

    const result = await processVerifiedEvent({
      id: 'evt_upgrade_failed',
      type: 'invoice.payment_failed',
      livemode: false,
      created: periodStart,
      data: { object: invoice },
    }, 'test', f.stripe, {
      EventModel: f.EventModel,
      SubscriptionModel: f.SubscriptionModel,
      OperationModel: f.OperationModel,
      PlanModel: f.PlanModel,
      UsageModel: f.UsageModel,
    });

    expect(result).toEqual({ handled: 'subscription_upgrade_payment_failed' });
    expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
      { _id: f.record._id },
      { $set: expect.objectContaining({ status: 'past_due' }) }
    );
    expect(f.SubscriptionModel.updateOne.mock.calls[0][1].$set).not.toHaveProperty('planId');
    expect(f.OperationModel.updateOne).toHaveBeenCalledWith(
      { _id: upgradeOperation._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'reconciliation_required',
          lastErrorCode: 'upgrade_payment_failed',
        }),
      })
    );
  });
});
