jest.mock('mongoose', () => ({
  connection: { db: { collection: jest.fn() } },
  Types: { ObjectId: jest.fn(function ObjectId(value) { return `object-id:${value}`; }) },
}));
jest.mock('../services/stripe/customers', () => ({
  isResourceMissing: jest.fn((error) => error?.code === 'resource_missing'),
}));

const mongoose = require('mongoose');
const { findBillingCapableSubscription } = require('../services/stripe/subscriptionState');

let collections;
let stripe;
let v2Record;
let pendingOperation;

beforeEach(() => {
  jest.clearAllMocks();
  v2Record = null;
  pendingOperation = null;
  collections = {
    subscription_v2: { findOne: jest.fn(async () => v2Record) },
    subscription_billing_operations_v2: { findOne: jest.fn(async () => pendingOperation) },
  };
  mongoose.connection.db.collection.mockImplementation((name) => collections[name]);
  stripe = { subscriptions: { retrieve: jest.fn() } };
});

test('account deletion guard verifies the V2 subscription in its recorded Stripe mode', async () => {
  v2Record = {
    stripeSubscriptionId: 'sub_v2',
    stripeMode: 'test',
    status: 'active',
  };
  const testStripe = { subscriptions: { retrieve: jest.fn().mockResolvedValue({ status: 'past_due' }) } };
  const config = {
    getStripeForMode: jest.fn(async (testMode) => testMode ? testStripe : stripe),
  };

  await expect(findBillingCapableSubscription(config, 'user-1')).resolves.toMatchObject({
    blocking: true,
    stripeSubscriptionId: 'sub_v2',
  });
  expect(config.getStripeForMode).toHaveBeenCalledWith(true);
  expect(mongoose.connection.db.collection).toHaveBeenCalledWith('subscription_v2');
  expect(mongoose.connection.db.collection).not.toHaveBeenCalledWith('subscriptions');
});

test('account deletion guard blocks an unresolved checkout before it can create a subscription', async () => {
  pendingOperation = { operationType: 'checkout', status: 'pending' };

  await expect(findBillingCapableSubscription(stripe, 'user-1')).resolves.toMatchObject({
    blocking: true,
    reason: 'pending_subscription_checkout',
  });
  expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
});

test('account deletion guard allows accounts without V2 billing records', async () => {
  await expect(findBillingCapableSubscription(stripe, 'user-1')).resolves.toMatchObject({
    blocking: false,
    reason: 'no_v2_subscription',
  });
  expect(mongoose.connection.db.collection).not.toHaveBeenCalledWith('subscriptions');
});

test('account deletion guard permits terminal V2 subscriptions', async () => {
  v2Record = {
    stripeSubscriptionId: 'sub_ended',
    stripeMode: 'live',
    status: 'canceled',
  };
  stripe.subscriptions.retrieve.mockResolvedValue({ status: 'canceled' });

  await expect(findBillingCapableSubscription(stripe, 'user-1')).resolves.toMatchObject({
    blocking: false,
  });
});

test('account deletion guard fails closed when Stripe verification is unavailable', async () => {
  v2Record = {
    stripeSubscriptionId: 'sub_v2',
    stripeMode: 'live',
    status: 'active',
  };
  stripe.subscriptions.retrieve.mockRejectedValue(new Error('network unavailable'));

  await expect(findBillingCapableSubscription(stripe, 'user-1')).rejects.toMatchObject({
    code: 'subscription_check_unavailable',
  });
});

test('account deletion guard fails closed when V2 billing records cannot be read', async () => {
  mongoose.connection.db.collection.mockImplementation(() => {
    throw new Error('database unavailable');
  });

  await expect(findBillingCapableSubscription(stripe, 'user-1')).rejects.toMatchObject({
    code: 'subscription_check_unavailable',
  });
});
