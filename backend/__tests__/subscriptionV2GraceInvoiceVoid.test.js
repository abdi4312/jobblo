/**
 * Policy Option A: after the grace worker itself cancels an unpaid subscription, void the
 * exact failed-renewal invoice so it can no longer be paid for nothing. Gated OFF by
 * default (SUBSCRIPTION_V2_GRACE_EXPIRY_INVOICE_VOID_ENABLED) pending client/accounting
 * approval.
 *
 * In-memory models honour the real compare-and-swap filters; Stripe is a fake that keeps
 * invoice state. No real Stripe call is made.
 */
jest.mock('../config/stripe', () => ({ getStripeForMode: jest.fn() }));
jest.mock('../utils/emailService', () => ({ sendSubscriptionRecoveryEmail: jest.fn() }));

const mongoose = require('mongoose');
const {
  graceExpiryInvoiceVoidEnabled,
  voidGraceExpiredInvoice,
  cancelExpiredRecoveries,
} = require('../services/subscriptions/v2RecoveryPolicy');

const ON = { SUBSCRIPTION_V2_GRACE_EXPIRY_INVOICE_VOID_ENABLED: 'true', SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true', SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true' };
const OFF = { SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED: 'true', SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED: 'true' };
const now = new Date('2026-10-27T17:10:00Z');
const userId = new mongoose.Types.ObjectId();
const planId = new mongoose.Types.ObjectId();
const recordId = new mongoose.Types.ObjectId();

// ── tiny matcher for the filters the code under test uses ───────────────────────
function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$or') return cond.some((f) => matches(doc, f));
    const value = doc[key];
    if (cond instanceof RegExp) return cond.test(value);
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !(cond instanceof mongoose.Types.ObjectId)) {
      if ('$in' in cond) return cond.$in.includes(value ?? null);
      if ('$ne' in cond) return value !== cond.$ne;
      if ('$lte' in cond) return value != null && value <= cond.$lte;
    }
    if (cond === null) return value == null;
    return String(value) === String(cond);
  });
}
const q = (v) => ({ lean: async () => v, limit() { return this; }, then: (r, j) => Promise.resolve(v).then(r, j) });
function apply(doc, update) {
  Object.assign(doc, update.$set || {});
  for (const [k, n] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + n;
  for (const [k, v] of Object.entries(update.$push || {})) doc[k] = [...(doc[k] || []), v];
}
function model(rows) {
  return {
    rows,
    find: jest.fn((f) => q(rows.filter((d) => matches(d, f)).map((d) => ({ ...d })))),
    findOne: jest.fn((f) => q(rows.find((d) => matches(d, f)) ? { ...rows.find((d) => matches(d, f)) } : null)),
    findById: jest.fn((id) => q(rows.find((d) => String(d._id) === String(id)) ? { ...rows.find((d) => String(d._id) === String(id)) } : null)),
    findOneAndUpdate: jest.fn((f, update, opts = {}) => {
      let doc = rows.find((d) => matches(d, f));
      if (!doc && opts.upsert) {
        doc = { _id: new mongoose.Types.ObjectId(), ...Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v !== 'object')), ...(update.$setOnInsert || {}) };
        rows.push(doc);
      }
      if (!doc) return q(null);
      apply(doc, update);
      return q({ ...doc });
    }),
    updateOne: jest.fn(async (f, update) => {
      const doc = rows.find((d) => matches(d, f));
      if (doc) apply(doc, update);
      return { matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 };
    }),
    updateMany: jest.fn(async () => ({ modifiedCount: 0 })),
  };
}

