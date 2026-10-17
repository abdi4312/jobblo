const mongoose = require('mongoose');
const {
  enabled,
  freeCalendarPeriod,
  resolveEntitlements,
  consumeApplicationContact,
  releaseContact,
} = require('../services/subscriptions/v2Entitlements');

const userId = new mongoose.Types.ObjectId();
const subscriptionId = new mongoose.Types.ObjectId();
const planId = new mongoose.Types.ObjectId();
const start = new Date('2026-10-01T00:00:00.000Z');
const end = new Date('2026-11-01T00:00:00.000Z');

function query(value) {
  return {
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function fixture({
  accountType = 'private',
  stripeStatus = 'active',
  cancelAtPeriodEnd = false,
  recordStatus = 'active',
  usage = null,
  noUsage = false,
  includedContacts = 5,
  periodStart = start,
  periodEnd = end,
  now = new Date('2026-10-16T12:00:00.000Z'),
  paymentRecoveryStatus = 'none',
  gracePeriodEndsAt = null,
  recoveryUsagePeriodStart = periodStart,
  record: recordOverride,
} = {}) {
  const freePlan = {
    _id: planId,
    name: 'Standard',
    price: 0,
    type: 'private',
    entitlements: { freeContact: 5, maxJobsValue: 10000 },
  };
  const paidPlan = {
    _id: planId,
    name: 'Plus',
    price: 99,
    type: accountType,
    stripePriceIdTest: 'price_test',
    stripePriceId: 'price_live',
    entitlements: { freeContact: 15, radius: 50 },
  };
  const record = recordOverride === undefined
    ? accountType === 'business'
      ? { _id: subscriptionId, userId, planId, planType: accountType, stripeMode: 'test',
        stripeCustomerId: 'cus_test', stripeSubscriptionId: 'sub_test', status: recordStatus,
        currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, pendingPlanChange: null,
        paymentRecoveryStatus, gracePeriodEndsAt, recoveryUsagePeriodStart }
      : null
    : recordOverride;
  const stripeSubscription = {
    id: 'sub_test',
    customer: 'cus_test',
    livemode: false,
    status: stripeStatus,
    cancel_at_period_end: cancelAtPeriodEnd,
    metadata: {
      subscriptionV2: 'true',
      userId: String(userId),
      planId: String(planId),
      stripeMode: 'test',
    },
    items: { data: [{
      current_period_start: periodStart.getTime() / 1000,
      current_period_end: periodEnd.getTime() / 1000,
      price: {
        id: 'price_test',
        active: true,
        livemode: false,
        currency: 'nok',
        type: 'recurring',
        unit_amount: 9900,
        recurring: { interval: 'month', interval_count: 1 },
      },
    }] },
  };
  let freeUsage = null;
  const storedUsage = noUsage ? null : usage || (record
    ? {
        _id: new mongoose.Types.ObjectId(),
        userId,
        subscriptionId,
        planId,
        periodType: 'paid',
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        includedContacts,
        consumedIncludedContacts: 2,
        purchasedExtraContacts: 7,
        consumedExtraContacts: 1,
        contactOperations: [],
      }
    : null);
  const UsageModel = {
    findOneAndUpdate: jest.fn(async (_filter, update) => {
      if (record) {
        if (storedUsage) return storedUsage;
        return {
          _id: new mongoose.Types.ObjectId(),
          ...update.$setOnInsert,
        };
      }
      freeUsage ||= {
        _id: new mongoose.Types.ObjectId(),
        userId,
        planId,
        periodType: 'free',
        billingPeriodStart: update.$setOnInsert.billingPeriodStart,
        billingPeriodEnd: update.$setOnInsert.billingPeriodEnd,
        includedContacts: update.$setOnInsert.includedContacts,
        consumedIncludedContacts: 0,
        purchasedExtraContacts: 0,
        consumedExtraContacts: 0,
        contactOperations: [],
      };
      return freeUsage;
    }),
    findOne: jest.fn(() => query(record ? storedUsage : freeUsage)),
    findOneAndUpdateAtomic: jest.fn(),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const UserModel = {
    findById: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({
        _id: userId,
        role: accountType === 'business' ? 'company' : 'user',
        planType: accountType,
      }),
    })),
  };
  const PlanModel = {
    findOne: jest.fn(() => query(accountType === 'private' ? freePlan : null)),
    findById: jest.fn(() => query(paidPlan)),
  };
  const SubscriptionModel = { findOne: jest.fn(() => query(record)) };
  const stripe = {
    subscriptions: { retrieve: jest.fn(async () => stripeSubscription) },
    prices: { retrieve: jest.fn(async () => stripeSubscription.items.data[0].price) },
    invoices: { retrieve: jest.fn() },
  };
  const overrides = {
    UserModel,
    PlanModel,
    SubscriptionModel,
    UsageModel,
    GlobalConfigModel: { findOne: jest.fn(() => query({ value: false })) },
    stripeForMode: jest.fn(async (testMode) => {
      expect(testMode).toBe(true);
      return stripe;
    }),
    now: () => now,
  };
  return {
    freePlan,
    paidPlan,
    record,
    stripeSubscription,
    storedUsage,
    UserModel,
    PlanModel,
    SubscriptionModel,
    UsageModel,
    stripe,
    overrides,
    getFreeUsage: () => freeUsage,
  };
}

