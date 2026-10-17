const mongoose = require('mongoose');
const SubscriptionV2 = require('../../models/SubscriptionV2');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const SubscriptionBillingOperationV2 = require('../../models/SubscriptionBillingOperationV2');
const SubscriptionWebhookEventV2 = require('../../models/SubscriptionWebhookEventV2');
const SubscriptionUsagePeriod = require('../../models/SubscriptionUsagePeriod');
const AdminActivity = require('../../models/AdminActivity');
const { getStripeForMode, getStripeConfiguration } = require('../../config/stripe');

const KNOWN_UPGRADE = Object.freeze({
  accountId: 'acct_1T70Is3acMP9uu8L',
  userId: '6ad2975c055becf982187993',
  subscriptionId: 'sub_1URIz23acMP9uu8LULRmGWyS',
  customerId: 'cus_VSDNwovNooyEaR',
  invoiceId: 'in_1URJGq3acMP9uu8LUvpK85F6',
  operationId: '5f15e1a7-ad6f-4367-b692-582593684fd5',
  previousOperationId: '84aa8a76-116f-4075-b48c-65680e8a76c4',
  previousPlanId: '6a0de8309d8348f34c9b0333',
  targetPlanId: '6a0de8309d8348f34c9b0334',
  priceId: 'price_1UQrra3acMP9uu8LK57Lc1LI',
  previousPriceId: 'price_1URIA63acMP9uu8LQv9TYRKw',
  invoiceEventId: 'evt_1URJGt3acMP9uu8LGnZkH3HR',
  subscriptionEventId: 'evt_1URJGt3acMP9uu8LcHyV5sxA',
});

class PaidUpgradeRecoveryError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'PaidUpgradeRecoveryError';
    this.status = status;
    this.code = code;
  }
}

function fail(status, code, message) {
  return new PaidUpgradeRecoveryError(status, code, message);
}

function idOf(value) {
  return typeof value === 'string' ? value : value?.id;
}

function equalId(left, right) {
  return String(left || '') === String(right || '');
}

function priceIdOf(line) {
  return idOf(line.pricing?.price_details?.price || line.price);
}

function periodOf(subscription) {
  const items = subscription.items?.data || [];
  if (items.length !== 1) throw fail(409, 'RECOVERY_SUBSCRIPTION_ITEMS_INVALID', 'Subscription items are ambiguous.');
  const item = items[0];
  const start = new Date(item.current_period_start * 1000);
  const end = new Date(item.current_period_end * 1000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw fail(409, 'RECOVERY_PERIOD_INVALID', 'The Stripe billing period could not be verified.');
  }
  return { item, start, end };
}

function eventRequestMatches(event, operation) {
  return event.request?.idempotency_key ===
    `jobblo-subv2-test-${operation.idempotencyKey}`;
}

function assertInvoiceLines(invoice, subscriptionId) {
  const lines = invoice.lines?.data || [];
  const target = lines.filter((line) =>
    priceIdOf(line) === KNOWN_UPGRADE.priceId &&
    equalId(line.parent?.subscription_item_details?.subscription, subscriptionId)
  );
  const previous = lines.filter((line) =>
    priceIdOf(line) === KNOWN_UPGRADE.previousPriceId &&
    equalId(line.parent?.subscription_item_details?.subscription, subscriptionId)
  );
  if (
    target.length !== 1 ||
    previous.length !== 1 ||
    target[0].amount <= 0 ||
    previous[0].amount >= 0 ||
    !target[0].parent?.subscription_item_details?.proration ||
    !previous[0].parent?.subscription_item_details?.proration ||
    target[0].period?.start !== previous[0].period?.start ||
    target[0].period?.end !== previous[0].period?.end ||
    lines.reduce((sum, line) => sum + line.amount, 0) !== invoice.amount_paid ||
    target[0].currency?.toLowerCase() !== 'nok' ||
    previous[0].currency?.toLowerCase() !== 'nok'
  ) {
    throw fail(409, 'RECOVERY_INVOICE_LINES_MISMATCH', 'The paid invoice does not uniquely prove this plan change.');
  }
}