let Subs; let Ops; let Emails; let stripe; let inv;
function exhaustedRecord(overrides = {}) {
  return {
    _id: recordId, userId, planId, stripeMode: 'test', stripeSubscriptionId: 'sub_g', stripeCustomerId: 'cus_g',
    status: 'canceled', paymentRecoveryStatus: 'exhausted', recoveryInvoiceId: 'in_g',
    gracePeriodEndsAt: new Date(now.getTime() - 60000), recoveryHistory: [], ...overrides,
  };
}
const expiryOp = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(), stripeMode: 'test', operationId: 'grace-expiry:sub_g:in_g',
  idempotencyKey: 'jobblo-subv2-test-grace-expiry:sub_g:in_g', operationType: 'renewal_recovery', status: 'succeeded',
  userId, subscriptionId: recordId, stripeSubscriptionId: 'sub_g', stripeInvoiceId: 'in_g', ...overrides,
});
function fakeStripe() {
  inv = { id: 'in_g', status: 'open', billing_reason: 'subscription_cycle', livemode: false, customer: 'cus_g', amount_paid: 0, parent: { subscription_details: { subscription: 'sub_g' } } };
  const sub = { id: 'sub_g', customer: 'cus_g', livemode: false, status: 'canceled', metadata: { subscriptionV2: 'true', userId: String(userId), planId: String(planId), stripeMode: 'test' } };
  return {
    sub,
    payments: [],
    subscriptions: {
      retrieve: jest.fn(async () => ({ ...sub })),
      cancel: jest.fn(async () => { sub.status = 'canceled'; return { ...sub }; }),
    },
    invoices: {
      retrieve: jest.fn(async () => ({ ...inv })),
      voidInvoice: jest.fn(async (id) => { if (inv.status !== 'open') throw Object.assign(new Error('not open'), { type: 'StripeInvalidRequestError', code: 'invoice_not_open' }); inv.status = 'void'; return { ...inv }; }),
    },
    invoicePayments: { list: jest.fn(async () => ({ data: stripe.payments })) },
  };
}
const run = (overrides = {}, env = ON) =>
  voidGraceExpiredInvoice({ record: Subs.rows[0], stripe, now, start: true, ...overrides }, { SubscriptionModel: Subs, OperationModel: Ops, env });
const voidOp = () => Ops.rows.find((o) => o.operationId === 'grace-expiry-void:sub_g:in_g');

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  Subs = model([exhaustedRecord()]);
  Ops = model([expiryOp()]);
  Emails = model([]);
  stripe = fakeStripe();
});
afterEach(() => jest.restoreAllMocks());

describe('gate', () => {
  test('defaults OFF and does nothing at all while off', async () => {
    expect(graceExpiryInvoiceVoidEnabled({})).toBe(false);
    await expect(run({}, OFF)).resolves.toEqual({ skipped: 'disabled' });
    expect(stripe.invoices.retrieve).not.toHaveBeenCalled();
    expect(voidOp()).toBeUndefined();
  });
});