function addPrivateV2UsageFixture(f) {
  const record = {
    _id: subscriptionId,
    userId,
    planId,
    planType: 'private',
    stripeMode: 'test',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    status: 'active',
    currentPeriodStart: start,
    currentPeriodEnd: end,
    pendingPlanChange: null,
  };
  const usage = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    subscriptionId,
    planId,
    periodType: 'paid',
    billingPeriodStart: start,
    billingPeriodEnd: end,
    includedContacts: 5,
    consumedIncludedContacts: 0,
    purchasedExtraContacts: 0,
    consumedExtraContacts: 0,
    contactOperations: [],
  };
  f.SubscriptionModel.findOne.mockReturnValue(query(record));
  f.UsageModel.findOne = jest.fn(() => query(usage));
  f.UsageModel.findOneAndUpdate.mockImplementation(async (filter, update) => {
    if (!filter.$expr) return usage;
    const operationId = update[0].$set.contactOperations.$concatArrays[1][0].operationId;
    if (usage.contactOperations.some((item) => item.operationId === operationId)) return null;
    usage.consumedIncludedContacts += 1;
    usage.contactOperations.push({ operationId, status: 'consumed' });
    return usage;
  });
  return { record, usage };
}

describe('Subscription V2 entitlements and usage periods', () => {
  test('the feature flag is off unless explicitly enabled', () => {
    expect(enabled({})).toBe(false);
    expect(enabled({ SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED: 'false' })).toBe(false);
    expect(enabled({ SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED: 'true' })).toBe(true);
  });

  test('uses a UTC calendar-month anchor, including leap February', () => {
    expect(freeCalendarPeriod(new Date('2024-02-29T22:30:00-08:00'))).toEqual({
      start: new Date('2024-03-01T00:00:00.000Z'),
      end: new Date('2024-04-01T00:00:00.000Z'),
    });
    expect(freeCalendarPeriod(new Date('2024-02-15T12:00:00.000Z'))).toEqual({
      start: new Date('2024-02-01T00:00:00.000Z'),
      end: new Date('2024-03-01T00:00:00.000Z'),
    });
  });

  test('resolves the private Free plan and reads its allowance from plan data', async () => {
    const f = fixture();
    const result = await resolveEntitlements(userId, f.overrides);
    expect(result).toEqual(expect.objectContaining({
      status: 'free',
      isPaid: false,
      plan: { id: String(planId), name: 'Standard', price: 0 },
      includedContacts: 5,
      remainingIncludedContacts: 5,
      period: expect.objectContaining({ type: 'free' }),
    }));
    expect(f.UsageModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId, billingPeriodStart: new Date('2026-10-01T00:00:00.000Z') },
      { $setOnInsert: expect.objectContaining({
        periodType: 'free',
        includedContacts: 5,
        consumedIncludedContacts: 0,
      }) },
      expect.objectContaining({ upsert: true })
    );
  });

  test('returns a safe no-paid-plan state for a business account without a business Free plan', async () => {
    const f = fixture({ accountType: 'business', record: null });
    f.SubscriptionModel.findOne.mockReturnValue(query(null));
    const result = await resolveEntitlements(userId, f.overrides);
    expect(result).toEqual(expect.objectContaining({
      status: 'no_paid_plan',
      plan: null,
      includedContacts: 0,
      remainingIncludedContacts: 0,
      entitlements: {},
    }));
    expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['active', false, 'active'],
    ['active', true, 'canceling'],
    ['past_due', false, 'past_due'],
  ])('grants only the current verified paid period (%s, canceling=%s)', async (stripeStatus, cancelAtPeriodEnd, status) => {
    const f = fixture({ accountType: 'business', stripeStatus, cancelAtPeriodEnd });
    const result = await resolveEntitlements(userId, f.overrides);
    expect(result).toEqual(expect.objectContaining({
      status,
      isPaid: true,
      plan: { id: String(planId), name: 'Plus', price: 99 },
      includedContacts: 5,
      consumedIncludedContacts: 2,
      remainingIncludedContacts: 3,
      purchasedExtraContacts: 7,
      consumedExtraContacts: 1,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'paid',
      },
    }));
    expect(f.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test', {
      expand: ['items.data.price'],
    });

  });

  test('retains the anchored paid usage during grace without opening a new quota period', async () => {
    const f = fixture({
      accountType: 'business',
      stripeStatus: 'past_due',
      paymentRecoveryStatus: 'retrying',
      gracePeriodEndsAt: new Date('2026-10-23T00:00:00.000Z'),
      recoveryUsagePeriodStart: start,
    });
    const result = await resolveEntitlements(userId, f.overrides);

    expect(result).toEqual(expect.objectContaining({
      status: 'past_due',
      isPaid: true,
      includedContacts: 5,
      consumedIncludedContacts: 2,
      remainingIncludedContacts: 3,
      period: { start: start.toISOString(), end: end.toISOString(), type: 'paid' },
    }));
    expect(f.UsageModel.findOne).toHaveBeenCalledWith({
      userId,
      subscriptionId,
      periodType: 'paid',
      billingPeriodStart: start,
    });
    expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('ends paid entitlements at the exact grace deadline', async () => {
    const deadline = new Date('2026-10-16T12:00:00.000Z');
    const f = fixture({
      accountType: 'business',
      stripeStatus: 'past_due',
      paymentRecoveryStatus: 'retrying',
      gracePeriodEndsAt: deadline,
      now: deadline,
    });
    const result = await resolveEntitlements(userId, f.overrides);

    expect(result).toEqual(expect.objectContaining({
      status: 'no_paid_plan',
      isPaid: false,
      plan: null,
      includedContacts: 0,
    }));
    expect(f.PlanModel.findById).not.toHaveBeenCalled();
  });

  test('uses exact Stripe month and leap-year period boundaries', async () => {
    const f = fixture({
      accountType: 'business',
      periodStart: new Date('2024-02-01T00:00:00.000Z'),
      periodEnd: new Date('2024-03-01T00:00:00.000Z'),
      now: new Date('2024-02-29T23:59:59.000Z'),
    });
    const result = await resolveEntitlements(userId, f.overrides);
    expect(result.period).toEqual({
      start: '2024-02-01T00:00:00.000Z',
      end: '2024-03-01T00:00:00.000Z',
      type: 'paid',
    });
    expect(result.remainingIncludedContacts).toBe(3);
  });

  test('reconstructs a missing paid usage period only from a paid invoice for the exact Stripe period', async () => {
    const f = fixture({ accountType: 'business', noUsage: true });
    const invoice = {
      id: 'in_test',
      status: 'paid',
      livemode: false,
      customer: 'cus_test',
      parent: { subscription_details: { subscription: 'sub_test' } },
      lines: {
        data: [{
          period: {
            start: start.getTime() / 1000,
            end: end.getTime() / 1000,
          },
          pricing: { price_details: { price: 'price_test' } },
        }],
      },
    };
    f.stripeSubscription.latest_invoice = invoice.id;
    f.stripe.invoices.retrieve.mockResolvedValue(invoice);

    const result = await resolveEntitlements(userId, f.overrides);
    expect(result.remainingIncludedContacts).toBe(15);
    expect(f.stripe.invoices.retrieve).toHaveBeenCalledWith(invoice.id, {
      expand: ['lines.data'],
    });
    expect(f.UsageModel.findOneAndUpdate).toHaveBeenCalled();
  });

  test('does not reconstruct paid usage from an invoice for a different period', async () => {
    const f = fixture({ accountType: 'business', noUsage: true });
    f.stripeSubscription.latest_invoice = 'in_old';
    f.stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_old',
      status: 'paid',
      livemode: false,
      customer: 'cus_test',
      parent: { subscription_details: { subscription: 'sub_test' } },
      lines: {
        data: [{
          period: {
            start: start.getTime() / 1000 - 31 * 24 * 60 * 60,
            end: start.getTime() / 1000,
          },
          pricing: { price_details: { price: 'price_test' } },
        }],
      },
    });

    await expect(resolveEntitlements(userId, f.overrides)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_USAGE_UNAVAILABLE',
      status: 503,
    });
    expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('expires cancel-at-period-end access at the exact Stripe period boundary', async () => {
    const f = fixture({
      accountType: 'business',
      cancelAtPeriodEnd: true,
      now: end,
    });
    const result = await resolveEntitlements(userId, f.overrides);
    expect(result).toEqual(expect.objectContaining({
      isPaid: false,
      status: 'no_paid_plan',
      includedContacts: 0,
    }));
    expect(f.stripe.subscriptions.retrieve).toHaveBeenCalled();
  });

  test('keeps the active plan allowance until a scheduled downgrade is effective', async () => {
    const f = fixture({ accountType: 'business' });
    f.record.pendingPlanChange = {
      targetPlanId: new mongoose.Types.ObjectId(),
      effectiveAt: new Date('2026-11-01T00:00:00.000Z'),
    };
    const result = await resolveEntitlements(userId, f.overrides);
    expect(result.plan.name).toBe('Plus');
    expect(result.includedContacts).toBe(5);
  });

  test('starts a new billing period with its own allowance instead of rolling unused contacts forward', async () => {
    const periodStart = new Date('2026-11-01T00:00:00.000Z');
    const periodEnd = new Date('2026-12-01T00:00:00.000Z');
    const f = fixture({
      accountType: 'business',
      noUsage: true,
      periodStart,
      periodEnd,
      now: periodStart,
    });
    const previousUsage = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      subscriptionId,
      periodType: 'paid',
      billingPeriodStart: start,
      billingPeriodEnd: end,
      includedContacts: 35,
      consumedIncludedContacts: 0,
      contactOperations: [],
    };
    f.UsageModel.findOne.mockImplementation((filter) => query(
      previousUsage.billingPeriodStart <= filter.billingPeriodStart.$lte &&
        previousUsage.billingPeriodEnd > filter.billingPeriodEnd.$gt
        ? previousUsage
        : null
    ));
    const invoice = {
      id: 'in_current_period',
      status: 'paid',
      livemode: false,
      customer: 'cus_test',
      parent: { subscription_details: { subscription: 'sub_test' } },
      lines: {
        data: [{
          period: {
            start: periodStart.getTime() / 1000,
            end: periodEnd.getTime() / 1000,
          },
          pricing: { price_details: { price: 'price_test' } },
        }],
      },
    };
    f.stripeSubscription.latest_invoice = invoice.id;
    f.stripe.invoices.retrieve.mockResolvedValue(invoice);

    const result = await resolveEntitlements(userId, f.overrides);

    expect(result).toEqual(expect.objectContaining({
      includedContacts: 15,
      consumedIncludedContacts: 0,
      remainingIncludedContacts: 15,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        type: 'paid',
      },
    }));
    expect(f.UsageModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId, billingPeriodStart: periodStart },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          includedContacts: 15,
          consumedIncludedContacts: 0,
          billingPeriodEnd: periodEnd,
        }),
      }),
      expect.any(Object)
    );
  });

  test('does not grant a future paid period after failed renewal without a matching paid usage record', async () => {
    const f = fixture({ accountType: 'business', stripeStatus: 'unpaid', recordStatus: 'past_due' });
    f.UsageModel.findOne.mockReturnValue(query(null));
    const result = await resolveEntitlements(userId, f.overrides);
    expect(result).toEqual(expect.objectContaining({
      status: 'past_due',
      isPaid: false,
      plan: null,
      includedContacts: 0,
    }));
  });

  test('falls back to private Free after Stripe cancellation and rejects an unknown business Free tier', async () => {
    const privateAccount = fixture({ stripeStatus: 'canceled' });
    privateAccount.SubscriptionModel.findOne.mockReturnValue(query({
      _id: subscriptionId,
      userId,
      planId,
      planType: 'private',
      stripeMode: 'test',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
    }));
    const result = await resolveEntitlements(userId, privateAccount.overrides);
    expect(result.status).toBe('free');
    expect(result.includedContacts).toBe(5);

    const businessAccount = fixture({ accountType: 'business', stripeStatus: 'canceled' });
    const businessResult = await resolveEntitlements(userId, businessAccount.overrides);
    expect(businessResult.status).toBe('no_paid_plan');
    expect(businessResult.includedContacts).toBe(0);
  });

  test('consumes once per JobRequest ID and releases only failed application attempts', async () => {
    const f = fixture();
    f.freePlan.entitlements.freeContact = 1;
    let usage;
    f.UsageModel.findOne = jest.fn(async (filter = {}) => {
      if (!usage) return null;
      return usage;
    });
    f.UsageModel.findOneAndUpdate = jest.fn(async (filter, update) => {
      if (!filter.$expr) {
        if (!usage) {
          usage = {
            _id: new mongoose.Types.ObjectId(),
            userId,
            periodType: 'free',
            billingPeriodStart: update.$setOnInsert.billingPeriodStart,
            billingPeriodEnd: update.$setOnInsert.billingPeriodEnd,
            includedContacts: update.$setOnInsert.includedContacts,
            consumedIncludedContacts: 0,
            contactOperations: [],
          };
        }
        return usage;
      }
      const operationId = update[0].$set.contactOperations.$concatArrays[1][0].operationId;
      const existing = usage.contactOperations.find((item) => item.operationId === operationId);
      if (existing || usage.consumedIncludedContacts >= usage.includedContacts) {
        return null;
      }
      usage.consumedIncludedContacts += 1;
      usage.contactOperations.push({ operationId, status: 'consumed' });
      return usage;
    });
    f.UsageModel.updateOne = jest.fn(async (_filter, update) => {
      usage.consumedIncludedContacts += update.$inc.consumedIncludedContacts;
      usage.contactOperations.find((item) => item.operationId === first.operationId).status = 'released';
      return { modifiedCount: 1 };
    });
    const options = {
      ...f.overrides,
      env: { SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED: 'true' },
    };

    const simultaneous = await Promise.allSettled([
      consumeApplicationContact({
        userId,
        jobRequestId: new mongoose.Types.ObjectId(),
        servicePrice: 12000,
      }, options),
      consumeApplicationContact({
        userId,
        jobRequestId: new mongoose.Types.ObjectId(),
        servicePrice: 12000,
      }, options),
    ]);
    const first = simultaneous.find((result) => result.status === 'fulfilled')?.value;
    expect(first?.newlyConsumed).toBe(true);
    expect(simultaneous.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(simultaneous.find((result) => result.status === 'rejected')?.reason).toMatchObject({
      code: 'CONTACT_LIMIT_REACHED',
    });
    const repeated = await consumeApplicationContact({
      userId,
      jobRequestId: first.operationId.replace('job-request:', ''),
      servicePrice: 12000,
    }, options);
    expect(repeated.newlyConsumed).toBe(false);
    expect(usage.consumedIncludedContacts).toBe(1);

    await releaseContact(first, async () => false, options);
    expect(usage.consumedIncludedContacts).toBe(0);
    expect(f.UsageModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: first.usagePeriodId }),
      expect.objectContaining({
        $inc: { consumedIncludedContacts: -1 },
        $set: { 'contactOperations.$.status': 'released' },
      })
    );
    await expect(consumeApplicationContact({
      userId,
      jobRequestId: first.operationId.replace('job-request:', ''),
      servicePrice: 12000,
    }, options)).rejects.toMatchObject({ code: 'APPLICATION_CONTACT_RELEASED' });
  });

  test('honors only the explicitly enabled private low-value job exception', async () => {
    const f = fixture();
    f.overrides.GlobalConfigModel.findOne.mockReturnValue(query({ value: true }));
    const result = await consumeApplicationContact({
      userId,
      jobRequestId: new mongoose.Types.ObjectId(),
      servicePrice: 9999,
    }, {
      ...f.overrides,
      env: { SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED: 'true' },
    });
    expect(result).toMatchObject({ exempt: true, newlyConsumed: false });
    expect(f.UsageModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(f.UsageModel.findOneAndUpdate.mock.calls[0][1]).not.toHaveProperty('$expr');
  });

  test('keeps legacy applications outside V2 enforcement when its rollout flag is off', async () => {
    const f = fixture();
    const result = await consumeApplicationContact({
      userId,
      jobRequestId: new mongoose.Types.ObjectId(),
      servicePrice: 12000,
    }, {
      ...f.overrides,
      env: {},
    });

    expect(result).toEqual({ enabled: false, newlyConsumed: false });
    expect(f.SubscriptionModel.findOne).toHaveBeenCalledWith({ userId });
    expect(f.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('enforces a V2 subscriber reservation even when the global rollout flag is off', async () => {
    const f = fixture();
    const { usage } = addPrivateV2UsageFixture(f);
    const jobRequestId = new mongoose.Types.ObjectId();
    const result = await consumeApplicationContact({
      userId,
      jobRequestId,
      servicePrice: 12000,
    }, {
      ...f.overrides,
      env: {},
    });

    expect(result).toMatchObject({
      enabled: true,
      newlyConsumed: true,
      operationId: `job-request:${jobRequestId}`,
    });
    expect(usage.consumedIncludedContacts).toBe(1);
  });

  test('honors the configured private-job exemption for V2 users while the rollout flag is off', async () => {
    const f = fixture();
    addPrivateV2UsageFixture(f);
    f.overrides.GlobalConfigModel.findOne.mockReturnValue(query({ value: true }));

    const result = await consumeApplicationContact({
      userId,
      jobRequestId: new mongoose.Types.ObjectId(),
      servicePrice: 9999,
    }, {
      ...f.overrides,
      env: {},
    });

    expect(result).toMatchObject({ enabled: true, exempt: true, newlyConsumed: false });
    expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ $expr: expect.anything() }),
      expect.anything(),
      expect.anything()
    );
  });

  test('fails closed with a structured error if V2 user classification is unavailable', async () => {
    const f = fixture();
    f.SubscriptionModel.findOne.mockImplementation(() => {
      throw new Error('database unavailable');
    });

    await expect(consumeApplicationContact({
      userId,
      jobRequestId: new mongoose.Types.ObjectId(),
      servicePrice: 12000,
    }, {
      ...f.overrides,
      env: {},
    })).rejects.toMatchObject({
      status: 503,
      code: 'SUBSCRIPTION_STATUS_UNAVAILABLE',
    });
    expect(f.UsageModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('charges separate JobRequest IDs from the same applicant and counterparty independently', async () => {
    const f = fixture();
    f.freePlan.entitlements.freeContact = 2;
    let usage;
    f.UsageModel.findOneAndUpdate = jest.fn(async (filter, update) => {
      if (!filter.$expr) {
        usage ||= {
          _id: new mongoose.Types.ObjectId(),
          userId,
          billingPeriodStart: update.$setOnInsert.billingPeriodStart,
          billingPeriodEnd: update.$setOnInsert.billingPeriodEnd,
          includedContacts: update.$setOnInsert.includedContacts,
          consumedIncludedContacts: 0,
          contactOperations: [],
        };
        return usage;
      }
      const operationId = update[0].$set.contactOperations.$concatArrays[1][0].operationId;
      usage.consumedIncludedContacts += 1;
      usage.contactOperations.push({ operationId, status: 'consumed' });
      return usage;
    });
    f.UsageModel.findOne = jest.fn(() => query(usage));
    const options = {
      ...f.overrides,
      env: { SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED: 'true' },
    };
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();

    await consumeApplicationContact({ userId, jobRequestId: firstId, servicePrice: 12000 }, options);
    await consumeApplicationContact({ userId, jobRequestId: secondId, servicePrice: 12000 }, options);

    const current = await resolveEntitlements(userId, options);
    expect(usage.consumedIncludedContacts).toBe(2);
    expect(usage.contactOperations.map((item) => item.operationId)).toEqual([
      `job-request:${firstId}`,
      `job-request:${secondId}`,
    ]);
    expect(current.remainingIncludedContacts).toBe(0);
  });
});
