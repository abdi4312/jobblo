/**
 * Paid extra contacts per job (services/subscriptions/v2ExtraContacts.js):
 * perContactPrice, maxContact per billing period (0 = off), ContactUnlock cooldown,
 * Stripe-confirmed payment only, consumed once by an application to the same job.
 */
jest.mock('../models/Service', () => ({ findById: jest.fn() }));
jest.mock('../models/JobRequest', () => ({ exists: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/SubscriptionUsagePeriod', () => ({ updateOne: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripeConfiguration: jest.fn(), getStripeForMode: jest.fn() }));
jest.mock('../services/stripe/customers', () => ({ resolveStripeCustomer: jest.fn() }));

const mongoose = require('mongoose');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const User = require('../models/User');
const UsageModel = require('../models/SubscriptionUsagePeriod');
const {
  extraContactOffer, createExtraContactCheckout, confirmExtraContactSession, consumePaidExtraContact,
} = require('../services/subscriptions/v2ExtraContacts');

// ── in-memory ExtraContactPurchase honouring the filters used by the service ────────
function fakeModel() {
  const rows = [];
  const match = (d, f) => Object.entries(f).every(([k, c]) => {
    if (k === '$or') return c.some((x) => match(d, x));
    const v = d[k];
    if (c && typeof c === 'object' && !(c instanceof Date) && !(c instanceof mongoose.Types.ObjectId)) {
      if ('$in' in c) return c.$in.includes(v);
      if ('$gt' in c) return v > c.$gt;
      if ('$lte' in c) return v <= c.$lte;
    }
    if (c instanceof Date) return v instanceof Date && v.getTime() === c.getTime();
    return String(v) === String(c);
  });
  const chain = (v) => ({ sort() { return this; }, select() { return this; }, lean: async () => v });
  return {
    rows,
    exists: async (f) => rows.some((d) => match(d, f)),
    countDocuments: async (f) => rows.filter((d) => match(d, f)).length,
    findOne: (f) => chain([...rows].filter((d) => match(d, f)).sort((a, b) => (b.consumedAt || 0) - (a.consumedAt || 0))[0] || null),
    findById: (id) => chain(rows.find((d) => String(d._id) === String(id)) || null),
    create: async (doc) => {
      if (rows.some((d) => String(d.userId) === String(doc.userId) && d.status === 'pending')) throw Object.assign(new Error('dup'), { code: 11000 });
      const row = { _id: new mongoose.Types.ObjectId(), status: 'pending', currency: 'nok', ...doc };
      rows.push(row);
      return row;
    },
    updateMany: async (f, u) => { rows.filter((d) => match(d, f)).forEach((d) => Object.assign(d, u.$set)); },
    updateOne: async (f, u) => { const d = rows.find((x) => match(x, f)); if (d) Object.assign(d, u.$set); return { matchedCount: d ? 1 : 0 }; },
    findOneAndUpdate: async (f, u) => { const d = rows.find((x) => match(x, f)); if (!d) return null; Object.assign(d, u.$set); return { ...d }; },
  };
}

const NOW = new Date('2026-10-21T12:00:00Z');
const userId = new mongoose.Types.ObjectId();
const serviceId = new mongoose.Types.ObjectId();
const periodStart = '2026-10-01T00:00:00.000Z';
const ents = (over = {}) => ({
  period: { start: periodStart, end: '2026-11-01T00:00:00.000Z' },
  remainingIncludedContacts: 0,
  entitlements: { perContactPrice: 49, maxContact: 3, ContactUnlock: 120, ...over },
});
let Model;
beforeEach(() => { jest.clearAllMocks(); Model = fakeModel(); });

describe('extraContactOffer', () => {
  const offer = (e, extra = {}) => extraContactOffer({ userId, serviceId, entitlements: e, now: NOW, ...extra }, Model);

  it('is offered at perContactPrice once included contacts are used up', async () => {
    await expect(offer(ents())).resolves.toMatchObject({ available: true, priceNok: 49, maxPerPeriod: 3, usedThisPeriod: 0 });
  });
  it('is not offered while included contacts remain', async () => {
    await expect(offer({ ...ents(), remainingIncludedContacts: 2 })).resolves.toMatchObject({ available: false, reason: 'included_remaining' });
  });
  it.each([[{ maxContact: 0 }], [{ perContactPrice: 0 }]])('is off for the plan when %o', async (over) => {
    await expect(offer(ents(over))).resolves.toMatchObject({ available: false, reason: 'disabled' });
  });
  it('stops at maxContact per billing period (paid, consumed and open checkouts count)', async () => {
    const base = { userId, billingPeriodStart: new Date(periodStart) };
    Model.rows.push({ ...base, status: 'consumed', consumedAt: new Date(NOW.getTime() - 5 * 3600_000) });
    Model.rows.push({ ...base, status: 'paid', serviceId: new mongoose.Types.ObjectId() });
    Model.rows.push({ ...base, status: 'pending', expiresAt: new Date(NOW.getTime() + 60_000) });
    await expect(offer(ents())).resolves.toMatchObject({ available: false, reason: 'period_limit_reached', usedThisPeriod: 3 });
  });
  it('an expired unpaid checkout does not count', async () => {
    Model.rows.push({ userId, billingPeriodStart: new Date(periodStart), status: 'pending', expiresAt: new Date(NOW.getTime() - 1) });
    await expect(offer(ents())).resolves.toMatchObject({ available: true, usedThisPeriod: 0 });
  });
  it('the next extra contact unlocks ContactUnlock minutes after the last one was used', async () => {
    Model.rows.push({ userId, billingPeriodStart: new Date(periodStart), status: 'consumed', consumedAt: new Date(NOW.getTime() - 30 * 60_000) });
    await expect(offer(ents())).resolves.toMatchObject({
      available: false, reason: 'cooldown', unlockAt: new Date(NOW.getTime() + 90 * 60_000),
    });
    await expect(offer(ents({ ContactUnlock: 0 }))).resolves.toMatchObject({ available: true });
  });
  it('a job already paid for is not offered again', async () => {
    Model.rows.push({ userId, serviceId, status: 'paid' });
    await expect(offer(ents())).resolves.toMatchObject({ available: false, reason: 'already_paid' });
  });
});

describe('createExtraContactCheckout', () => {
  let stripe;
  const deps = (over = {}) => ({
    Model,
    now: () => NOW,
    resolveEntitlements: async () => ents(),
    entitlementsEnabled: () => true,
    getStripeConfiguration: async () => ({ mode: 'test', testMode: true, keyModeValid: true }),
    getStripeForMode: async () => stripe,
    resolveStripeCustomer: async () => 'cus_1',
    ...over,
  });
  beforeEach(() => {
    stripe = { checkout: { sessions: { create: jest.fn(async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })) } } };
    Service.findById.mockReturnValue({ select: () => ({ lean: async () => ({ userId: new mongoose.Types.ObjectId(), status: 'open', title: 'Maling' }) }) });
    JobRequest.exists.mockResolvedValue(null);
    User.findById.mockResolvedValue({ _id: userId });
  });

  it('creates a one-time NOK Checkout for exactly perContactPrice, tagged to this user and job', async () => {
    await expect(createExtraContactCheckout({ userId, serviceId }, deps())).resolves.toMatchObject({ sessionId: 'cs_test_1', priceNok: 49 });
    const [params, opts] = stripe.checkout.sessions.create.mock.calls[0];
    expect(params).toMatchObject({
      mode: 'payment', customer: 'cus_1',
      line_items: [{ quantity: 1, price_data: { currency: 'nok', unit_amount: 4900 } }],
      metadata: { type: 'extra_contact', userId: String(userId), serviceId: String(serviceId), stripeMode: 'test' },
    });
    expect(opts.idempotencyKey).toMatch(/^jobblo-extra-contact:/);
    expect(Model.rows[0]).toMatchObject({ status: 'pending', amountMinor: 4900, checkoutSessionId: 'cs_test_1' });
  });
  it('refuses when not offered (e.g. cooldown) and creates nothing', async () => {
    Model.rows.push({ userId, billingPeriodStart: new Date(periodStart), status: 'consumed', consumedAt: NOW });
    await expect(createExtraContactCheckout({ userId, serviceId }, deps())).rejects.toMatchObject({ code: 'EXTRA_CONTACT_UNAVAILABLE', details: { extraContact: { reason: 'cooldown' } } });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it('only one open checkout per user at a time', async () => {
    await createExtraContactCheckout({ userId, serviceId }, deps());
    await expect(createExtraContactCheckout({ userId, serviceId: new mongoose.Types.ObjectId() }, deps())).rejects.toMatchObject({ code: 'EXTRA_CONTACT_CHECKOUT_OPEN' });
  });
  it.each([
    ['own job', () => Service.findById.mockReturnValue({ select: () => ({ lean: async () => ({ userId, status: 'open' }) }) }), 'OWN_SERVICE'],
    ['closed job', () => Service.findById.mockReturnValue({ select: () => ({ lean: async () => ({ userId: new mongoose.Types.ObjectId(), status: 'closed' }) }) }), 'SERVICE_CLOSED'],
    ['already applied', () => JobRequest.exists.mockResolvedValue({ _id: 'jr' }), 'ALREADY_APPLIED'],
  ])('refuses for an %s', async (_l, arrange, code) => {
    arrange();
    await expect(createExtraContactCheckout({ userId, serviceId }, deps())).rejects.toMatchObject({ code });
  });
  it('frees the slot when Stripe fails', async () => {
    stripe.checkout.sessions.create.mockRejectedValueOnce(new Error('down'));
    await expect(createExtraContactCheckout({ userId, serviceId }, deps())).rejects.toMatchObject({ code: 'STRIPE_UNAVAILABLE' });
    expect(Model.rows[0].status).toBe('expired');
  });
  it('is off when V2 entitlements are disabled', async () => {
    await expect(createExtraContactCheckout({ userId, serviceId }, deps({ entitlementsEnabled: () => false }))).rejects.toMatchObject({ code: 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED' });
  });
});

describe('confirmExtraContactSession (Stripe-verified only)', () => {
  let purchase;
  const session = (over = {}) => ({
    id: 'cs_test_1', mode: 'payment', payment_status: 'paid', amount_total: 4900, currency: 'nok', livemode: false,
    payment_intent: 'pi_1',
    metadata: { type: 'extra_contact', purchaseId: String(purchase._id), userId: String(userId), serviceId: String(serviceId) },
    ...over,
  });
  beforeEach(async () => {
    purchase = await Model.create({ userId, serviceId, billingPeriodStart: new Date(periodStart), stripeMode: 'test', amountMinor: 4900, expiresAt: NOW });
    purchase.checkoutSessionId = 'cs_test_1';
  });

  it('marks the purchase paid once, and counts it on the usage period', async () => {
    await expect(confirmExtraContactSession(session(), Model, UsageModel)).resolves.toEqual({ handled: 'extra_contact_paid' });
    expect(Model.rows[0]).toMatchObject({ status: 'paid', paymentIntentId: 'pi_1' });
    await expect(confirmExtraContactSession(session(), Model, UsageModel)).resolves.toEqual({ handled: 'extra_contact_already_paid' });
    expect(UsageModel.updateOne).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['a different amount', { amount_total: 100 }],
    ['another session', { id: 'cs_test_other' }],
    ['the wrong Stripe mode', { livemode: true }],
    ['another currency', { currency: 'usd' }],
  ])('refuses %s', async (_l, over) => {
    await expect(confirmExtraContactSession(session(over), Model, UsageModel)).resolves.toEqual({ handled: 'extra_contact_mismatch' });
    expect(Model.rows[0].status).toBe('pending');
  });
  it('does nothing for an unpaid session', async () => {
    await expect(confirmExtraContactSession(session({ payment_status: 'unpaid' }), Model, UsageModel)).resolves.toEqual({ handled: 'extra_contact_unpaid' });
  });
});

describe('consumePaidExtraContact', () => {
  it('uses a paid contact only for the job it was bought for, exactly once', async () => {
    const otherJob = new mongoose.Types.ObjectId();
    Model.rows.push({ _id: 'p1', userId, serviceId, status: 'paid' });
    const args = (sid) => ({ userId, serviceId: sid, jobRequestId: 'jr1', usagePeriodId: 'u1', operationId: 'job-request:jr1', now: NOW });
    await expect(consumePaidExtraContact(args(otherJob), { Model, UsageModel })).resolves.toBe(false);
    await expect(consumePaidExtraContact(args(serviceId), { Model, UsageModel })).resolves.toBe(true);
    await expect(consumePaidExtraContact(args(serviceId), { Model, UsageModel })).resolves.toBe(false);
    expect(Model.rows[0]).toMatchObject({ status: 'consumed', jobRequestId: 'jr1' });
    expect(UsageModel.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      { $inc: { consumedExtraContacts: 1 }, $push: { contactOperations: { operationId: 'job-request:jr1', status: 'consumed' } } },
      {}
    );
  });
});
