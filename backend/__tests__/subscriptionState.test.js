jest.mock('mongoose', () => ({
  connection: { db: { collection: jest.fn() } },
  Types: { ObjectId: jest.fn(function ObjectId(value) { return `object-id:${value}`; }) },
}));
jest.mock('../services/stripe/customers', () => ({
  isResourceMissing: jest.fn((error) => error?.code === 'resource_missing'),
}));

const mongoose = require('mongoose');
const { findBillingCapableSubscription } = require('../services/stripe/subscriptionState');

let subscriptions;
let stripe;

beforeEach(() => {
  jest.clearAllMocks();
  subscriptions = { findOne: jest.fn() };
  mongoose.connection.db.collection.mockReturnValue(subscriptions);
  stripe = { subscriptions: { retrieve: jest.fn() } };
});

test('account deletion guard reads retained collection data and blocks billable subscriptions', async () => {
  subscriptions.findOne.mockResolvedValue({
    currentPlan: { stripeSubscriptionId: 'sub_existing', plan: 'Pro' },
  });
  stripe.subscriptions.retrieve.mockResolvedValue({ status: 'active' });

  await expect(findBillingCapableSubscription(stripe, 'user-1')).resolves.toMatchObject({
    blocking: true,
    stripeSubscriptionId: 'sub_existing',
  });
  expect(mongoose.connection.db.collection).toHaveBeenCalledWith('subscriptions');
  expect(subscriptions.findOne).toHaveBeenCalledWith(
    { userId: expect.any(mongoose.Types.ObjectId) },
    { projection: { 'currentPlan.stripeSubscriptionId': 1, 'currentPlan.plan': 1 } }
  );
});

test('account deletion guard permits terminal subscriptions', async () => {
  subscriptions.findOne.mockResolvedValue({
    currentPlan: { stripeSubscriptionId: 'sub_ended' },
  });
  stripe.subscriptions.retrieve.mockResolvedValue({ status: 'canceled' });

  await expect(findBillingCapableSubscription(stripe, 'user-1')).resolves.toMatchObject({
    blocking: false,
  });
});

test('account deletion guard fails closed when Stripe verification is unavailable', async () => {
  subscriptions.findOne.mockResolvedValue({
    currentPlan: { stripeSubscriptionId: 'sub_existing' },
  });
  stripe.subscriptions.retrieve.mockRejectedValue(new Error('network unavailable'));

  await expect(findBillingCapableSubscription(stripe, 'user-1')).rejects.toMatchObject({
    code: 'subscription_check_unavailable',
  });
});
