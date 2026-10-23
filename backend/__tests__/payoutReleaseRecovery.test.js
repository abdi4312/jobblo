/**
 * releasePayoutToProvider recovery paths, against an in-memory Payout store that
 * honours the real compare-and-swap filters (the older bug006 mock ignored them, which
 * hid the dead ends below). Stripe is a fake that records every transfer.
 *
 *  - a transient Stripe READ error before any transfer froze the payout as
 *    `reconciliation_required`, which nothing retries;
 *  - a `reconciliation_required` payout could never even run its Stripe lookup;
 *  - a dispute release from a `disputed` / `partially_refunded` payment always failed;
 *  - a retried failed payout kept its old amounts;
 *  - a provider without Connect left no payout record to retry.
 */
jest.mock('../config/stripe', () => ({ getStripeForMode: jest.fn() }));
jest.mock('../services/stripe/financialHistory', () => ({ recordStripeTransfer: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/Payout', () => {
  const rows = [];
  const matches = (doc, filter) => Object.entries(filter).every(([k, cond]) => {
    const v = doc[k];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('$in' in cond) return cond.$in.includes(v ?? null);
      if ('$ne' in cond) return v !== cond.$ne;
    }
    if (cond === null) return v == null;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    return String(v) === String(cond);
  });
  class FakePayout {
    constructor(data) { Object.assign(this, data); if (!this._id) this._id = `payout_${rows.length + 1}`; }
    async save() { const i = rows.findIndex((r) => r._id === this._id); if (i >= 0) rows[i] = this; else { if (rows.some((r) => r.orderId === this.orderId)) { const e = new Error('dup'); e.code = 11000; throw e; } rows.push(this); } return this; }
    transitionTo(status, extra) { this.status = status; Object.assign(this, extra || {}); }
    // Like MongoDB, every read returns its own copy of the document.
    static async findOne(f) { const d = rows.find((r) => matches(r, f)); return d ? new FakePayout({ ...d }) : null; }
    static async findOneAndUpdate(f, u) {
      const doc = rows.find((r) => matches(r, f));
      if (!doc) return null;
      Object.assign(doc, u.$set || {});
      for (const [k, n] of Object.entries(u.$inc || {})) doc[k] = (doc[k] || 0) + n;
      return new FakePayout({ ...doc });
    }
    static async updateOne(f, u, opts = {}) {
      let doc = rows.find((r) => matches(r, f));
      if (!doc && opts.upsert) { doc = new FakePayout({ ...(u.$setOnInsert || {}) }); rows.push(doc); }
      if (doc) Object.assign(doc, u.$set || {});
      return { matchedCount: doc ? 1 : 0 };
    }
  }
  FakePayout.rows = rows;
  return FakePayout;
});
jest.mock('../models/Order', () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/Payment', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/User', () => ({ findById: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) }));
jest.mock('../models/Dispute', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/StripePaymentIncident', () => ({ findOne: jest.fn() }));

const Payout = require('../models/Payout');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Dispute = require('../models/Dispute');
const StripePaymentIncident = require('../models/StripePaymentIncident');
const { getStripeForMode } = require('../config/stripe');
const releasePayoutToProvider = require('../services/payout/releasePayoutToProvider');

const lean = (v) => ({ lean: async () => v, select() { return this; } });
let order; let payment; let provider; let stripe; let transfers;

const baseArgs = (over = {}) => ({
  orderId: 'order_1', providerId: 'prov_1', customerId: 'cust_1', serviceId: 'svc_1',
  grossAmount: 1000, platformFee: 30, releaseSource: 'customer_approve', releasedBy: 'cust_1',
  stripePaymentIntentId: 'pi_1', stripeCheckoutSessionId: 'cs_1', ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  Payout.rows.length = 0;
  transfers = [];
  order = {
    _id: 'order_1', providerId: 'prov_1', customerId: 'cust_1', serviceId: 'svc_1', status: 'completed',
    paymentStatus: 'paid', agreedPrice: 1000, checkoutMode: 'test', checkoutSessionId: 'cs_1', paymentIntentId: 'pi_1',
    checkoutCustomerId: 'cus_1', checkoutAmountMinor: 103000, checkoutCurrency: 'nok',
  };
  payment = { orderId: 'order_1', status: 'completed', stripeSessionId: 'cs_1', stripePaymentIntentId: 'pi_1', stripeLivemode: false };
  provider = { stripeConnectAccountIdTest: 'acct_p' };
  Order.findById.mockImplementation(() => lean({ ...order }));
  Payment.findOne.mockImplementation(() => lean({ ...payment }));
  User.findById.mockImplementation(() => ({ select: async () => (provider ? { ...provider } : null) }));
  Dispute.findOne.mockImplementation(() => lean(null));
  StripePaymentIncident.findOne.mockImplementation(() => lean(null));
  // The order fence: same compare-and-swap semantics as MongoDB on the shared `order`.
  Order.findOneAndUpdate.mockImplementation(async (f, u) => {
    const [, mine, stale] = f.$or;
    const free = order.payoutLockId == null || order.payoutLockId === mine.payoutLockId ||
      (order.payoutLockedAt && order.payoutLockedAt <= stale.payoutLockedAt.$lte);
    if (!f.status.$in.includes(order.status) || !free) return null;
    Object.assign(order, u.$set);
    return { ...order };
  });
  Order.updateOne.mockImplementation(async (f, u) => {
    if (order.payoutLockId === f.payoutLockId) Object.assign(order, u.$set);
    return {};
  });
  stripe = {
    checkout: { sessions: { retrieve: jest.fn(async () => ({ id: 'cs_1', livemode: false, mode: 'payment', status: 'complete', payment_status: 'paid', payment_intent: 'pi_1', customer: 'cus_1', amount_total: 103000, currency: 'nok' })) } },
    paymentIntents: { retrieve: jest.fn(async () => ({ id: 'pi_1', status: 'succeeded', amount_received: 103000, currency: 'nok', customer: 'cus_1', latest_charge: 'ch_1' })) },
    charges: { retrieve: jest.fn(async () => ({ id: 'ch_1', paid: true, captured: true, amount: 103000, amount_refunded: 0, currency: 'nok', payment_intent: 'pi_1', customer: 'cus_1', disputed: false })) },
    accounts: { retrieve: jest.fn(async () => ({ id: 'acct_p', payouts_enabled: true, capabilities: { transfers: 'active' }, metadata: { jobbloUserId: 'prov_1' } })) },
    transfers: {
      create: jest.fn(async (params, opts) => {
        const existing = transfers.find((t) => t.idem === opts.idempotencyKey);
        if (existing) return existing;
        const t = { id: `tr_${transfers.length + 1}`, idem: opts.idempotencyKey, ...params, livemode: false };
        transfers.push(t);
        return t;
      }),
      list: jest.fn(async () => ({ data: transfers, has_more: false })),
    },
  };
  getStripeForMode.mockResolvedValue(stripe);
});

describe('no transfer attempted -> plain retryable failure', () => {
  it('a transient Stripe read error records `failed` (not reconciliation_required) and a retry pays once', async () => {
    stripe.checkout.sessions.retrieve.mockRejectedValueOnce(Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }));
    await expect(releasePayoutToProvider(baseArgs())).rejects.toThrow('timeout');
    expect(Payout.rows[0]).toMatchObject({ status: 'failed', failureReason: expect.stringMatching(/no transfer was attempted/) });
    expect(stripe.transfers.create).not.toHaveBeenCalled();

    const result = await releasePayoutToProvider(baseArgs({ releaseSource: 'admin_override' })); // as retryFailedPayouts does
    expect(result.payout.status).toBe('transferred');
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ amount: 97000, destination: 'acct_p', source_transaction: 'ch_1' });
  });

  it('never overwrites an in-flight processing attempt', async () => {
    Payout.rows.push(new Payout({ orderId: 'order_1', status: 'processing', lastAttemptedAt: new Date(), grossAmount: 1000, netProviderAmount: 970 }));
    stripe.charges.retrieve.mockRejectedValueOnce(new Error('timeout'));
    await expect(releasePayoutToProvider(baseArgs())).rejects.toThrow();
    expect(Payout.rows[0].status).toBe('processing');
  });

  it('a provider without Connect leaves a retryable record, paid once they connect', async () => {
    provider = {};
    await expect(releasePayoutToProvider(baseArgs())).rejects.toMatchObject({ code: 'PAYOUT_SETUP_REQUIRED' });
    expect(Payout.rows[0]).toMatchObject({ status: 'failed', failureCode: 'PAYOUT_SETUP_REQUIRED', netProviderAmount: 970 });

    provider = { stripeConnectAccountIdTest: 'acct_p' };
    await expect(releasePayoutToProvider(baseArgs())).resolves.toMatchObject({ payout: { status: 'transferred' } });
    expect(transfers).toHaveLength(1);
  });
});