describe('voiding the exact failed-renewal invoice', () => {
  test('voids an open, unpaid invoice with a stable idempotency key and records it', async () => {
    const r = await run();
    expect(r.status).toBe('succeeded');
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith('in_g', {}, { idempotencyKey: 'jobblo-subv2-test-grace-expiry-void:sub_g:in_g' });
    expect(inv.status).toBe('void');
    expect(voidOp()).toMatchObject({ status: 'succeeded', stripeInvoiceId: 'in_g', stripeSubscriptionId: 'sub_g' });
    expect(Subs.rows[0].recoveryHistory.at(-1)).toMatchObject({ action: 'renewal_invoice_voided', invoiceId: 'in_g' });
    // Prior audit history is kept.
    expect(Subs.rows[0].status).toBe('canceled');
  });

  test('re-reads the invoice immediately before voiding', async () => {
    await run();
    const lastRead = stripe.invoices.retrieve.mock.invocationCallOrder.at(-1);
    expect(lastRead).toBeLessThan(stripe.invoices.voidInvoice.mock.invocationCallOrder[0]);
  });

  test('never voids a paid invoice; the late-payment policy applies instead', async () => {
    inv.status = 'paid';
    inv.amount_paid = 9900;
    const r = await run();
    expect(r).toMatchObject({ status: 'failed', lastErrorCode: 'invoice_paid_before_void' });
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
    expect(Ops.rows.find((o) => o.operationId === 'invoice:in_g')).toMatchObject({ status: 'reconciliation_required', lastErrorCode: 'late_payment_after_grace' });
  });

  test('does not void while a payment is being processed, retries later, then hands to review', async () => {
    stripe.payments = [{ status: 'open', payment: { type: 'payment_intent', payment_intent: { status: 'processing' } } }];
    for (let i = 1; i <= 4; i++) {
      const r = await run();
      expect(r).toMatchObject({ status: 'pending', retry: true, lastErrorCode: 'payment_in_progress' });
    }
    expect(voidOp().attempts).toBe(4);
    await expect(run()).resolves.toMatchObject({ status: 'reconciliation_required', lastErrorCode: 'payment_in_progress' });
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  test('a void that loses to a payment is re-read and treated as paid', async () => {
    stripe.invoices.voidInvoice.mockImplementationOnce(async () => {
      inv.status = 'paid';
      throw Object.assign(new Error('This invoice is already paid'), { type: 'StripeInvalidRequestError', code: 'invoice_not_open' });
    });
    await expect(run()).resolves.toMatchObject({ status: 'failed', lastErrorCode: 'invoice_paid_before_void' });
    expect(Ops.rows.find((o) => o.operationId === 'invoice:in_g').status).toBe('reconciliation_required');
  });

  test.each([
    ['another subscription', () => { inv.parent.subscription_details.subscription = 'sub_other'; }],
    ['another customer', () => { inv.customer = 'cus_other'; }],
    ['the other Stripe mode', () => { inv.livemode = true; }],
    ['a different invoice id', () => { inv.id = 'in_other'; }],
    ['a non-renewal invoice', () => { inv.billing_reason = 'manual'; }],
  ])('never voids an invoice belonging to %s', async (_label, tamper) => {
    tamper();
    await expect(run()).resolves.toMatchObject({ status: 'reconciliation_required', lastErrorCode: 'void_invoice_unverified' });
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  test('refuses when the Stripe subscription is not this record\'s canceled subscription', async () => {
    stripe.sub.status = 'active';
    await expect(run()).resolves.toMatchObject({ lastErrorCode: 'void_subscription_unverified' });
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  test('refuses draft, uncollectible or partially paid invoices', async () => {
    inv.status = 'uncollectible';
    await expect(run()).resolves.toMatchObject({ lastErrorCode: 'void_invoice_not_open_uncollectible' });
    Ops = model([expiryOp()]);
    inv.status = 'open';
    inv.amount_paid = 100;
    await expect(run()).resolves.toMatchObject({ lastErrorCode: 'void_invoice_partially_paid' });
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  test('an already-void invoice completes idempotently without another void call', async () => {
    inv.status = 'void';
    await expect(run()).resolves.toMatchObject({ status: 'succeeded' });
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  test('repeated runs void once', async () => {
    await run();
    await expect(run()).resolves.toEqual({ skipped: 'already_succeeded' });
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledTimes(1);
  });

  test('a timeout leaves the operation pending; the retry reuses the SAME idempotency key', async () => {
    stripe.invoices.voidInvoice.mockRejectedValueOnce(Object.assign(new Error('timeout'), { type: 'StripeConnectionError', code: 'ETIMEDOUT' }));
    await expect(run()).resolves.toMatchObject({ status: 'pending', retry: true, lastErrorCode: 'ETIMEDOUT' });
    await expect(run({ start: false })).resolves.toMatchObject({ status: 'succeeded' });
    const keys = stripe.invoices.voidInvoice.mock.calls.map(([, , o]) => o.idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  test('a non-retryable Stripe error goes to manual review', async () => {
    stripe.invoices.voidInvoice.mockRejectedValueOnce(Object.assign(new Error('permission'), { type: 'StripePermissionError', code: 'permission_denied' }));
    await expect(run()).resolves.toMatchObject({ status: 'reconciliation_required', lastErrorCode: 'permission_denied' });
  });
});

describe('only confirmed grace-expiry cancellations qualify', () => {
  test.each([
    ['no grace-expiry operation', () => { Ops = model([]); }],
    ['grace-expiry not succeeded', () => { Ops = model([expiryOp({ status: 'reconciliation_required' })]); }],
    ['grace-expiry for another invoice', () => { Ops = model([expiryOp({ stripeInvoiceId: 'in_other' })]); }],
    ['record still in recovery', () => { Subs = model([exhaustedRecord({ paymentRecoveryStatus: 'retrying', status: 'past_due' })]); }],
    ['record recovered', () => { Subs = model([exhaustedRecord({ paymentRecoveryStatus: 'recovered', status: 'active' })]); }],
  ])('%s -> nothing happens', async (_label, setup) => {
    setup();
    const r = await run();
    expect(r.skipped).toBeDefined();
    expect(stripe.invoices.retrieve).not.toHaveBeenCalled();
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });

  test('a retry never starts a void operation that the worker did not create', async () => {
    await expect(run({ start: false })).resolves.toEqual({ skipped: 'no_void_operation' });
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
  });
});

describe('through the grace-expiry worker', () => {
  function retryingWorld() {
    Subs = model([exhaustedRecord({ status: 'past_due', paymentRecoveryStatus: 'retrying', recoveryLeaseUntil: null })]);
    Ops = model([]);
    stripe.sub.status = 'past_due';
  }
  const worker = (env = ON) => cancelExpiredRecoveries({
    env, now: () => now, SubscriptionModel: Subs, OperationModel: Ops, EmailModel: Emails, stripeForMode: async () => stripe,
  });

  test('the worker\'s own cancellation voids the invoice once; a second run does nothing more', async () => {
    retryingWorld();
    await worker();
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledTimes(1);
    expect(Subs.rows[0]).toMatchObject({ status: 'canceled', paymentRecoveryStatus: 'exhausted' });
    expect(voidOp().status).toBe('succeeded');
    await worker();
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledTimes(1);
  });

  test('with the gate off the worker cancels exactly as before and voids nothing', async () => {
    retryingWorld();
    await worker(OFF);
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
    expect(voidOp()).toBeUndefined();
    expect(Ops.rows.find((o) => o.operationId === 'invoice:in_g')).toBeUndefined(); // no invoice op existed
  });

  test('a subscription found already canceled (e.g. by the customer) is never voided', async () => {
    retryingWorld();
    stripe.sub.status = 'canceled';
    await worker();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(Subs.rows[0].paymentRecoveryStatus).toBe('exhausted');
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled();
    expect(voidOp()).toBeUndefined();
  });

  test('a void failure does not turn the completed cancellation into a reconciliation', async () => {
    retryingWorld();
    stripe.invoices.voidInvoice.mockRejectedValueOnce(Object.assign(new Error('timeout'), { type: 'StripeConnectionError', code: 'ETIMEDOUT' }));
    await worker();
    expect(Ops.rows.find((o) => o.operationId === 'grace-expiry:sub_g:in_g').status).toBe('succeeded');
    // The failed attempt was recorded, and the end-of-run sweep retried the pending void
    // with the same idempotency key.
    expect(voidOp()).toMatchObject({ status: 'succeeded', attempts: 1 });
    const keys = stripe.invoices.voidInvoice.mock.calls.map(([, , o]) => o.idempotencyKey);
    expect(keys).toEqual(['jobblo-subv2-test-grace-expiry-void:sub_g:in_g', 'jobblo-subv2-test-grace-expiry-void:sub_g:in_g']);
    await worker();
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledTimes(2);
  });
});
