const mongoose = require('mongoose');
const Order = require('../models/Order');

/**
 * Regression guard for the SafePay payment-reconciliation fix.
 *
 * The Order schema was missing every field the SafePay controllers write. Mongoose
 * strict mode (the default) silently drops unknown paths, so:
 *   - `checkoutSessionId` never persisted  -> reconcilePayment always returned
 *     "no_session", leaving a captured Stripe payment unrecoverable;
 *   - `customerConfirmed` never persisted  -> the customer checklist did nothing;
 *   - `ready_for_review` was outside the status enum -> any later order.save()
 *     on such a document threw a ValidationError.
 *
 * These assertions fail if any of those paths are removed again. No DB needed:
 * strict-mode stripping happens at construction, enum checks at validateSync().
 */
function makeOrder(overrides = {}) {
  return new Order({
    serviceId: new mongoose.Types.ObjectId(),
    customerId: new mongoose.Types.ObjectId(),
    providerId: new mongoose.Types.ObjectId(),
    ...overrides,
  });
}

describe('Order schema — SafePay reconciliation fields', () => {
  it('accepts ready_for_review as a status', () => {
    const err = makeOrder({ status: 'ready_for_review' }).validateSync();
    expect(err).toBeUndefined();
  });

  it('still rejects a status outside the enum', () => {
    const err = makeOrder({ status: 'definitely_not_a_status' }).validateSync();
    expect(err?.errors?.status).toBeDefined();
  });

  it('persists the Stripe reconciliation fields instead of dropping them', () => {
    const now = new Date();
    const order = makeOrder({
      checkoutSessionId: 'cs_test_123',
      checkoutSessionStatus: 'open',
      checkoutSessionCreatedAt: now,
      paymentIntentId: 'pi_test_123',
      paymentConfirmedAt: now,
    });

    expect(order.checkoutSessionId).toBe('cs_test_123');
    expect(order.checkoutSessionStatus).toBe('open');
    expect(order.checkoutSessionCreatedAt).toEqual(now);
    expect(order.paymentIntentId).toBe('pi_test_123');
    expect(order.paymentConfirmedAt).toEqual(now);
  });

  it('persists the payment-confirmed Connect deadline and refund lifecycle state', () => {
    const confirmedAt = new Date('2025-01-01T00:00:00Z');
    const deadlineAt = new Date('2025-01-04T00:00:00Z');
    const order = makeOrder({
      paymentConfirmedAt: confirmedAt,
      providerConnectDeadlineDays: 3,
      providerConnectDeadlineAt: deadlineAt,
      providerConnectTimeout: {
        status: 'reconciliation_required',
        operationKey: 'safepay-connect-timeout:order:pi_test_1',
        stripeRefundId: 're_test_1',
        originalPaymentAmountMinor: 103000,
        refundedAmountMinor: 0,
        providerVerificationAt: confirmedAt,
      },
    });

    expect(order.providerConnectDeadlineDays).toBe(3);
    expect(order.providerConnectDeadlineAt).toEqual(deadlineAt);
    expect(order.providerConnectTimeout.providerVerificationAt).toEqual(confirmedAt);
    expect(order.providerConnectTimeout.originalPaymentAmountMinor).toBe(103000);
    expect(order.validateSync()).toBeUndefined();
  });

  it('persists the lifecycle timestamps written by providerWorkController', () => {
    const now = new Date();
    const order = makeOrder({
      startedAt: now,
      readyForReviewAt: now,
      completedAt: now,
      completionNote: 'Ferdig',
    });

    expect(order.startedAt).toEqual(now);
    expect(order.readyForReviewAt).toEqual(now);
    expect(order.completedAt).toEqual(now);
    expect(order.completionNote).toBe('Ferdig');
  });

  it('persists both sides of a checklist item confirmation', () => {
    const userId = new mongoose.Types.ObjectId();
    const order = makeOrder({
      checklist: [
        {
          id: 'item-1',
          text: 'Male veggen',
          providerCompleted: true,
          providerCompletedBy: userId,
          providerCompletedAt: new Date(),
          customerConfirmed: true,
          customerConfirmedBy: userId,
          customerConfirmedAt: new Date(),
        },
      ],
    });

    const item = order.checklist[0];
    expect(item.providerCompleted).toBe(true);
    expect(String(item.providerCompletedBy)).toBe(String(userId));
    expect(item.customerConfirmed).toBe(true);
    expect(String(item.customerConfirmedBy)).toBe(String(userId));
  });
});
