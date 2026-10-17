const mongoose = require('mongoose');
const {
  KNOWN_UPGRADE,
  recoverPaidUpgrade,
} = require('../services/subscriptions/v2PaidUpgradeRecovery');

const userId = new mongoose.Types.ObjectId(KNOWN_UPGRADE.userId);
const subscriptionRecordId = new mongoose.Types.ObjectId('6ad29b9f512b885ee6a699c7');
const usageId = new mongoose.Types.ObjectId('6ad29ba0512b885ee6a699c9');
const operationDocId = new mongoose.Types.ObjectId('6ad29feb643e723fd1cfe928');
const periodStart = 1792187289;
const periodEnd = 1794865689;
const prorationAt = 1792188395;

function query(value) {
  return {
    lean: async () => value,
    session: () => query(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function recoveryFixture(patch = {}) {
  const record = {
    _id: subscriptionRecordId,
    userId,
    planId: new mongoose.Types.ObjectId(KNOWN_UPGRADE.previousPlanId),
    planType: 'private',
    stripeCustomerId: KNOWN_UPGRADE.customerId,
    stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
    stripeMode: 'test',
    stripePriceId: KNOWN_UPGRADE.previousPriceId,
    status: 'active',
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    pendingPlanChange: null,
    planHistory: [],
  };
  const targetPlan = {
    _id: new mongoose.Types.ObjectId(KNOWN_UPGRADE.targetPlanId),
    name: 'Pro',
    type: 'private',
    price: 149,
    stripePriceIdTest: KNOWN_UPGRADE.priceId,
    stripeProductIdTest: 'prod_VRlOarkkBNGUT6',
    entitlements: { freeContact: 35 },
  };
  const previousPlan = {
    _id: new mongoose.Types.ObjectId(KNOWN_UPGRADE.previousPlanId),
    name: 'Plus',
    type: 'private',
    price: 99,
    stripePriceIdTest: KNOWN_UPGRADE.previousPriceId,
    entitlements: { freeContact: 15 },
  };
  const operation = {
    _id: operationDocId,
    operationId: KNOWN_UPGRADE.operationId,
    idempotencyKey: KNOWN_UPGRADE.operationId,
    operationType: 'upgrade',
    status: 'pending',
    lifecycleLock: true,
    userId,
    subscriptionId: subscriptionRecordId,
    stripeCustomerId: KNOWN_UPGRADE.customerId,
    stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
    stripeMode: 'test',
    targetPlanId: targetPlan._id,
    stripePriceId: KNOWN_UPGRADE.priceId,
    attempts: 1,
    prorationDate: new Date(prorationAt * 1000),
  };
  const previousOperation = {
    _id: new mongoose.Types.ObjectId(),
    operationId: KNOWN_UPGRADE.previousOperationId,
    operationType: 'resume',
    status: 'succeeded',
    lifecycleLock: false,
    userId,
    stripeCustomerId: KNOWN_UPGRADE.customerId,
    stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
    stripeMode: 'test',
    targetPlanId: null,
  };
  const usage = {
    _id: usageId,
    userId,
    subscriptionId: subscriptionRecordId,
    periodType: 'paid',
    planId: previousPlan._id,
    billingPeriodStart: new Date(periodStart * 1000),
    billingPeriodEnd: new Date(periodEnd * 1000),
    includedContacts: 15,
    consumedIncludedContacts: 0,
    purchasedExtraContacts: 0,
    contactOperations: [],
  };
  const metadata = {
    subscriptionV2: 'true',
    userId: KNOWN_UPGRADE.userId,
    planId: KNOWN_UPGRADE.targetPlanId,
    operationId: KNOWN_UPGRADE.previousOperationId,
    stripeMode: 'test',
  };
  const subscription = {
    id: KNOWN_UPGRADE.subscriptionId,
    customer: KNOWN_UPGRADE.customerId,
    status: 'active',
    livemode: false,
    cancel_at_period_end: false,
    latest_invoice: KNOWN_UPGRADE.invoiceId,
    metadata,
    items: { data: [{
      id: 'si_upgrade',
      quantity: 1,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      price: {
        id: KNOWN_UPGRADE.priceId,
        product: targetPlan.stripeProductIdTest,
        active: true,
        livemode: false,
        currency: 'nok',
        type: 'recurring',
        unit_amount: 14900,
        recurring: { interval: 'month', interval_count: 1 },
      },
    }] },
  };
  const linePeriod = { start: prorationAt, end: periodEnd };
  const invoice = {
    id: KNOWN_UPGRADE.invoiceId,
    customer: KNOWN_UPGRADE.customerId,
    livemode: false,
    status: 'paid',
    billing_reason: 'subscription_update',
    amount_due: 4998,
    amount_paid: 4998,
    amount_remaining: 0,
    currency: 'nok',
    payments: { data: [{
      status: 'paid',
      amount_paid: 4998,
      payment: { payment_intent: { status: 'succeeded' } },
    }] },
    parent: { subscription_details: { subscription: KNOWN_UPGRADE.subscriptionId, metadata } },
    lines: { data: [
      {
        id: 'il_plus_credit',
        amount: -9896,
        currency: 'nok',
        proration: true,
        period: linePeriod,
        pricing: { price_details: { price: KNOWN_UPGRADE.previousPriceId } },
        parent: { subscription_item_details: { subscription: KNOWN_UPGRADE.subscriptionId, proration: true } },
      },
      {
        id: 'il_pro_proration',
        amount: 14894,
        currency: 'nok',
        proration: true,
        period: linePeriod,
        pricing: { price_details: { price: KNOWN_UPGRADE.priceId } },
        parent: { subscription_item_details: { subscription: KNOWN_UPGRADE.subscriptionId, proration: true } },
      },
    ] },
  };
  const request = {
    id: 'req_upgrade',
    idempotency_key: `jobblo-subv2-test-${KNOWN_UPGRADE.operationId}`,
  };
  const invoiceEvent = {
    id: KNOWN_UPGRADE.invoiceEventId,
    type: 'invoice.paid',
    livemode: false,
    request,
    data: { object: invoice },
  };
  const subscriptionEvent = {
    id: KNOWN_UPGRADE.subscriptionEventId,
    type: 'customer.subscription.updated',
    livemode: false,
    request,
    data: {
      object: subscription,
      previous_attributes: { metadata: { planId: KNOWN_UPGRADE.previousPlanId } },
    },
  };
  const invoiceLedger = {
    _id: new mongoose.Types.ObjectId(),
    stripeEventId: KNOWN_UPGRADE.invoiceEventId,
    eventType: 'invoice.paid',
    stripeMode: 'test',
    status: 'failed',
  };
  const subscriptionLedger = {
    _id: new mongoose.Types.ObjectId(),
    stripeEventId: KNOWN_UPGRADE.subscriptionEventId,
    eventType: 'customer.subscription.updated',
    stripeMode: 'test',
    status: 'failed',
  };
  const docsById = new Map([
    [String(record._id), record],
    [String(operation._id), operation],
    [String(usage._id), usage],
    [String(invoiceLedger._id), invoiceLedger],
    [String(subscriptionLedger._id), subscriptionLedger],
  ]);
  const subscriptionModel = {
    findOne: jest.fn(() => query(record)),
    find: jest.fn(() => query([record])),
    findById: jest.fn((id) => query(docsById.get(String(id)))),
    countDocuments: jest.fn(async () => 0),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const operationModel = {
    findOne: jest.fn((filter) => query(
      filter.operationId === KNOWN_UPGRADE.previousOperationId ? previousOperation : operation
    )),
    find: jest.fn(() => query([operation])),
    findById: jest.fn(() => query(operation)),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const eventModel = {
    find: jest.fn((filter) => query([
      filter.stripeEventId === KNOWN_UPGRADE.invoiceEventId ? invoiceLedger : subscriptionLedger,
    ])),
    findById: jest.fn((id) => query(docsById.get(String(id)))),
    updateMany: jest.fn(async () => ({ modifiedCount: 2 })),
  };
  const usageModel = {
    find: jest.fn(() => query([usage])),
    findById: jest.fn(() => query(usage)),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const auditModel = { create: jest.fn(async () => [{}]) };
  const session = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn(async () => {}),
  };
  const connection = {
    host: '127.0.0.1',
    name: 'jobblo-dev',
    db: { admin: () => ({ command: async () => ({ setName: 'rs0' }) }) },
    startSession: jest.fn(async () => session),
  };
  const stripe = {
    accounts: { retrieve: jest.fn(async () => ({ id: KNOWN_UPGRADE.accountId })) },
    customers: {
      retrieve: jest.fn(async () => ({
        id: KNOWN_UPGRADE.customerId,
        deleted: false,
        livemode: false,
        metadata: { userId: KNOWN_UPGRADE.userId },
      })),
    },
    subscriptions: { retrieve: jest.fn(async () => subscription) },
    invoices: {
      retrieve: jest.fn(async () => invoice),
      list: jest.fn(async () => ({ data: [invoice] })),
    },
    events: {
      retrieve: jest.fn(async (id) =>
        id === KNOWN_UPGRADE.invoiceEventId ? invoiceEvent : subscriptionEvent
      ),
    },
  };
  const overrides = {
    connection,
    SubscriptionModel: subscriptionModel,
    PlanModel: { findById: jest.fn((id) => query(
      String(id) === String(targetPlan._id) ? targetPlan : previousPlan
    )) },
    OperationModel: operationModel,
    EventModel: eventModel,
    UsageModel: usageModel,
    AuditModel: auditModel,
    stripeConfiguration: jest.fn(async () => ({ mode: 'test', keyModeValid: true })),
    stripeForMode: jest.fn(async () => stripe),
  };
  return {
    record,
    targetPlan,
    previousPlan,
    operation,
    previousOperation,
    usage,
    subscription,
    invoice,
    invoiceEvent,
    subscriptionEvent,
    invoiceLedger,
    subscriptionLedger,
    session,
    connection,
    stripe,
    subscriptionModel,
    operationModel,
    eventModel,
    usageModel,
    auditModel,
    overrides,
    request: () => recoverPaidUpgrade({
      adminId: new mongoose.Types.ObjectId(),
      confirmation: 'RECONCILE_ALREADY_PAID_TEST_UPGRADE',
    }, overrides),
    ...patch,
  };
}

describe('one-time paid TEST upgrade reconciliation', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = 'development'; });
  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  test('atomically applies the verified upgrade, preserves consumed usage, and links failed events', async () => {
    const f = recoveryFixture();
    f.usage.consumedIncludedContacts = 4;

    await expect(f.request()).resolves.toEqual({
      reconciled: true,
      plan: 'Pro',
      invoiceId: KNOWN_UPGRADE.invoiceId,
    });

    expect(f.subscriptionModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ planId: expect.any(mongoose.Types.ObjectId) }),
      expect.objectContaining({
        $set: expect.objectContaining({
          planId: f.targetPlan._id,
          stripePriceId: KNOWN_UPGRADE.priceId,
          currentPeriodStart: new Date(periodStart * 1000),
          currentPeriodEnd: new Date(periodEnd * 1000),
        }),
        $push: { planHistory: expect.objectContaining({ operationId: KNOWN_UPGRADE.operationId }) },
      }),
      expect.objectContaining({ session: f.session, runValidators: true })
    );
    expect(f.usageModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ consumedIncludedContacts: 4 }),
      { $set: { planId: f.targetPlan._id, includedContacts: 35 } },
      { session: f.session }
    );
    expect(f.operationModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: KNOWN_UPGRADE.operationId }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'succeeded',
          stripeInvoiceId: KNOWN_UPGRADE.invoiceId,
        }),
        $unset: { lifecycleLock: 1 },
      }),
      { session: f.session }
    );
    expect(f.eventModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: { $in: [KNOWN_UPGRADE.invoiceEventId, KNOWN_UPGRADE.subscriptionEventId] },
        status: 'failed',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'reconciled',
          reconciliationOperationId: KNOWN_UPGRADE.operationId,
        }),
      }),
      { session: f.session }
    );
    expect(f.auditModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ action: 'other', adminId: expect.any(mongoose.Types.ObjectId) })],
      { session: f.session }
    );
    expect(f.stripe.subscriptions).not.toHaveProperty('update');
    expect(f.stripe.invoices).not.toHaveProperty('create');
  });

  test.each([
    ['wrong Stripe account', (f) => { f.stripe.accounts.retrieve.mockResolvedValue({ id: 'acct_other' }); }],
    ['live mode', (f) => { f.overrides.stripeConfiguration.mockResolvedValue({ mode: 'live', keyModeValid: true }); }],
    ['wrong Stripe customer owner', (f) => { f.stripe.customers.retrieve.mockResolvedValue({ id: 'cus_other', livemode: false, metadata: { userId: 'another-user' } }); }],
    ['wrong subscription customer', (f) => { f.subscription.customer = 'cus_other'; }],
    ['wrong invoice customer', (f) => { f.invoice.customer = 'cus_other'; }],
    ['wrong invoice subscription', (f) => { f.invoice.parent.subscription_details.subscription = 'sub_other'; }],
    ['wrong invoice mode', (f) => { f.invoice.livemode = true; }],
    ['wrong target price', (f) => { f.subscription.items.data[0].price.id = 'price_other'; }],
    ['wrong target plan type', (f) => { f.targetPlan.type = 'business'; }],
    ['wrong subscription event ID', (f) => { f.subscriptionEvent.data.object.id = 'sub_other'; }],
    ['wrong payment intent status', (f) => { f.invoice.payments.data[0].payment.payment_intent.status = 'requires_action'; }],
    ['unpaid invoice', (f) => { f.invoice.status = 'open'; }],
    ['wrong request operation key', (f) => { f.invoiceEvent.request.idempotency_key = 'another-operation'; }],
    ['ambiguous plan operation', (f) => { f.operationModel.find.mockReturnValue(query([f.operation, { ...f.operation, _id: new mongoose.Types.ObjectId() }])); }],
    ['wrong operation customer', (f) => { f.operation.stripeCustomerId = 'cus_other'; }],
    ['missing exact previous operation', (f) => { f.operationModel.findOne.mockImplementation(() => query(null)); }],
    ['duplicate paid upgrade invoice', (f) => { f.stripe.invoices.list.mockResolvedValue({ data: [f.invoice, { ...f.invoice, id: 'in_duplicate' }] }); }],
    ['unavailable transaction support', (f) => { f.connection.db.admin = () => ({ command: async () => ({}) }); }],
  ])('fails closed for %s without applying database writes', async (_name, alter) => {
    const f = recoveryFixture();
    alter(f);
    await expect(f.request()).rejects.toMatchObject({ status: expect.any(Number) });
    expect(f.subscriptionModel.updateOne).not.toHaveBeenCalled();
    expect(f.usageModel.updateOne).not.toHaveBeenCalled();
    expect(f.operationModel.updateOne).not.toHaveBeenCalled();
    expect(f.eventModel.updateMany).not.toHaveBeenCalled();
    expect(f.auditModel.create).not.toHaveBeenCalled();
  });

  test('refuses the wrong confirmation, non-development environment, and non-loopback database', async () => {
    const f = recoveryFixture();
    await expect(recoverPaidUpgrade({ confirmation: 'wrong' }, f.overrides))
      .rejects.toMatchObject({ code: 'RECOVERY_SCOPE_REJECTED' });
    process.env.NODE_ENV = 'production';
    await expect(f.request()).rejects.toMatchObject({ code: 'RECOVERY_SCOPE_REJECTED' });
    process.env.NODE_ENV = 'development';
    f.connection.host = 'remote.example';
    await expect(f.request()).rejects.toMatchObject({ code: 'RECOVERY_SCOPE_REJECTED' });
  });

  test('rolls back the transaction if the operation lock was concurrently changed', async () => {
    const f = recoveryFixture();
    f.operationModel.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(f.request()).rejects.toMatchObject({ code: 'RECOVERY_OPERATION_CONFLICT' });
    expect(f.session.withTransaction).toHaveBeenCalledTimes(1);
    expect(f.session.endSession).toHaveBeenCalledTimes(1);
  });

  test('does not claim success if the atomic transaction fails', async () => {
    const f = recoveryFixture();
    f.session.withTransaction.mockRejectedValue(new Error('transaction aborted'));
    await expect(f.request()).rejects.toMatchObject({ code: 'RECOVERY_TRANSACTION_FAILED' });
    expect(f.session.endSession).toHaveBeenCalledTimes(1);
  });

  test('returns an existing successful reconciliation without writing again', async () => {
    const f = recoveryFixture();
    f.record.planId = f.targetPlan._id;
    f.operation.status = 'succeeded';
    f.operation.lifecycleLock = false;
    f.operation.stripeInvoiceId = KNOWN_UPGRADE.invoiceId;
    f.usage.includedContacts = 35;
    f.invoiceLedger.status = 'reconciled';
    f.invoiceLedger.reconciliationOperationId = KNOWN_UPGRADE.operationId;
    f.subscriptionLedger.status = 'reconciled';
    f.subscriptionLedger.reconciliationOperationId = KNOWN_UPGRADE.operationId;
    f.subscriptionModel.countDocuments.mockResolvedValue(1);
    await expect(f.request()).resolves.toMatchObject({ alreadyReconciled: true, plan: 'Pro' });
    expect(f.connection.startSession).not.toHaveBeenCalled();
    expect(f.subscriptionModel.updateOne).not.toHaveBeenCalled();
    expect(f.usageModel.updateOne).not.toHaveBeenCalled();
    expect(f.operationModel.updateOne).not.toHaveBeenCalled();
  });
});
