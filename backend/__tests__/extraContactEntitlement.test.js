/**
 * The contact paywall.
 *
 * Two holes are closed here:
 *   1. Any paid Stripe session id replayed in the request body granted unlimited
 *      bypass — no ownership, type, service or redemption check.
 *   2. A genuine extra-contact purchase was never marked consumed, so one purchase
 *      unlocked that service for that user permanently and without limit.
 */

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/SubscriptionPlan', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/Subscription', () => ({ findOne: jest.fn() }));
jest.mock('../models/Transaction', () => ({ findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn() }));
jest.mock('../models/JobRequest', () => ({ findOne: jest.fn() }));
jest.mock('../models/GlobalConfig', () => ({ findOne: jest.fn() }));

const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const GlobalConfig = require('../models/GlobalConfig');
const JobRequest = require('../models/JobRequest');
const Service = require('../models/Service');
const { checkSubscription } = require('../middleware/checkSubscription');

const mongoose = require('mongoose');

// Real ObjectIds: the middleware now refuses a serviceId that is not one, because
// `serviceId` is untyped body input and an operator object like {"$ne": null} would
// otherwise match — and consume — an entitlement bought for a different service.
const USER_ID = String(new mongoose.Types.ObjectId());
const SERVICE_ID = String(new mongoose.Types.ObjectId());

function makeReq(body = {}) {
  return { user: { _id: USER_ID }, body };
}

function makeRes() {
  const listeners = {};
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    on(event, cb) {
      listeners[event] = cb;
    },
    _finish(code) {
      this.statusCode = code;
      listeners.finish?.();
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({
    _id: USER_ID,
    monthlyContactUsage: 99,
    lastContactReset: new Date(),
    createdAt: new Date(),
    role: 'user',
    save: jest.fn().mockResolvedValue(),
  });
  Subscription.findOne.mockResolvedValue({
    currentPlan: { plan: 'Standard', planType: 'private' },
  });
  SubscriptionPlan.findOne.mockResolvedValue({
    entitlements: { freeContact: 0, perContactPrice: 49, ContactUnlock: 60 },
    type: 'private',
  });
  User.findOneAndUpdate.mockResolvedValue(null);
  GlobalConfig.findOne.mockResolvedValue(null);
  JobRequest.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
  Transaction.updateOne.mockResolvedValue({});
});

describe('replay protection', () => {
  it('ignores a Stripe sessionId in the body entirely', async () => {
    // No entitlement row exists; a paid session id must not help.
    Transaction.findOneAndUpdate.mockResolvedValue(null);

    const req = makeReq({ serviceId: SERVICE_ID, sessionId: 'cs_someone_elses_paid_session' });
    const res = makeRes();
    const next = jest.fn();

    await checkSubscription(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
    expect(res.body).toEqual(expect.objectContaining({ paymentRequired: true }));
  });
});

describe('entitlement consumption', () => {
  it('ignores a Mongo operator object in place of a serviceId', async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const res = makeRes();
    await checkSubscription(makeReq({ serviceId: { $ne: null } }), res, jest.fn());

    // Must never reach the entitlement claim with an injected filter.
    expect(Transaction.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('claims the entitlement atomically, requiring it to be unconsumed', async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const req = makeReq({ serviceId: SERVICE_ID });
    const next = jest.fn();

    await checkSubscription(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
    // A paid contact must not also spend a free monthly one.
    expect(req.isFreeContact).toBe(true);
    expect(Transaction.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        serviceId: SERVICE_ID,
        status: 'succeeded',
        type: 'extra_contact',
        consumedAt: null, // the guard that makes it single-use
      }),
      { $set: { consumedAt: expect.any(Date) } },
      expect.objectContaining({ new: true })
    );
    expect(req.consumedEntitlementId).toBe('txn_1');
  });

  it('refuses a second use of the same purchase', async () => {
    // First call claims it; the second finds nothing unconsumed.
    Transaction.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'txn_1' })
      .mockResolvedValueOnce(null);

    const firstNext = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), makeRes(), firstNext);
    expect(firstNext).toHaveBeenCalled();

    const secondRes = makeRes();
    const secondNext = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), secondRes, secondNext);

    expect(secondNext).not.toHaveBeenCalled();
    expect(secondRes.statusCode).toBe(402);
  });

  it('releases the entitlement if the request it was claimed for fails', async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const res = makeRes();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, jest.fn());

    res._finish(500); // downstream controller blew up

    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 'txn_1' },
      { $set: { consumedAt: null } }
    );
  });

  it('keeps the entitlement spent when the request succeeds', async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const res = makeRes();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, jest.fn());

    res._finish(201);

    expect(Transaction.updateOne).not.toHaveBeenCalled();
  });
});

