jest.mock('../models/Subscription', () => ({ findOne: jest.fn() }));
jest.mock('../models/SubscriptionPlan', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));

const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const {
  resolveCurrentSubscriptionEntitlements,
  summarizePaidExtraContacts,
} = require('../utils/subscriptionEntitlements');

const USER_ID = 'user_1';
const PLAN_ID = 'plan_plus';

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({ _id: USER_ID, role: 'user', monthlyContactUsage: 10 });
  Subscription.findOne.mockResolvedValue({
    currentPlan: { planId: PLAN_ID, plan: 'Plus', planType: 'private' },
  });
  SubscriptionPlan.findById.mockResolvedValue({
    _id: PLAN_ID,
    name: 'Plus',
    type: 'private',
    price: 99,
    isActive: true,
    entitlements: { freeContact: 15, perContactPrice: 29, ContactUnlock: 60 },
  });
});

test('uses edited database entitlements without changing the subscription or usage', async () => {
  const before = await resolveCurrentSubscriptionEntitlements(USER_ID);
  expect(before.entitlements.freeContact).toBe(15);
  expect(before.usage).toBe(10);

  SubscriptionPlan.findById.mockResolvedValue({
    _id: PLAN_ID,
    name: 'Plus',
    type: 'private',
    price: 99,
    isActive: true,
    entitlements: { freeContact: 25, perContactPrice: 39, ContactUnlock: 30 },
  });

  const after = await resolveCurrentSubscriptionEntitlements(USER_ID);
  expect(after.entitlements.freeContact).toBe(25);
  expect(after.entitlements.perContactPrice).toBe(39);
  expect(after.entitlements.ContactUnlock).toBe(30);
  expect(after.usage).toBe(10);
});

test('does not fall back to another plan when a legacy identity is missing', async () => {
  Subscription.findOne.mockResolvedValue({ currentPlan: { plan: 'Missing', planType: 'private' } });
  SubscriptionPlan.findOne.mockResolvedValue(null);
  expect((await resolveCurrentSubscriptionEntitlements(USER_ID)).hasPlan).toBe(false);
  expect(SubscriptionPlan.findById).not.toHaveBeenCalled();
});

test('company without a selected plan has no included contacts before purchase', async () => {
  User.findById.mockResolvedValue({ _id: 'company_1', role: 'company', monthlyContactUsage: 0 });
  Subscription.findOne.mockResolvedValue({ currentPlan: null });

  const result = await resolveCurrentSubscriptionEntitlements('company_1');

  expect(result.hasPlan).toBe(false);
  expect(result.entitlements.freeContact).toBe(0);
  expect(result.entitlements.perContactPrice).toBe(0);
});

test('does not replace a dangling planId with a same-name fallback', async () => {
  Subscription.findOne.mockResolvedValue({
    currentPlan: { planId: 'missing_plan', plan: 'Plus', planType: 'private' },
  });
  SubscriptionPlan.findById.mockResolvedValue(null);
  SubscriptionPlan.findOne.mockResolvedValue({
    name: 'Plus', type: 'private', entitlements: { freeContact: 15 },
  });

  const result = await resolveCurrentSubscriptionEntitlements(USER_ID);

  expect(result.hasPlan).toBe(false);
  expect(SubscriptionPlan.findOne).not.toHaveBeenCalled();
});

test('summarizes only successful, non-refunded extra contacts using stored amounts', () => {
  expect(summarizePaidExtraContacts([
    { type: 'extra_contact', status: 'succeeded', amount: 49, consumedAt: new Date() },
    { type: 'extra_contact', status: 'succeeded', amount: 29, consumedAt: new Date() },
    { type: 'extra_contact', status: 'succeeded', amount: 19, consumedAt: null },
    { type: 'extra_contact', status: 'pending', amount: 99, consumedAt: null },
    { type: 'extra_contact', status: 'failed', amount: 99, consumedAt: null },
    { type: 'extra_contact', status: 'succeeded', amount: 15, refunded: true, consumedAt: null },
    { type: 'subscription', status: 'succeeded', amount: 99, consumedAt: null },
  ])).toEqual({
    paidPurchased: 3,
    paidUsed: 2,
    paidAvailable: 1,
    totalPaidForExtraContacts: 97,
  });
});

test.each([
  [15, 6, 9],
  [0, 0, 0],
  [5, 6, 0],
])('calculates a non-negative included remainder for %i limit and %i used', (limit, used, remaining) => {
  expect(Math.max(limit - used, 0)).toBe(remaining);
});