async function recoverPaidUpgrade({ adminId, confirmation }, overrides = {}) {
  const deps = {
    connection: mongoose.connection,
    SubscriptionModel: SubscriptionV2,
    PlanModel: SubscriptionPlan,
    OperationModel: SubscriptionBillingOperationV2,
    EventModel: SubscriptionWebhookEventV2,
    UsageModel: SubscriptionUsagePeriod,
    AuditModel: AdminActivity,
    stripeForMode: getStripeForMode,
    stripeConfiguration: getStripeConfiguration,
    ...overrides,
  };

  if (
    confirmation !== 'RECONCILE_ALREADY_PAID_TEST_UPGRADE' ||
    process.env.NODE_ENV !== 'development' ||
    deps.connection.host !== '127.0.0.1' ||
    deps.connection.name !== 'jobblo-dev'
  ) {
    throw fail(403, 'RECOVERY_SCOPE_REJECTED', 'This one-time recovery is restricted to its confirmed local TEST record.');
  }

  const hello = await deps.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw fail(503, 'RECOVERY_TRANSACTIONS_UNAVAILABLE', 'The local MongoDB does not support atomic multi-record transactions.');
  }

  const config = await deps.stripeConfiguration();
  if (config.mode !== 'test' || !config.keyModeValid) {
    throw fail(503, 'RECOVERY_STRIPE_MODE_MISMATCH', 'The selected Stripe credentials are not verified TEST credentials.');
  }
  const stripe = await deps.stripeForMode(true);
  const account = await stripe.accounts.retrieve();
  if (account.id !== KNOWN_UPGRADE.accountId) {
    throw fail(503, 'RECOVERY_STRIPE_ACCOUNT_MISMATCH', 'The Stripe TEST account does not match this recovery.');
  }

  const [customer, subscription, invoice, invoiceEvent, subscriptionEvent, invoices] = await Promise.all([
    stripe.customers.retrieve(KNOWN_UPGRADE.customerId),
    stripe.subscriptions.retrieve(KNOWN_UPGRADE.subscriptionId, { expand: ['items.data.price'] }),
    stripe.invoices.retrieve(KNOWN_UPGRADE.invoiceId, {
      expand: ['lines.data.price', 'payments.data.payment.payment_intent'],
    }),
    stripe.events.retrieve(KNOWN_UPGRADE.invoiceEventId),
    stripe.events.retrieve(KNOWN_UPGRADE.subscriptionEventId),
    stripe.invoices.list({ subscription: KNOWN_UPGRADE.subscriptionId, limit: 100 }),
  ]);
  const period = periodOf(subscription);
  assertInvoiceLines(invoice, subscription.id);
  const targetPrice = typeof period.item.price === 'string'
    ? await stripe.prices.retrieve(period.item.price)
    : period.item.price;

  const userObjectId = new mongoose.Types.ObjectId(KNOWN_UPGRADE.userId);
  const targetPlanObjectId = new mongoose.Types.ObjectId(KNOWN_UPGRADE.targetPlanId);
  const previousPlanObjectId = new mongoose.Types.ObjectId(KNOWN_UPGRADE.previousPlanId);
  const [record, targetPlan, previousPlan, exactOperation, ownerRecords, relatedOperations] =
    await Promise.all([
      deps.SubscriptionModel.findOne({
        stripeMode: 'test',
        stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
      }).lean(),
      deps.PlanModel.findById(targetPlanObjectId).lean(),
      deps.PlanModel.findById(previousPlanObjectId).lean(),
      deps.OperationModel.findOne({
        stripeMode: 'test',
        operationId: KNOWN_UPGRADE.operationId,
        operationType: 'upgrade',
        userId: userObjectId,
        stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
        targetPlanId: targetPlanObjectId,
      }).lean(),
      deps.SubscriptionModel.find({
        $or: [
          { stripeMode: 'test', stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId },
          { stripeMode: 'test', stripeCustomerId: KNOWN_UPGRADE.customerId },
        ],
      }).lean(),
      deps.OperationModel.find({
        $or: [
          { stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId },
          { userId: userObjectId },
        ],
        operationType: { $in: ['upgrade', 'downgrade'] },
        status: { $in: ['pending', 'processing', 'reconciliation_required', 'succeeded'] },
      }).lean(),
    ]);

  if (
    record &&
    targetPlan &&
    exactOperation?.status === 'succeeded' &&
    exactOperation.stripeInvoiceId === KNOWN_UPGRADE.invoiceId &&
    exactOperation.lifecycleLock !== true &&
    equalId(record.planId, targetPlanObjectId)
  ) {
    const [usage, invoiceEvents, subscriptionEvents, historyCount] = await Promise.all([
      deps.UsageModel.find({
        userId: userObjectId,
        subscriptionId: record._id,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
      }).lean(),
      deps.EventModel.find({ stripeMode: 'test', stripeEventId: KNOWN_UPGRADE.invoiceEventId }).lean(),
      deps.EventModel.find({ stripeMode: 'test', stripeEventId: KNOWN_UPGRADE.subscriptionEventId }).lean(),
      deps.SubscriptionModel.countDocuments({
        _id: record._id,
        'planHistory.operationId': KNOWN_UPGRADE.operationId,
      }),
    ]);
    if (
      record.userId.toString() === KNOWN_UPGRADE.userId &&
      record.stripeMode === 'test' &&
      record.stripeCustomerId === KNOWN_UPGRADE.customerId &&
      record.stripeSubscriptionId === KNOWN_UPGRADE.subscriptionId &&
      record.status === 'active' &&
      record.planType === 'private' &&
      record.currentPeriodStart?.getTime() === period.start.getTime() &&
      record.currentPeriodEnd?.getTime() === period.end.getTime() &&
      targetPlan.type === 'private' &&
      targetPrice?.id === KNOWN_UPGRADE.priceId &&
      targetPrice.active === true &&
      targetPrice.livemode === false &&
      targetPrice.currency?.toLowerCase() === 'nok' &&
      targetPrice.type === 'recurring' &&
      targetPrice.unit_amount === Math.round(targetPlan.price * 100) &&
      targetPrice.recurring?.interval === 'month' &&
      targetPrice.recurring?.interval_count === 1 &&
      subscription.status === 'active' &&
      subscription.livemode === false &&
      idOf(subscription.customer) === KNOWN_UPGRADE.customerId &&
      idOf(subscription.latest_invoice) === KNOWN_UPGRADE.invoiceId &&
      subscription.metadata?.operationId === KNOWN_UPGRADE.previousOperationId &&
      subscription.metadata?.userId === KNOWN_UPGRADE.userId &&
      subscription.metadata?.planId === KNOWN_UPGRADE.targetPlanId &&
      subscription.metadata?.stripeMode === 'test' &&
      exactOperation.operationType === 'upgrade' &&
      exactOperation.stripeMode === 'test' &&
      equalId(exactOperation.userId, userObjectId) &&
      exactOperation.stripeSubscriptionId === KNOWN_UPGRADE.subscriptionId &&
      exactOperation.stripeCustomerId === KNOWN_UPGRADE.customerId &&
      equalId(exactOperation.targetPlanId, targetPlanObjectId) &&
      exactOperation.stripePriceId === KNOWN_UPGRADE.priceId &&
      invoice.status === 'paid' &&
      invoice.billing_reason === 'subscription_update' &&
      invoice.amount_due === invoice.amount_paid &&
      invoice.amount_remaining === 0 &&
      invoice.customer === KNOWN_UPGRADE.customerId &&
      idOf(invoice.parent?.subscription_details?.subscription) === KNOWN_UPGRADE.subscriptionId &&
      invoice.livemode === false &&
      invoice.currency?.toLowerCase() === 'nok' &&
      customer.id === KNOWN_UPGRADE.customerId &&
      customer.deleted !== true &&
      customer.livemode === false &&
      customer.metadata?.userId === KNOWN_UPGRADE.userId &&
      usage.length === 1 &&
      usage[0].includedContacts === targetPlan.entitlements?.freeContact &&
      usage[0].periodType === 'paid' &&
      Number.isSafeInteger(usage[0].consumedIncludedContacts) &&
      usage[0].consumedIncludedContacts >= 0 &&
      invoiceEvent.id === KNOWN_UPGRADE.invoiceEventId &&
      invoiceEvent.type === 'invoice.paid' &&
      eventRequestMatches(invoiceEvent, exactOperation) &&
      subscriptionEvent.id === KNOWN_UPGRADE.subscriptionEventId &&
      subscriptionEvent.type === 'customer.subscription.updated' &&
      eventRequestMatches(subscriptionEvent, exactOperation) &&
      invoiceEvents[0]?.status === 'reconciled' &&
      subscriptionEvents[0]?.status === 'reconciled' &&
      invoiceEvents[0]?.reconciliationOperationId === KNOWN_UPGRADE.operationId &&
      subscriptionEvents[0]?.reconciliationOperationId === KNOWN_UPGRADE.operationId &&
      invoiceEvents[0]?.eventType === 'invoice.paid' &&
      subscriptionEvents[0]?.eventType === 'customer.subscription.updated' &&
      historyCount === 1 &&
      invoices.data.filter((item) => item.billing_reason === 'subscription_update' && item.status === 'paid').length === 1 &&
      invoices.data.filter((item) => item.id === KNOWN_UPGRADE.invoiceId).length === 1 &&
      ownerRecords.length === 1 &&
      relatedOperations.length === 1 &&
      relatedOperations[0]._id.toString() === exactOperation._id.toString()
    ) {
      return { reconciled: true, alreadyReconciled: true, plan: targetPlan.name, invoiceId: invoice.id };
    }
    throw fail(409, 'RECOVERY_ALREADY_SUCCEEDED_MISMATCH', 'The recorded successful reconciliation does not match canonical TEST state.');
  }

  if (
    !record ||
    !equalId(record.userId, userObjectId) ||
    record.stripeMode !== 'test' ||
    record.stripeCustomerId !== KNOWN_UPGRADE.customerId ||
    record.stripeSubscriptionId !== KNOWN_UPGRADE.subscriptionId ||
    !equalId(record.planId, previousPlanObjectId) ||
    record.planType !== 'private' ||
    record.status !== 'active' ||
    record.pendingPlanChange ||
    ownerRecords.length !== 1 ||
    !targetPlan ||
    !equalId(targetPlan._id, targetPlanObjectId) ||
    targetPlan.type !== 'private' ||
    targetPlan.stripePriceIdTest !== KNOWN_UPGRADE.priceId ||
    !previousPlan ||
    !equalId(previousPlan._id, previousPlanObjectId) ||
    previousPlan.type !== 'private' ||
    previousPlan.stripePriceIdTest !== KNOWN_UPGRADE.previousPriceId ||
    !exactOperation ||
    exactOperation.status !== 'pending' ||
    exactOperation.lifecycleLock !== true ||
    exactOperation.stripeMode !== 'test' ||
    !equalId(exactOperation.userId, userObjectId) ||
    !equalId(exactOperation.subscriptionId, record._id) ||
    exactOperation.stripeSubscriptionId !== KNOWN_UPGRADE.subscriptionId ||
    exactOperation.stripeCustomerId !== KNOWN_UPGRADE.customerId ||
    !equalId(exactOperation.targetPlanId, targetPlanObjectId) ||
    exactOperation.stripePriceId !== KNOWN_UPGRADE.priceId ||
    exactOperation.stripeInvoiceId ||
    relatedOperations.length !== 1 ||
    relatedOperations[0]._id.toString() !== exactOperation._id.toString()
  ) {
    throw fail(409, 'RECOVERY_LOCAL_OWNERSHIP_MISMATCH', 'The local subscription and pending upgrade are not an unambiguous match.');
  }

  if (
    subscription.id !== KNOWN_UPGRADE.subscriptionId ||
    subscription.status !== 'active' ||
    subscription.livemode !== false ||
    idOf(subscription.customer) !== KNOWN_UPGRADE.customerId ||
    subscription.cancel_at_period_end ||
    idOf(subscription.latest_invoice) !== KNOWN_UPGRADE.invoiceId ||
    subscription.metadata?.subscriptionV2 !== 'true' ||
    subscription.metadata?.userId !== KNOWN_UPGRADE.userId ||
    subscription.metadata?.planId !== KNOWN_UPGRADE.targetPlanId ||
    subscription.metadata?.operationId !== KNOWN_UPGRADE.previousOperationId ||
    subscription.metadata?.stripeMode !== 'test' ||
    !targetPrice?.active ||
    targetPrice.livemode !== false ||
    targetPrice.id !== KNOWN_UPGRADE.priceId ||
    idOf(targetPrice.product) !== targetPlan.stripeProductIdTest ||
    targetPrice.currency?.toLowerCase() !== 'nok' ||
    targetPrice.type !== 'recurring' ||
    targetPrice.unit_amount !== Math.round(targetPlan.price * 100) ||
    targetPrice.recurring?.interval !== 'month' ||
    targetPrice.recurring?.interval_count !== 1 ||
    (record.stripePriceId && record.stripePriceId !== KNOWN_UPGRADE.previousPriceId) ||
    period.start.getTime() !== new Date(record.currentPeriodStart).getTime() ||
    period.end.getTime() !== new Date(record.currentPeriodEnd).getTime()
  ) {
    throw fail(409, 'RECOVERY_STRIPE_SUBSCRIPTION_MISMATCH', 'The canonical TEST subscription does not match the expected upgrade.');
  }

  if (
    invoice.id !== KNOWN_UPGRADE.invoiceId ||
    invoice.livemode !== false ||
    invoice.customer !== KNOWN_UPGRADE.customerId ||
    idOf(invoice.parent?.subscription_details?.subscription) !== KNOWN_UPGRADE.subscriptionId ||
    invoice.billing_reason !== 'subscription_update' ||
    invoice.status !== 'paid' ||
    invoice.amount_due <= 0 ||
    invoice.amount_paid !== invoice.amount_due ||
    invoice.amount_remaining !== 0 ||
    invoice.currency?.toLowerCase() !== 'nok' ||
    !customer ||
    customer.id !== KNOWN_UPGRADE.customerId ||
    customer.deleted === true ||
    customer.livemode !== false ||
    customer.metadata?.userId !== KNOWN_UPGRADE.userId ||
    invoice.payments?.data?.length !== 1 ||
    invoice.payments.data[0].status !== 'paid' ||
    invoice.payments.data[0].amount_paid !== invoice.amount_paid ||
    invoice.payments.data[0].payment?.payment_intent?.status !== 'succeeded' ||
    invoice.parent?.subscription_details?.metadata?.subscriptionV2 !== 'true' ||
    invoice.parent?.subscription_details?.metadata?.userId !== KNOWN_UPGRADE.userId ||
    invoice.parent?.subscription_details?.metadata?.planId !== KNOWN_UPGRADE.targetPlanId ||
    invoice.parent?.subscription_details?.metadata?.operationId !== KNOWN_UPGRADE.previousOperationId ||
    invoice.parent?.subscription_details?.metadata?.stripeMode !== 'test'
  ) {
    throw fail(409, 'RECOVERY_INVOICE_PAYMENT_MISMATCH', 'The invoice is not a settled TEST payment for this subscription.');
  }
  const [invoiceEvents, subscriptionEvents, usage, matchingOldOperation, successfulHistory] =
    await Promise.all([
      deps.EventModel.find({ stripeMode: 'test', stripeEventId: KNOWN_UPGRADE.invoiceEventId }).lean(),
      deps.EventModel.find({ stripeMode: 'test', stripeEventId: KNOWN_UPGRADE.subscriptionEventId }).lean(),
      deps.UsageModel.find({
        userId: userObjectId,
        subscriptionId: record._id,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
      }).lean(),
      deps.OperationModel.findOne({
        stripeMode: 'test',
        operationId: KNOWN_UPGRADE.previousOperationId,
        operationType: 'resume',
        userId: userObjectId,
        stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
        status: 'succeeded',
      }).lean(),
      deps.SubscriptionModel.countDocuments({
        _id: record._id,
        'planHistory.operationId': KNOWN_UPGRADE.operationId,
      }),
    ]);

  const invoiceLedger = invoiceEvents[0];
  const subscriptionLedger = subscriptionEvents[0];
  if (
    invoiceEvent.id !== KNOWN_UPGRADE.invoiceEventId ||
    invoiceEvent.type !== 'invoice.paid' ||
    invoiceEvent.livemode !== false ||
    idOf(invoiceEvent.data?.object) !== KNOWN_UPGRADE.invoiceId ||
    !eventRequestMatches(invoiceEvent, exactOperation) ||
    subscriptionEvent.id !== KNOWN_UPGRADE.subscriptionEventId ||
    subscriptionEvent.type !== 'customer.subscription.updated' ||
    subscriptionEvent.livemode !== false ||
    idOf(subscriptionEvent.data?.object) !== KNOWN_UPGRADE.subscriptionId ||
    !eventRequestMatches(subscriptionEvent, exactOperation) ||
    invoiceEvent.request?.id !== subscriptionEvent.request?.id ||
    invoiceEvent.data.object.parent?.subscription_details?.metadata?.operationId !== KNOWN_UPGRADE.previousOperationId ||
    subscriptionEvent.data.object.metadata?.operationId !== KNOWN_UPGRADE.previousOperationId ||
    subscriptionEvent.data.previous_attributes?.metadata?.planId !== KNOWN_UPGRADE.previousPlanId ||
    !matchingOldOperation ||
    matchingOldOperation.stripeCustomerId !== KNOWN_UPGRADE.customerId ||
    matchingOldOperation.stripeMode !== 'test' ||
    matchingOldOperation.operationId !== KNOWN_UPGRADE.previousOperationId ||
    !equalId(matchingOldOperation.userId, userObjectId) ||
    matchingOldOperation.stripeSubscriptionId !== KNOWN_UPGRADE.subscriptionId ||
    matchingOldOperation.status !== 'succeeded' ||
    matchingOldOperation.targetPlanId != null ||
    exactOperation.attempts < 1 ||
    !exactOperation.prorationDate ||
    invoice.lines?.data?.filter((line) => priceIdOf(line) === KNOWN_UPGRADE.priceId)
      .some((line) => line.period?.start !== Math.floor(exactOperation.prorationDate.getTime() / 1000)) ||
    invoiceLedger?.status !== 'failed' ||
    subscriptionLedger?.status !== 'failed' ||
    successfulHistory !== 0 ||
    invoices.data.filter((item) => item.billing_reason === 'subscription_update' && item.status === 'paid').length !== 1 ||
    invoices.data.filter((item) => item.id === KNOWN_UPGRADE.invoiceId).length !== 1 ||
    usage.length !== 1 ||
    usage[0].periodType !== 'paid' ||
    usage[0].includedContacts !== previousPlan.entitlements?.freeContact ||
    !Number.isSafeInteger(usage[0].consumedIncludedContacts) ||
    usage[0].consumedIncludedContacts < 0
  ) {
    throw fail(409, 'RECOVERY_EVIDENCE_AMBIGUOUS', 'Stripe payment, event, operation, or usage evidence is ambiguous.');
  }

  const session = await deps.connection.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const freshRecord = await deps.SubscriptionModel.findById(record._id).session(session).lean();
      const freshOperation = await deps.OperationModel.findById(exactOperation._id).session(session).lean();
      const freshUsage = await deps.UsageModel.findById(usage[0]._id).session(session).lean();
      const freshInvoiceEvent = await deps.EventModel.findById(invoiceLedger._id).session(session).lean();
      const freshSubscriptionEvent = await deps.EventModel.findById(subscriptionLedger._id).session(session).lean();
      if (
        !freshRecord ||
        !freshOperation ||
        !freshUsage ||
        freshOperation.status !== 'pending' ||
        freshOperation.lifecycleLock !== true ||
        !equalId(freshRecord.planId, previousPlanObjectId) ||
        freshRecord.stripeSubscriptionId !== KNOWN_UPGRADE.subscriptionId ||
        !['failed'].includes(freshInvoiceEvent?.status) ||
        !['failed'].includes(freshSubscriptionEvent?.status)
      ) {
        throw fail(409, 'RECOVERY_STATE_CHANGED', 'The recovery records changed before the transaction began.');
      }

      const subscriptionWrite = await deps.SubscriptionModel.updateOne(
        {
          _id: freshRecord._id,
          userId: userObjectId,
          stripeMode: 'test',
          stripeCustomerId: KNOWN_UPGRADE.customerId,
          stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
          planId: previousPlanObjectId,
          status: 'active',
          pendingPlanChange: null,
        },
        {
          $set: {
            planId: targetPlan._id,
            planType: targetPlan.type,
            stripePriceId: KNOWN_UPGRADE.priceId,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
            nextRenewalAt: period.end,
            autoRenew: true,
            cancellationEffectiveAt: null,
          },
          $push: {
            planHistory: {
              planId: targetPlan._id,
              planName: targetPlan.name,
              planPrice: targetPlan.price,
              planType: targetPlan.type,
              stripeMode: 'test',
              stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
              stripePriceId: KNOWN_UPGRADE.priceId,
              periodStart: period.start,
              periodEnd: period.end,
              changeType: 'upgrade',
              operationId: KNOWN_UPGRADE.operationId,
              effectiveAt: period.start,
            },
          },
        },
        { session, runValidators: true }
      );
      if (subscriptionWrite.modifiedCount !== 1) {
        throw fail(409, 'RECOVERY_SUBSCRIPTION_CONFLICT', 'The V2 subscription changed during reconciliation.');
      }

      const usageWrite = await deps.UsageModel.updateOne(
        {
          _id: freshUsage._id,
          userId: userObjectId,
          subscriptionId: freshRecord._id,
          billingPeriodStart: period.start,
          billingPeriodEnd: period.end,
          periodType: 'paid',
          includedContacts: previousPlan.entitlements.freeContact,
          consumedIncludedContacts: freshUsage.consumedIncludedContacts,
        },
        { $set: { planId: targetPlan._id, includedContacts: targetPlan.entitlements.freeContact } },
        { session }
      );
      if (usageWrite.modifiedCount !== 1) {
        throw fail(409, 'RECOVERY_USAGE_CONFLICT', 'The usage record changed during reconciliation.');
      }

      const operationWrite = await deps.OperationModel.updateOne(
        {
          _id: freshOperation._id,
          userId: userObjectId,
          subscriptionId: freshRecord._id,
          stripeMode: 'test',
          operationId: KNOWN_UPGRADE.operationId,
          operationType: 'upgrade',
          targetPlanId: targetPlan._id,
          stripeSubscriptionId: KNOWN_UPGRADE.subscriptionId,
          stripeCustomerId: KNOWN_UPGRADE.customerId,
          stripePriceId: KNOWN_UPGRADE.priceId,
          status: 'pending',
          lifecycleLock: true,
        },
        {
          $set: {
            status: 'succeeded',
            stripeInvoiceId: KNOWN_UPGRADE.invoiceId,
            completedAt: new Date(),
          },
          $unset: { lifecycleLock: 1 },
        },
        { session }
      );
      if (operationWrite.modifiedCount !== 1) {
        throw fail(409, 'RECOVERY_OPERATION_CONFLICT', 'The billing operation changed during reconciliation.');
      }

      const ledgerWrite = await deps.EventModel.updateMany(
        {
          stripeMode: 'test',
          stripeEventId: { $in: [KNOWN_UPGRADE.invoiceEventId, KNOWN_UPGRADE.subscriptionEventId] },
          status: 'failed',
        },
        {
          $set: {
            status: 'reconciled',
            reconciledAt: new Date(),
            reconciliationOperationId: KNOWN_UPGRADE.operationId,
          },
        },
        { session }
      );
      if (ledgerWrite.modifiedCount !== 2) {
        throw fail(409, 'RECOVERY_LEDGER_CONFLICT', 'The failed webhook records changed during reconciliation.');
      }

      await deps.AuditModel.create([{
        type: 'audit',
        severity: 'warning',
        adminId,
        action: 'other',
        targetModel: 'other',
        targetId: freshRecord._id,
        description: 'Reconciled the one verified, already-paid TEST subscription upgrade.',
        metadata: {
          mode: 'test',
          subscriptionId: KNOWN_UPGRADE.subscriptionId,
          invoiceId: KNOWN_UPGRADE.invoiceId,
          operationId: KNOWN_UPGRADE.operationId,
          invoiceEventId: KNOWN_UPGRADE.invoiceEventId,
          subscriptionEventId: KNOWN_UPGRADE.subscriptionEventId,
        },
      }], { session });
      result = { reconciled: true, plan: targetPlan.name, invoiceId: KNOWN_UPGRADE.invoiceId };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return result;
  } catch (err) {
    if (err instanceof PaidUpgradeRecoveryError) throw err;
    throw fail(503, 'RECOVERY_TRANSACTION_FAILED', 'The database could not atomically reconcile the paid upgrade.');
  } finally {
    await session.endSession();
  }
}

module.exports = { KNOWN_UPGRADE, PaidUpgradeRecoveryError, recoverPaidUpgrade };
