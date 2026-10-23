const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionV2 = require('../models/SubscriptionV2');
const SubscriptionBillingOperationV2 = require('../models/SubscriptionBillingOperationV2');
const SubscriptionUsagePeriod = require('../models/SubscriptionUsagePeriod');
const SubscriptionWebhookEventV2 = require('../models/SubscriptionWebhookEventV2');

const objectId = () => new mongoose.Types.ObjectId();
const seedCompatiblePlan = {
  name: 'Plus',
  price: 99,
  type: 'private',
  entitlements: {
    freeContact: 15,
    perContactPrice: 29,
    ContactUnlock: 60,
    radius: 50,
    visibilityLevel: 2,
    locationPrecision: 'exact',
    maxJobsValue: 20000,
  },
  featuresText: ['15 gratis kontakter per måned'],
};

function hasUniqueIndex(schema, keys) {
  return schema.indexes().some(
    ([indexKeys, options]) =>
      options.unique &&
      JSON.stringify(indexKeys) === JSON.stringify(keys)
  );
}

describe('Subscription V2 model schemas', () => {
  test('plan model accepts existing seed structure and targets the historical plan collection', () => {
    expect(new SubscriptionPlan(seedCompatiblePlan).validateSync()).toBeUndefined();
    expect(SubscriptionPlan.collection.collectionName).toBe('subscriptionplans');
    expect(SubscriptionPlan.schema.path('stripeProductId')).toBeDefined();
    expect(SubscriptionPlan.schema.path('stripePriceIdTest')).toBeDefined();
  });

  test('subscription validates state, Stripe mode, and exact billing periods', () => {
    const subscription = new SubscriptionV2({
      userId: objectId(),
      planId: objectId(),
      planType: 'private',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      stripeMode: 'test',
      status: 'active',
      currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
    });
    expect(subscription.validateSync()).toBeUndefined();

    subscription.status = 'unknown';
    expect(subscription.validateSync().errors.status).toBeDefined();

    subscription.status = 'active';
    subscription.stripeMode = 'sandbox';
    expect(subscription.validateSync().errors.stripeMode).toBeDefined();

    subscription.stripeMode = 'test';
    subscription.currentPeriodEnd = new Date('2025-12-31T00:00:00Z');
    expect(subscription.validateSync().errors.currentPeriodEnd).toBeDefined();
  });

  test('subscription snapshots plan history and optional withdrawal evidence', () => {
    const subscription = new SubscriptionV2({
      userId: objectId(),
      planId: objectId(),
      planType: 'business',
      stripeCustomerId: 'cus_live',
      stripeSubscriptionId: 'sub_live',
      stripeMode: 'live',
      planHistory: [{
        planId: objectId(),
        planName: 'Start',
        planPrice: 199,
        planType: 'business',
        stripeMode: 'live',
        stripeSubscriptionId: 'sub_live',
        changeType: 'initial',
        effectiveAt: new Date('2026-01-01T00:00:00Z'),
      }],
      withdrawalEvidence: {
        informationVersion: 'withdrawal-terms-1',
        informationPresentedAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    expect(subscription.validateSync()).toBeUndefined();
  });

  test('subscription ownership and Stripe identity are unique in the V2 collection', () => {
    expect(SubscriptionV2.collection.collectionName).toBe('subscription_v2');
    expect(hasUniqueIndex(SubscriptionV2.schema, { userId: 1 })).toBe(true);
    expect(
      hasUniqueIndex(SubscriptionV2.schema, { stripeMode: 1, stripeSubscriptionId: 1 })
    ).toBe(true);
    expect(SubscriptionV2.collection.collectionName).not.toBe('subscriptions');
  });

  test('billing operations require mode-scoped idempotency identities', () => {
    const operation = new SubscriptionBillingOperationV2({
      operationId: 'operation-1',
      idempotencyKey: 'request-1',
      stripeMode: 'test',
      operationType: 'checkout',
      userId: objectId(),
    });
    expect(operation.validateSync()).toBeUndefined();
    expect(
      hasUniqueIndex(SubscriptionBillingOperationV2.schema, { stripeMode: 1, operationId: 1 })
    ).toBe(true);
    expect(
      hasUniqueIndex(SubscriptionBillingOperationV2.schema, {
        stripeMode: 1,
        idempotencyKey: 1,
      })
    ).toBe(true);
    expect(SubscriptionBillingOperationV2.schema.indexes()).toContainEqual([
      { userId: 1, operationType: 1 },
      {
        unique: true,
        partialFilterExpression: { operationType: 'checkout', status: 'pending' },
        background: true,
      },
    ]);
  });

  test('usage periods require increasing dates and are unique per user period', () => {
    const usage = new SubscriptionUsagePeriod({
      subscriptionId: objectId(),
      userId: objectId(),
      planId: objectId(),
      periodType: 'paid',
      billingPeriodStart: new Date('2026-01-01T00:00:00Z'),
      billingPeriodEnd: new Date('2026-02-01T00:00:00Z'),
      includedContacts: 15,
      purchasedExtraContacts: 4,
    });
    expect(usage.validateSync()).toBeUndefined();
    usage.billingPeriodEnd = new Date('2025-12-31T00:00:00Z');
    expect(usage.validateSync().errors.billingPeriodEnd).toBeDefined();
    const periodEndValidator = SubscriptionUsagePeriod.schema
      .path('billingPeriodEnd').validators.find(
        (validator) => validator.message === 'Billing period end must be after its start.'
      ).validator;
    expect(periodEndValidator.call({
      getUpdate: () => ({
        $setOnInsert: { billingPeriodStart: new Date('2026-01-01T00:00:00Z') },
      }),
    }, new Date('2026-02-01T00:00:00Z'))).toBe(true);
    expect(periodEndValidator.call({
      getUpdate: () => ({
        $setOnInsert: { billingPeriodStart: new Date('2026-03-01T00:00:00Z') },
      }),
    }, new Date('2026-02-01T00:00:00Z'))).toBe(false);
    expect(
      hasUniqueIndex(SubscriptionUsagePeriod.schema, {
        userId: 1,
        billingPeriodStart: 1,
      })
    ).toBe(true);
    expect(new SubscriptionUsagePeriod({
      userId: objectId(),
      planId: objectId(),
      periodType: 'free',
      billingPeriodStart: new Date('2026-01-01T00:00:00Z'),
      billingPeriodEnd: new Date('2026-02-01T00:00:00Z'),
      includedContacts: 5,
    }).validateSync()).toBeUndefined();
  });

  test('webhook event IDs are unique per Stripe mode and use a separate ledger', () => {
    const event = new SubscriptionWebhookEventV2({
      stripeEventId: 'evt_test',
      stripeMode: 'test',
      eventType: 'customer.subscription.updated',
      status: 'reconciled',
      reconciliationOperationId: 'operation-1',
      reconciledAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(event.validateSync()).toBeUndefined();
    expect(event.status).toBe('reconciled');
    expect(event.reconciliationOperationId).toBe('operation-1');
    expect(
      hasUniqueIndex(SubscriptionWebhookEventV2.schema, {
        stripeMode: 1,
        stripeEventId: 1,
      })
    ).toBe(true);
    expect(SubscriptionWebhookEventV2.collection.collectionName).toBe(
      'subscription_webhook_events_v2'
    );
  });
});