describe('unknown transfer outcome (reconciliation_required)', () => {
  const unknownAttempt = () => new Payout({
    orderId: 'order_1', status: 'reconciliation_required', idempotencyKey: 'payout_order_order_1', stripeLivemode: false,
    grossAmount: 1000, platformFee: 30, netProviderAmount: 970, lastAttemptedAt: new Date(Date.now() - 3600_000),
  });

  it('records a transfer that DID happen (previously stuck forever)', async () => {
    const p = unknownAttempt();
    Payout.rows.push(p);
    transfers.push({ id: 'tr_lost', amount: 97000, currency: 'nok', destination: 'acct_p', source_transaction: 'ch_1', livemode: false, metadata: { payoutId: String(p._id) } });

    const result = await releasePayoutToProvider(baseArgs());
    expect(result).toMatchObject({ reconciled: true, payout: { status: 'transferred', stripeTransferId: 'tr_lost' } });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it('with no transfer found it stays in reconciliation and still never creates one', async () => {
    Payout.rows.push(unknownAttempt());
    await expect(releasePayoutToProvider(baseArgs())).rejects.toMatchObject({ code: 'PAYOUT_RECONCILIATION_REQUIRED' });
    expect(Payout.rows[0].status).toBe('reconciliation_required');
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it('two concurrent recoveries: only one claims the record', async () => {
    Payout.rows.push(unknownAttempt());
    const results = await Promise.allSettled([releasePayoutToProvider(baseArgs()), releasePayoutToProvider(baseArgs())]);
    expect(results.filter((r) => r.status === 'rejected' && r.reason.code === 'PAYOUT_PROCESSING').length).toBeGreaterThanOrEqual(1);
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
});

describe('dispute releases', () => {
  beforeEach(() => {
    order.status = 'disputed';
    payment.status = 'disputed'; // set by openDispute
    Dispute.findById.mockImplementation(() => lean({
      _id: 'disp_1', orderId: 'order_1', status: 'under_review',
      resolution: { outcome: 'split_payment', moneyState: 'pending', providerAmount: 600 },
    }));
  });

  it('pays the approved share from a disputed payment after a partial refund', async () => {
    order.paymentStatus = 'partially_refunded';
    stripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', paid: true, captured: true, amount: 103000, amount_refunded: 40000, currency: 'nok', payment_intent: 'pi_1', customer: 'cus_1', disputed: false });

    const r = await releasePayoutToProvider(baseArgs({ grossAmount: 600, platformFee: 0, releaseSource: 'dispute_release', disputeId: 'disp_1' }));
    expect(r.payout.status).toBe('transferred');
    expect(transfers[0].amount).toBe(60000);
  });

  it('still refuses when the remaining charge cannot cover the transfer', async () => {
    order.paymentStatus = 'partially_refunded';
    stripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', paid: true, captured: true, amount: 103000, amount_refunded: 50000, currency: 'nok', payment_intent: 'pi_1', customer: 'cus_1', disputed: false });
    await expect(releasePayoutToProvider(baseArgs({ grossAmount: 600, platformFee: 0, releaseSource: 'dispute_release', disputeId: 'disp_1' })))
      .rejects.toMatchObject({ code: 'PAYOUT_SOURCE_CHARGE_INVALID' });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it('a disputed payment does NOT unlock ordinary (non-dispute) releases', async () => {
    order.status = 'completed';
    await expect(releasePayoutToProvider(baseArgs())).rejects.toMatchObject({ code: 'PAYOUT_SOURCE_PAYMENT_UNVERIFIED' });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });

  it('a failed earlier payout is rewritten to the dispute amounts before transferring', async () => {
    Payout.rows.push(new Payout({ orderId: 'order_1', status: 'failed', idempotencyKey: 'payout_order_order_1', stripeLivemode: false, grossAmount: 1000, platformFee: 30, netProviderAmount: 970, releaseSource: 'customer_approve' }));
    await releasePayoutToProvider(baseArgs({ grossAmount: 600, platformFee: 0, releaseSource: 'dispute_release', disputeId: 'disp_1' }));
    expect(Payout.rows[0]).toMatchObject({ status: 'transferred', grossAmount: 600, platformFee: 0, netProviderAmount: 600, releaseSource: 'dispute_release', disputeId: 'disp_1' });
    expect(transfers[0].amount).toBe(60000);
  });
});

describe('no double payout', () => {
  it('a second call after a transfer returns the existing payout and makes no new transfer', async () => {
    await releasePayoutToProvider(baseArgs());
    await expect(releasePayoutToProvider(baseArgs())).resolves.toMatchObject({ alreadyPaid: true });
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
  });

  it('two simultaneous approvals transfer once', async () => {
    const results = await Promise.allSettled([releasePayoutToProvider(baseArgs()), releasePayoutToProvider(baseArgs())]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(transfers).toHaveLength(1);
  });

  it('a transfer error marks the outcome unknown, never success', async () => {
    stripe.transfers.create.mockRejectedValueOnce(Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }));
    await expect(releasePayoutToProvider(baseArgs())).rejects.toMatchObject({ code: 'PAYOUT_RECONCILIATION_REQUIRED' });
    expect(Payout.rows[0].status).toBe('reconciliation_required');
    expect(Payment.findOneAndUpdate).not.toHaveBeenCalled(); // Payment is not marked released
  });
});

describe('order fence: a dispute and a transfer cannot both win', () => {
  it('a dispute that lands after the checks but before the transfer stops it; no money moves', async () => {
    // The read-side checks all pass, then the customer's dispute claims the order.
    stripe.accounts.retrieve.mockImplementationOnce(async () => {
      order.status = 'disputed';
      return { id: 'acct_p', payouts_enabled: true, capabilities: { transfers: 'active' }, metadata: { jobbloUserId: 'prov_1' } };
    });
    await expect(releasePayoutToProvider(baseArgs())).rejects.toMatchObject({ code: 'PAYOUT_ORDER_HOLD_ACTIVE' });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(Payout.rows[0]).toMatchObject({ status: 'failed', failureCode: 'PAYOUT_ORDER_HOLD_ACTIVE' });
  });

  it('holds the order lock while the transfer is in flight and releases it afterwards', async () => {
    let lockDuringTransfer;
    const create = stripe.transfers.create.getMockImplementation();
    stripe.transfers.create.mockImplementationOnce(async (...a) => { lockDuringTransfer = order.payoutLockId; return create(...a); });
    const r = await releasePayoutToProvider(baseArgs());
    expect(lockDuringTransfer).toBe(String(r.payout._id));
    expect(order.payoutLockId).toBeNull();
  });

  it('an unknown transfer outcome keeps the lock (until its lease) so no dispute opens mid-reconciliation', async () => {
    stripe.transfers.create.mockRejectedValueOnce(Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }));
    await expect(releasePayoutToProvider(baseArgs())).rejects.toMatchObject({ code: 'PAYOUT_RECONCILIATION_REQUIRED' });
    expect(order.payoutLockId).toBe(String(Payout.rows[0]._id));
  });
});

describe('provider earnings are credited exactly once per transfer, on every path', () => {
  const credits = () => User.updateOne.mock.calls.filter(([, u]) => u.$inc?.earnings);

  it('a transfer credits the net amount once; a repeat call credits nothing', async () => {
    await releasePayoutToProvider(baseArgs({ releaseSource: 'admin_override', releasedBy: null }));
    await releasePayoutToProvider(baseArgs({ releaseSource: 'admin_override', releasedBy: null }));
    expect(credits()).toEqual([[{ _id: 'prov_1' }, { $inc: { earnings: 970 } }]]);
  });

  it('a recovered (reconciled) transfer is credited too, once', async () => {
    const p = new Payout({ orderId: 'order_1', providerId: 'prov_1', status: 'reconciliation_required', idempotencyKey: 'payout_order_order_1', stripeLivemode: false, grossAmount: 1000, platformFee: 30, netProviderAmount: 970, lastAttemptedAt: new Date(Date.now() - 3600_000) });
    Payout.rows.push(p);
    transfers.push({ id: 'tr_lost', amount: 97000, currency: 'nok', destination: 'acct_p', source_transaction: 'ch_1', livemode: false, metadata: { payoutId: String(p._id) } });
    await releasePayoutToProvider(baseArgs());
    await releasePayoutToProvider(baseArgs());
    expect(credits()).toHaveLength(1);
  });

  it('a failed transfer credits nothing', async () => {
    stripe.transfers.create.mockRejectedValueOnce(Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }));
    await expect(releasePayoutToProvider(baseArgs())).rejects.toBeTruthy();
    expect(credits()).toHaveLength(0);
  });
});