describe('independence from Stripe configuration', () => {
  it('does not construct a Stripe client — a misconfigured key must not break applying', async () => {
    // config/stripe is deliberately NOT mocked here. If the middleware still called
    // getStripe() this would attempt real configuration lookup; instead it must not
    // be referenced at all.
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const next = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('free monthly quota still works', () => {
  it('requires a subscription for a company with no selected plan', async () => {
    User.findById.mockResolvedValue({
      _id: USER_ID,
      role: 'company',
      monthlyContactUsage: 0,
      lastContactReset: new Date(),
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(),
    });
    Subscription.findOne.mockResolvedValue({ currentPlan: null });
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'paid_contact' });

    const res = makeRes();
    const next = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'subscription_required',
        paymentRequired: true,
        upgradeRequired: true,
        limit: 0,
        usage: 0,
        remaining: 0,
      })
    );
    expect(Transaction.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('lets a user through while they have free contacts left', async () => {
    User.findById.mockResolvedValue({
      _id: USER_ID,
      monthlyContactUsage: 1,
      lastContactReset: new Date(),
      createdAt: new Date(),
      planType: 'private',
      role: 'user',
      save: jest.fn().mockResolvedValue(),
    });
    SubscriptionPlan.findOne.mockResolvedValue({
      entitlements: { freeContact: 5, perContactPrice: 49, ContactUnlock: 60 },
      type: 'private',
    });
    Transaction.findOneAndUpdate.mockResolvedValue(null);
    User.findOneAndUpdate.mockResolvedValue({ _id: USER_ID });

    const next = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks a company with a live business plan whose freeContact is zero', async () => {
    User.findById.mockResolvedValue({
      _id: USER_ID,
      role: 'company',
      planType: 'private',
      monthlyContactUsage: 0,
      lastContactReset: new Date(),
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(),
    });
    Subscription.findOne.mockResolvedValue({
      currentPlan: { planId: 'business_pro', plan: 'Pro', planType: 'business' },
    });
    SubscriptionPlan.findOne.mockResolvedValue({
      name: 'Pro',
      type: 'business',
      entitlements: { freeContact: 0, perContactPrice: 39, ContactUnlock: 0 },
    });
    SubscriptionPlan.findById.mockResolvedValue({
      name: 'Pro',
      type: 'business',
      entitlements: { freeContact: 0, perContactPrice: 39, ContactUnlock: 0 },
    });
    Transaction.findOneAndUpdate.mockResolvedValue(null);
    User.findOneAndUpdate.mockResolvedValue(null);
    const res = makeRes();
    const next = jest.fn();

    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'contact_limit_reached',
        paymentRequired: true,
        upgradeRequired: true,
        limit: 0,
        usage: 0,
        remaining: 0,
        perContactPrice: 39,
      })
    );
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID, monthlyContactUsage: { $lt: 0 } },
      { $inc: { monthlyContactUsage: 1 } },
      { new: true }
    );
  });

  it('does not apply the private under-10k exception to a company with stale planType', async () => {
    User.findById.mockResolvedValue({
      _id: USER_ID,
      role: 'company',
      planType: 'private',
      monthlyContactUsage: 0,
      lastContactReset: new Date(),
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(),
    });
    Subscription.findOne.mockResolvedValue({
      currentPlan: { planId: 'business_start', plan: 'Start', planType: 'business' },
    });
    SubscriptionPlan.findOne.mockResolvedValue({
      name: 'Start',
      type: 'business',
      entitlements: { freeContact: 0, perContactPrice: 49, ContactUnlock: 120 },
    });
    SubscriptionPlan.findById.mockResolvedValue({
      name: 'Start',
      type: 'business',
      entitlements: { freeContact: 0, perContactPrice: 49, ContactUnlock: 120 },
    });
    GlobalConfig.findOne.mockResolvedValue({ key: 'FREE_PRIVATE_JOBS_UNDER_10000', value: true });
    Service.findById.mockResolvedValue({ price: 100 });
    User.findOneAndUpdate.mockResolvedValue(null);

    const res = makeRes();
    const next = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
    expect(res.body.remaining).toBe(0);
  });

  it('does not turn an expired zero-contact cooldown into free access', async () => {
    User.findById.mockResolvedValue({
      _id: USER_ID,
      role: 'company',
      monthlyContactUsage: 0,
      lastContactReset: new Date(),
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(),
    });
    Subscription.findOne.mockResolvedValue({
      currentPlan: { planId: 'business_start', plan: 'Start', planType: 'business' },
    });
    SubscriptionPlan.findOne.mockResolvedValue({
      name: 'Start',
      type: 'business',
      entitlements: { freeContact: 0, perContactPrice: 49, ContactUnlock: 120 },
    });
    SubscriptionPlan.findById.mockResolvedValue({
      name: 'Start',
      type: 'business',
      entitlements: { freeContact: 0, perContactPrice: 49, ContactUnlock: 120 },
    });
    JobRequest.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({ createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }),
    });
    User.findOneAndUpdate.mockResolvedValue(null);

    const res = makeRes();
    const next = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
  });

  it('allows exactly one included contact when the live limit is one', async () => {
    let userReads = 0;
    User.findById.mockImplementation(async () => ({
      _id: USER_ID,
      role: 'company',
      monthlyContactUsage: userReads++ < 2 ? 0 : 1,
      lastContactReset: new Date(),
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(),
    }));
    Subscription.findOne.mockResolvedValue({
      currentPlan: { planId: 'business_start', plan: 'Start', planType: 'business' },
    });
    SubscriptionPlan.findOne.mockResolvedValue({
      name: 'Start',
      type: 'business',
      entitlements: { freeContact: 1, perContactPrice: 49, ContactUnlock: 0 },
    });
    SubscriptionPlan.findById.mockResolvedValue({
      name: 'Start',
      type: 'business',
      entitlements: { freeContact: 1, perContactPrice: 49, ContactUnlock: 0 },
    });
    Transaction.findOneAndUpdate.mockResolvedValue(null);
    User.findOneAndUpdate.mockResolvedValueOnce({ _id: USER_ID }).mockResolvedValueOnce(null);

    const first = makeRes();
    const firstNext = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), first, firstNext);
    const second = makeRes();
    const secondNext = jest.fn();
    await checkSubscription(
      makeReq({ serviceId: String(new mongoose.Types.ObjectId()) }),
      second,
      secondNext
    );

    expect(firstNext).toHaveBeenCalled();
    expect(secondNext).not.toHaveBeenCalled();
    expect(second.statusCode).toBe(402);
    expect(second.body.remaining).toBe(0);
  });
});
