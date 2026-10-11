const mockOperations = new Map();

jest.mock('../models/StripeFinancialOperation', () => ({
  findOne: jest.fn(({ operationKey }) => Promise.resolve(mockOperations.get(operationKey) || null)),
  create: jest.fn(async (operation) => {
    const saved = { _id: `op_${mockOperations.size + 1}`, ...operation };
    mockOperations.set(operation.operationKey, saved);
    return saved;
  }),
  updateOne: jest.fn(async ({ _id }, update) => {
    const operation = [...mockOperations.values()].find((candidate) => candidate._id === _id);
    Object.assign(operation, update.$set);
    return { modifiedCount: 1 };
  }),
}));

const {
  executeRefund,
  executeTransferReversal,
} = require('../services/stripe/financialOperations');

const details = {
  operationKey: 'dispute:one:refund:pi_test_1:1000',
  orderId: 'order_1',
  paymentId: 'payment_1',
  disputeId: 'dispute_1',
  stripeMode: 'test',
  paymentIntentId: 'pi_test_1',
  chargeId: 'ch_test_1',
  amount: 1000,
  currency: 'nok',
};

function stripeFixture({ refundCreate } = {}) {
  const refunds = [];
  return {
    refunds,
    stripe: {
      refunds: {
        list: jest.fn(async () => ({ data: [...refunds], has_more: false })),
        retrieve: jest.fn(async (id) => refunds.find((refund) => refund.id === id)),
        create: jest.fn(async (params, options) => {
          if (refundCreate) return refundCreate(params, options, refunds);
          const refund = {
            id: 're_test_1',
            amount: params.amount,
            currency: 'nok',
            payment_intent: params.payment_intent,
            status: 'succeeded',
            metadata: params.metadata,
          };
          refunds.push(refund);
          return refund;
        }),
      },
      charges: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'ch_test_1',
          payment_intent: 'pi_test_1',
          currency: 'nok',
          amount: 5000,
          amount_refunded: 0,
        }),
      },
    },
  };
}

beforeEach(() => mockOperations.clear());

describe('durable Stripe refund operations', () => {
  it('reuses the recorded Stripe idempotency key and does not refund twice', async () => {
    const { stripe } = stripeFixture();

    const first = await executeRefund(stripe, details);
    const retry = await executeRefund(stripe, details);

    expect(first.operation.idempotencyKey).toBe(retry.operation.idempotencyKey);
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
    expect(retry).toMatchObject({ status: 'succeeded', refund: { id: 're_test_1' } });
  });

  it('reconciles a Stripe timeout by operation metadata before retrying creation', async () => {
    const { stripe, refunds } = stripeFixture({
      refundCreate: async (params) => {
        refunds.push({
          id: 're_test_after_timeout',
          amount: params.amount,
          currency: 'nok',
          payment_intent: params.payment_intent,
          status: 'succeeded',
          metadata: params.metadata,
        });
        throw new Error('network outcome unknown');
      },
    });

    await expect(executeRefund(stripe, details)).rejects.toMatchObject({
      code: 'STRIPE_REFUND_RECONCILIATION_REQUIRED',
    });
    const recovered = await executeRefund(stripe, details);

    expect(recovered).toMatchObject({
      status: 'succeeded',
      refund: { id: 're_test_after_timeout' },
    });
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an operation key for a different amount', async () => {
    const { stripe } = stripeFixture();
    await executeRefund(stripe, details);

    await expect(executeRefund(stripe, { ...details, amount: 2000 })).rejects.toMatchObject({
      code: 'STRIPE_FINANCIAL_OPERATION_CONFLICT',
    });
  });

  it('blocks refunds that exceed the charge amount already available', async () => {
    const { stripe } = stripeFixture();
    await expect(executeRefund(stripe, { ...details, amount: 6000 })).rejects.toMatchObject({
      code: 'STRIPE_REFUND_EXCEEDS_REMAINING',
    });
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('executes and reuses an approved partial transfer reversal', async () => {
    const reversal = {
      id: 'trr_test_1',
      amount: 1000,
      currency: 'nok',
      transfer: 'tr_test_1',
      metadata: { jobbloOperationKey: 'dispute:one:reverse:1000' },
    };
    const stripe = {
      transfers: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'tr_test_1',
          amount: 5000,
          amount_reversed: 0,
          currency: 'nok',
          livemode: false,
        }),
        listReversals: jest.fn()
          .mockResolvedValueOnce({ data: [], has_more: false })
          .mockResolvedValue({ data: [reversal], has_more: false }),
        createReversal: jest.fn().mockResolvedValue(reversal),
      },
    };
    const reversalDetails = {
      operationKey: 'dispute:one:reverse:1000',
      orderId: 'order_1',
      paymentId: 'payment_1',
      disputeId: 'dispute_1',
      stripeMode: 'test',
      paymentIntentId: 'pi_test_1',
      chargeId: 'ch_test_1',
      transferId: 'tr_test_1',
      amount: 1000,
      currency: 'NOK',
    };

    const result = await executeTransferReversal(stripe, reversalDetails);
    await executeTransferReversal(stripe, reversalDetails);

    expect(result).toMatchObject({ status: 'succeeded', reversal: { id: 'trr_test_1' } });
    expect(stripe.transfers.createReversal).toHaveBeenCalledTimes(1);
    expect(stripe.transfers.createReversal).toHaveBeenCalledWith(
      'tr_test_1',
      expect.objectContaining({ amount: 1000 }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^jobblo_financial_/) })
    );
  });

  it('refuses to reverse more than the transfer amount still available', async () => {
    const stripe = {
      transfers: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'tr_test_1',
          amount: 5000,
          amount_reversed: 4500,
          currency: 'nok',
          livemode: false,
        }),
        listReversals: jest.fn().mockResolvedValue({ data: [], has_more: false }),
        createReversal: jest.fn(),
      },
    };
    await expect(executeTransferReversal(stripe, {
      operationKey: 'dispute:one:reverse:1000',
      orderId: 'order_1',
      stripeMode: 'test',
      paymentIntentId: 'pi_test_1',
      chargeId: 'ch_test_1',
      transferId: 'tr_test_1',
      amount: 1000,
      currency: 'NOK',
    })).rejects.toMatchObject({ code: 'STRIPE_REVERSAL_EXCEEDS_REMAINING' });
    expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
  });
});
