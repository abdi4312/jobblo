/**
 * PUT /api/plans/:id — superAdmin may edit plan entitlements (incl. perContactPrice,
 * ContactUnlock, maxContact) and feature text; price/name/type/isActive stay locked
 * because they are tied to Stripe prices and existing subscriptions.
 */
jest.mock('../models/SubscriptionPlan', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));

const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { logActivity } = require('../services/admin/activityService');
const { updatePlanEntitlements } = require('../controllers/subscriptionV2Controller');

const planId = new mongoose.Types.ObjectId();
const plan = () => ({
  _id: planId, name: 'Plus', price: 99, type: 'private', isActive: true,
  entitlements: { freeContact: 15, perContactPrice: 29, ContactUnlock: 60, maxContact: 0, radius: 50 },
  featuresText: ['15 kontakter'],
});
const res = () => ({ status: jest.fn(function (c) { this.code = c; return this; }), json: jest.fn(function (b) { this.body = b; this.code ??= 200; return this; }) });
const put = async (body) => {
  const r = res();
  await updatePlanEntitlements({ params: { id: String(planId) }, body, user: { _id: 'admin_1' }, ip: '1', headers: {} }, r);
  return r;
};

beforeEach(() => {
  jest.clearAllMocks();
  SubscriptionPlan.findById.mockReturnValue({ lean: async () => plan() });
  SubscriptionPlan.findByIdAndUpdate.mockImplementation((_id, update) => ({ lean: async () => ({ ...plan(), ...update.$set }) }));
});

it('updates maxContact and the other entitlements, and audits old -> new', async () => {
  const r = await put({ ...plan(), entitlements: { ...plan().entitlements, maxContact: 3, perContactPrice: 25 } });
  expect(r.code).toBe(200);
  expect(SubscriptionPlan.findByIdAndUpdate).toHaveBeenCalledWith(planId, { $set: expect.objectContaining({ 'entitlements.maxContact': 3, 'entitlements.perContactPrice': 25 }) }, { new: true, runValidators: true });
  expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
    adminId: 'admin_1', action: 'settings_updated', targetModel: 'SubscriptionPlan',
    metadata: { changes: { 'entitlements.maxContact': { from: 0, to: 3 }, 'entitlements.perContactPrice': { from: 29, to: 25 } } },
  }));
});

it.each([
  ['price', { price: 149 }],
  ['name', { name: 'Plus 2' }],
  ['type', { type: 'business' }],
  ['isActive', { isActive: false }],
])('refuses to change the locked %s', async (field, over) => {
  const r = await put({ ...plan(), ...over });
  expect(r.code).toBe(409);
  expect(r.body).toMatchObject({ code: 'PLAN_FIELD_LOCKED', field });
  expect(SubscriptionPlan.findByIdAndUpdate).not.toHaveBeenCalled();
});

it.each([
  [{ maxContact: -1 }], [{ maxContact: 1.5 }], [{ ContactUnlock: 'abc' }], [{ freeContact: 2.5 }],
])('rejects an invalid entitlement %o', async (bad) => {
  const r = await put({ entitlements: bad });
  expect(r.code).toBe(400);
  expect(SubscriptionPlan.findByIdAndUpdate).not.toHaveBeenCalled();
});

it('allows a fractional price-like entitlement (perContactPrice) but not negative', async () => {
  expect((await put({ entitlements: { perContactPrice: 19.5 } })).code).toBe(200);
  expect((await put({ entitlements: { perContactPrice: -1 } })).code).toBe(400);
});

it('404 for an unknown plan, 400 for a bad id', async () => {
  SubscriptionPlan.findById.mockReturnValue({ lean: async () => null });
  expect((await put({ entitlements: { maxContact: 1 } })).code).toBe(404);
  const r = res();
  await updatePlanEntitlements({ params: { id: 'nope' }, body: {}, user: { _id: 'a' }, headers: {} }, r);
  expect(r.code).toBe(400);
});

it('the route is superAdmin-only', () => {
  const src = require('fs').readFileSync(require.resolve('../routes/subscriptionPlan'), 'utf8');
  expect(src).toMatch(/router\.put\('\/:id', authenticate, requireAdmin, subscriptionV2Controller\.updatePlanEntitlements\)/);
  expect(src).toMatch(/router\.post\('\/', subscriptionRebuildInProgress\)/);
  expect(src).toMatch(/router\.delete\('\/:id', subscriptionRebuildInProgress\)/);
});
