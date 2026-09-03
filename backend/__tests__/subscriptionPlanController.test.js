jest.mock('../models/SubscriptionPlan', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../models/Subscription', () => ({ exists: jest.fn() }));

const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const controller = require('../controllers/subscriptionPlanController');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function plan(overrides = {}) {
  return {
    _id: 'plan_1',
    name: 'Plus',
    price: 99,
    type: 'private',
    isActive: true,
    featuresText: [],
    entitlements: {
      freeContact: 15,
      perContactPrice: 29,
      ContactUnlock: 60,
      maxJobsValue: 20000,
      maxContact: 0,
      radius: 50,
      visibilityLevel: 2,
      locationPrecision: 'exact',
      hasBadge: false,
      hasAnalytics: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Subscription.exists.mockResolvedValue(false);
  SubscriptionPlan.findById.mockResolvedValue(plan());
  SubscriptionPlan.findByIdAndUpdate.mockResolvedValue(plan());
  SubscriptionPlan.findByIdAndDelete.mockResolvedValue(plan());
});

test('rejects malformed entitlement input with 400', async () => {
  const res = response();
  await controller.updatePlan(
    { params: { id: 'plan_1' }, body: { entitlements: { freeContact: -1 } } },
    res
  );
  expect(res.statusCode).toBe(400);
  expect(SubscriptionPlan.findByIdAndUpdate).not.toHaveBeenCalled();
});

test('blocks identity changes on referenced plans', async () => {
  Subscription.exists.mockResolvedValue(true);
  const res = response();
  await controller.updatePlan({ params: { id: 'plan_1' }, body: { type: 'business' } }, res);
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('plan_identity_in_use');
  expect(SubscriptionPlan.findByIdAndUpdate).not.toHaveBeenCalled();
});

test('blocks deletion of referenced plans', async () => {
  Subscription.exists.mockResolvedValue(true);
  const res = response();
  await controller.deletePlan({ params: { id: 'plan_1' } }, res);
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('plan_in_use');
  expect(SubscriptionPlan.findByIdAndDelete).not.toHaveBeenCalled();
});

test('passes normalized live entitlement values to the update', async () => {
  const res = response();
  await controller.updatePlan(
    {
      params: { id: 'plan_1' },
      body: { entitlements: { freeContact: 25, perContactPrice: 39, ContactUnlock: 30 } },
    },
    res
  );
  expect(res.statusCode).toBe(200);
  expect(SubscriptionPlan.findByIdAndUpdate).toHaveBeenCalledWith(
    'plan_1',
    expect.objectContaining({
      $set: expect.objectContaining({
        entitlements: expect.objectContaining({
          freeContact: 25,
          perContactPrice: 39,
          ContactUnlock: 30,
        }),
      }),
    }),
    expect.anything()
  );
});
