const crypto = require('crypto');
const StripeFinancialOperation = require('../../models/StripeFinancialOperation');

const STRIPE_IDEMPOTENCY_SAFE_MS = 23 * 60 * 60 * 1000;
const idOf = (value) => (typeof value === 'string' ? value : value?.id || null);

function operationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getOperation(details) {
  if (
    !details.operationKey ||
    !['test', 'live'].includes(details.stripeMode) ||
    !Number.isSafeInteger(details.amount) ||
    details.amount <= 0 ||
    !/^[A-Za-z]{3}$/.test(String(details.currency || ''))
  ) {
    throw operationError('STRIPE_FINANCIAL_OPERATION_INVALID', 'Financial operation details are invalid.');
  }
  let operation = await StripeFinancialOperation.findOne({ operationKey: details.operationKey });
  if (operation) {
    assertSameOperation(operation, details);
    return operation;
  }
  const operationId = crypto.randomUUID();
  try {
    return await StripeFinancialOperation.create({
      ...details,
      currency: String(details.currency).toUpperCase(),
      idempotencyKey: `jobblo_financial_${operationId}`,
      status: 'pending',
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    operation = await StripeFinancialOperation.findOne({ operationKey: details.operationKey });
    if (operation) {
      assertSameOperation(operation, details);
      return operation;
    }
    throw error;
  }
}

function assertSameOperation(operation, details) {
  const fields = [
    'type',
    'orderId',
    'paymentId',
    'disputeId',
    'incidentId',
    'stripeMode',
    'paymentIntentId',
    'chargeId',
    'transferId',
    'amount',
  ];
  if (fields.some((field) => {
    const existing = operation[field] == null ? null : String(operation[field]);
    const incoming = details[field] == null ? null : String(details[field]);
    return existing !== incoming;
  }) || String(operation.currency).toUpperCase() !== String(details.currency).toUpperCase()) {
    throw operationError('STRIPE_FINANCIAL_OPERATION_CONFLICT', 'A financial operation key was reused with different payment details.');
  }
}

async function updateOperation(operation, status, fields = {}) {
  await StripeFinancialOperation.updateOne(
    { _id: operation._id },
    {
      $set: {
        status,
        ...fields,
      },
    }
  );
  Object.assign(operation, { status, ...fields });
}

function validateFinancialObject(object, operation, { expectedTransferId } = {}) {
  const objectAmount = object?.amount;
  const objectCurrency = String(object?.currency || '').toUpperCase();
  const linkedIntent = idOf(object?.payment_intent);
  const linkedCharge = idOf(object?.charge);
  const linkedTransfer = idOf(object?.transfer);
  if (
    objectAmount !== operation.amount ||
    objectCurrency !== operation.currency ||
    (operation.paymentIntentId && linkedIntent && linkedIntent !== operation.paymentIntentId) ||
    (operation.chargeId && linkedCharge && linkedCharge !== operation.chargeId) ||
    (expectedTransferId && linkedTransfer && linkedTransfer !== expectedTransferId)
  ) {
    throw operationError('STRIPE_FINANCIAL_OBJECT_MISMATCH', 'Stripe financial operation did not match its authorized amount or source.');
  }
}

async function findExistingRefund(stripe, operation) {
  if (operation.stripeObjectId) {
    return stripe.refunds.retrieve(operation.stripeObjectId);
  }
  let startingAfter;
  do {
    const page = await stripe.refunds.list({
      payment_intent: operation.paymentIntentId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = (page.data || []).find(
      (refund) => refund.metadata?.jobbloOperationKey === operation.operationKey
    );
    if (match) return match;
    startingAfter = page.has_more ? page.data?.[page.data.length - 1]?.id : null;
    if (page.has_more && !startingAfter) {
      throw operationError('STRIPE_REFUND_RECONCILIATION_REQUIRED', 'Stripe refund history pagination was incomplete.');
    }
  } while (startingAfter);
  return null;
}

async function getCommittedRefundAmount(stripe, chargeId) {
  let startingAfter;
  let total = 0;
  do {
    const page = await stripe.refunds.list({
      charge: chargeId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const refund of page.data || []) {
      if (['succeeded', 'pending'].includes(refund.status)) {
        if (!Number.isSafeInteger(refund.amount) || refund.amount < 0) {
          throw operationError('STRIPE_REFUND_RECONCILIATION_REQUIRED', 'Stripe refund history contained an invalid amount.');
        }
        total += refund.amount;
        if (!Number.isSafeInteger(total)) {
          throw operationError('STRIPE_REFUND_RECONCILIATION_REQUIRED', 'Stripe refund history amount exceeded safe accounting bounds.');
        }
      }
    }
    startingAfter = page.has_more ? page.data?.[page.data.length - 1]?.id : null;
    if (page.has_more && !startingAfter) {
      throw operationError('STRIPE_REFUND_RECONCILIATION_REQUIRED', 'Stripe refund history pagination was incomplete.');
    }
  } while (startingAfter);
  return total;
}

function refundStatus(status) {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'pending') return 'pending';
  if (status === 'failed' || status === 'canceled') return 'failed';
  throw operationError('STRIPE_REFUND_STATUS_UNKNOWN', 'Stripe refund has an unsupported status.');
}

async function executeRefund(stripe, details) {
  const operation = await getOperation({ ...details, type: 'refund' });
  if (operation.status === 'failed') {
    throw operationError('STRIPE_REFUND_FAILED', 'The recorded refund failed; an administrator must authorize a new refund attempt.');
  }
  if (operation.status === 'succeeded') {
    const refund = await findExistingRefund(stripe, operation);
    if (!refund || refund.status !== 'succeeded') {
      await updateOperation(operation, 'reconciliation_required');
      throw operationError('STRIPE_REFUND_RECONCILIATION_REQUIRED', 'The recorded refund could not be verified in Stripe.');
    }
    validateFinancialObject(refund, operation);
    return { operation, refund, status: 'succeeded' };
  }

  let refund = await findExistingRefund(stripe, operation);
  if (!refund) {
    if (
      operation.attemptedAt &&
      Date.now() - new Date(operation.attemptedAt).getTime() >= STRIPE_IDEMPOTENCY_SAFE_MS
    ) {
      await updateOperation(operation, 'reconciliation_required');
      throw operationError('STRIPE_REFUND_RECONCILIATION_REQUIRED', 'Refund outcome is too old for a safe automatic retry.');
    }
    const attemptedAt = new Date();
    if (details.chargeId) {
      const charge = await stripe.charges.retrieve(details.chargeId);
      if (
        charge.id !== details.chargeId ||
        idOf(charge.payment_intent) !== operation.paymentIntentId ||
        String(charge.currency || '').toUpperCase() !== operation.currency ||
        !Number.isSafeInteger(charge.amount) ||
        !Number.isSafeInteger(charge.amount_refunded) ||
        charge.amount < 0 ||
        charge.amount_refunded < 0 ||
        charge.amount_refunded > charge.amount
      ) {
        throw operationError('STRIPE_REFUND_SOURCE_MISMATCH', 'Original Stripe charge could not be verified for refund.');
      }
      const alreadyCommitted = Math.max(
        charge.amount_refunded,
        await getCommittedRefundAmount(stripe, details.chargeId)
      );
      if (alreadyCommitted + operation.amount > charge.amount) {
        await updateOperation(operation, 'failed', {
          lastErrorCode: 'refund_exceeds_unrefunded_charge',
        });
        throw operationError('STRIPE_REFUND_EXCEEDS_REMAINING', 'Refund exceeds the remaining captured amount.');
      }
    }
    await updateOperation(operation, 'reconciliation_required', { attemptedAt, lastErrorCode: null });
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: operation.paymentIntentId,
          amount: operation.amount,
          metadata: {
            jobbloOperationKey: operation.operationKey,
            ...(operation.disputeId ? { disputeId: String(operation.disputeId) } : {}),
            ...(operation.incidentId ? { incidentId: String(operation.incidentId) } : {}),
          },
        },
        { idempotencyKey: operation.idempotencyKey }
      );
    } catch (error) {
      await updateOperation(operation, 'reconciliation_required', {
        lastErrorCode: error?.code || error?.type || 'stripe_refund_outcome_unknown',
      });
      throw operationError('STRIPE_REFUND_RECONCILIATION_REQUIRED', 'Refund outcome is unknown; reconcile it in Stripe before retrying.');
    }
  }
  validateFinancialObject(refund, operation);
  const status = refundStatus(refund.status);
  await updateOperation(operation, status, {
    stripeObjectId: refund.id,
    lastErrorCode: status === 'failed' ? 'stripe_refund_failed' : null,
  });
  return { operation, refund, status };
}

async function findExistingReversal(stripe, operation) {
  if (typeof stripe.transfers.listReversals !== 'function') return null;
  let startingAfter;
  do {
    const page = await stripe.transfers.listReversals(operation.transferId, {
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = (page.data || []).find(
      (reversal) => reversal.metadata?.jobbloOperationKey === operation.operationKey
    );
    if (match) return match;
    startingAfter = page.has_more ? page.data?.[page.data.length - 1]?.id : null;
    if (page.has_more && !startingAfter) {
      throw operationError('STRIPE_REVERSAL_RECONCILIATION_REQUIRED', 'Stripe transfer reversal history pagination was incomplete.');
    }
  } while (startingAfter);
  return null;
}

async function executeTransferReversal(stripe, details) {
  const operation = await getOperation({ ...details, type: 'transfer_reversal' });
  if (operation.status === 'failed') {
    throw operationError('STRIPE_REVERSAL_FAILED', 'The recorded transfer reversal failed and requires administrator review.');
  }
  const transfer = await stripe.transfers.retrieve(operation.transferId);
  if (
    transfer.id !== operation.transferId ||
    transfer.livemode !== (operation.stripeMode === 'live') ||
    String(transfer.currency || '').toUpperCase() !== operation.currency
  ) {
    throw operationError('STRIPE_TRANSFER_MISMATCH', 'The Stripe transfer does not match the approved recovery operation.');
  }

  let reversal = operation.stripeObjectId
    ? (await findExistingReversal(stripe, operation))
    : await findExistingReversal(stripe, operation);
  if (reversal) {
    validateFinancialObject(reversal, operation, { expectedTransferId: operation.transferId });
    await updateOperation(operation, 'succeeded', { stripeObjectId: reversal.id, lastErrorCode: null });
    return { operation, reversal, status: 'succeeded' };
  }
  if (operation.status === 'succeeded') {
    await updateOperation(operation, 'reconciliation_required');
    throw operationError('STRIPE_REVERSAL_RECONCILIATION_REQUIRED', 'The transfer reversal could not be verified in Stripe.');
  }
  if (
    operation.attemptedAt &&
    Date.now() - new Date(operation.attemptedAt).getTime() >= STRIPE_IDEMPOTENCY_SAFE_MS
  ) {
    await updateOperation(operation, 'reconciliation_required');
    throw operationError('STRIPE_REVERSAL_RECONCILIATION_REQUIRED', 'Reversal outcome is too old for a safe automatic retry.');
  }

  const reversedAmount = transfer.amount_reversed === undefined ? 0 : transfer.amount_reversed;
  const remaining = transfer.amount - reversedAmount;
  if (
    !Number.isSafeInteger(transfer.amount) ||
    !Number.isSafeInteger(reversedAmount) ||
    transfer.amount < 0 ||
    reversedAmount < 0 ||
    reversedAmount > transfer.amount ||
    !Number.isSafeInteger(remaining) ||
    remaining < operation.amount
  ) {
    await updateOperation(operation, 'failed', { lastErrorCode: 'transfer_reversal_exceeds_remaining' });
    throw operationError('STRIPE_REVERSAL_EXCEEDS_REMAINING', 'Approved reversal exceeds the transfer amount still available.');
  }
  if (typeof stripe.transfers.createReversal !== 'function') {
    await updateOperation(operation, 'reconciliation_required', { lastErrorCode: 'reversal_api_unavailable' });
    throw operationError('STRIPE_REVERSAL_UNAVAILABLE', 'Stripe transfer reversal is unavailable; administrator review is required.');
  }

  await updateOperation(operation, 'reconciliation_required', { attemptedAt: new Date(), lastErrorCode: null });
  try {
    reversal = await stripe.transfers.createReversal(
      operation.transferId,
      {
        amount: operation.amount,
        metadata: {
          jobbloOperationKey: operation.operationKey,
          ...(operation.disputeId ? { disputeId: String(operation.disputeId) } : {}),
        },
      },
      { idempotencyKey: operation.idempotencyKey }
    );
  } catch (error) {
    const definitiveFailure =
      error?.code === 'balance_insufficient' ||
      error?.code === 'insufficient_funds' ||
      error?.code === 'amount_too_large';
    await updateOperation(operation, 'reconciliation_required', {
      lastErrorCode: error?.code || error?.type || 'stripe_reversal_outcome_unknown',
    });
    if (definitiveFailure) {
      await updateOperation(operation, 'failed', {
        lastErrorCode: error.code,
      });
      throw operationError('STRIPE_REVERSAL_FAILED', 'Stripe could not recover the approved transfer amount; administrator review is required.');
    }
    throw operationError('STRIPE_REVERSAL_RECONCILIATION_REQUIRED', 'Transfer reversal outcome is unknown; reconcile it in Stripe before retrying.');
  }
  validateFinancialObject(reversal, operation, { expectedTransferId: operation.transferId });
  await updateOperation(operation, 'succeeded', { stripeObjectId: reversal.id, lastErrorCode: null });
  return { operation, reversal, status: 'succeeded' };
}

module.exports = { executeRefund, executeTransferReversal, operationError };
