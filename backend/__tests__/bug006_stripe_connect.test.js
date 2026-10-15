// Mock Stripe config module
jest.mock('../config/stripe', () => ({
  getStripe: jest.fn(),
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/stripe/financialHistory', () => ({
  recordStripeTransfer: jest.fn().mockResolvedValue({}),
}));

// Mock Models to prevent MongoDB connection attempts during unit tests
jest.mock('../models/Payout', () => {
  function MockPayout(data) {
    Object.assign(this, data);
    this.status = data.status || 'pending';
  }
  MockPayout.findOne = jest.fn();
  MockPayout.findOneAndUpdate = jest.fn().mockImplementation((query, update, opts) => ({
    _id: 'payout_mock_123',
    ...query,
    ...update.$set,
    status: 'processing',
    save: jest.fn().mockResolvedValue(true),
    transitionTo: jest.fn(function (nextStatus, extra) {
      this.status = nextStatus;
      if (extra) Object.assign(this, extra);
    }),
  }));
  MockPayout.updateOne = jest.fn().mockResolvedValue({ n: 1 });
  MockPayout.prototype.save = jest.fn().mockResolvedValue(true);
  MockPayout.prototype.transitionTo = jest.fn(function (nextStatus, extra) {
    this.status = nextStatus;
    if (extra) Object.assign(this, extra);
  });
  return MockPayout;
});

jest.mock('../models/Dispute', () => ({
  findOne: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
  }),
  findById: jest.fn(),
}));
jest.mock('../models/StripePaymentIncident', () => ({
  findOne: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  }),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/Order', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn().mockResolvedValue(true),
}));

jest.mock('../models/Payment', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn().mockResolvedValue(true),
}));

const { PUBLIC_USER_SELECT, sanitizeUserPublic } = require('../utils/userProjections');
const releasePayoutToProvider = require('../services/payout/releasePayoutToProvider');
const Payout = require('../models/Payout');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Dispute = require('../models/Dispute');
const { getStripe, getStripeConfiguration, getStripeForMode } = require('../config/stripe');

describe('BUG-006: Stripe Connect & Sensitive Data Leak Prevention', () => {
  let mockStripe;
  const buildOrder = ({
    orderId,
    providerId,
    customerId,
    serviceId,
    status = 'ready_for_review',
    checkoutMode = 'test',
  }) => ({
    _id: orderId,
    providerId,
    customerId,
    serviceId,
    status,
    paymentStatus: 'paid',
    agreedPrice: 1000,
    checkoutSessionId: 'cs_test_123',
    checkoutMode,
    checkoutCustomerId: 'cus_test_123',
    checkoutAmountMinor: 97000,
    checkoutCurrency: 'nok',
    paymentIntentId: 'pi_test_123',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe = {
      transfers: {
        create: jest.fn(),
      },
      checkout: {
        sessions: {
          retrieve: jest.fn().mockResolvedValue({
            id: 'cs_test_123',
            livemode: false,
            mode: 'payment',
            status: 'complete',
            payment_status: 'paid',
            amount_total: 97000,
            currency: 'nok',
            metadata: { orderId: '507f1f77bcf86cd799439012', userId: '507f1f77bcf86cd799439014' },
            customer: 'cus_test_123',
            payment_intent: 'pi_test_123',
          }),
        },
      },
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'pi_test_123',
          status: 'succeeded',
          amount_received: 97000,
          currency: 'nok',
          customer: 'cus_test_123',
          latest_charge: 'ch_test_123',
        }),
      },
      charges: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'ch_test_123',
          paid: true,
          captured: true,
          amount: 97000,
          currency: 'nok',
          payment_intent: 'pi_test_123',
          customer: 'cus_test_123',
          amount_refunded: 0,
          disputed: false,
        }),
      },
      accounts: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'acct_test123',
          deleted: false,
          payouts_enabled: true,
          capabilities: { transfers: 'active' },
        }),
      },
    };
    getStripe.mockResolvedValue(mockStripe);
    getStripeConfiguration.mockResolvedValue({
      testMode: true,
      mode: 'test',
    });
    getStripeForMode.mockResolvedValue(mockStripe);
    Order.findById.mockReset();
    Payment.findOne.mockReset();
  });

  describe('1. Sensitive Data Leakage Prevention', () => {
    it('PUBLIC_USER_SELECT must not include bankAccountNumber, iban, bicSwift, or vippsHandle', () => {
      const selectFields = PUBLIC_USER_SELECT.split(' ');
      expect(selectFields).not.toContain('bankAccountNumber');
      expect(selectFields).not.toContain('iban');
      expect(selectFields).not.toContain('bicSwift');
      expect(selectFields).not.toContain('vippsHandle');
      expect(selectFields).not.toContain('password');
    });

    it('sanitizeUserPublic must strip sensitive payout fields', () => {
      const leakedUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John',
        email: 'john@example.com',
        bankAccountNumber: '12345678901',
        iban: 'NO12345678901',
        bicSwift: 'DNBANOKK',
        vippsHandle: '90000000',
        password: 'secret_hash',
      };

      const sanitized = sanitizeUserPublic(leakedUser);
      expect(sanitized.bankAccountNumber).toBeUndefined();
      expect(sanitized.iban).toBeUndefined();
      expect(sanitized.bicSwift).toBeUndefined();
      expect(sanitized.vippsHandle).toBeUndefined();
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.name).toBe('John');
    });
  });

  describe('2. Provider Payout Validation & Release', () => {
    it('should throw PAYOUT_SETUP_REQUIRED if provider has no stripeConnectAccountId', async () => {
      const orderId = '507f1f77bcf86cd799439012';
      const providerId = '507f1f77bcf86cd799439013';

      Order.findById.mockReturnValue({
        lean: () => buildOrder({ orderId, providerId, customerId: '507f1f77bcf86cd799439014', serviceId: '507f1f77bcf86cd799439015' }),
      });
      Payment.findOne.mockReturnValue({
        lean: () => ({ status: 'completed', stripeSessionId: 'cs_test_123', stripePaymentIntentId: 'pi_test_123', stripeLivemode: false }),
      });
      Payout.findOne.mockResolvedValue(null);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: providerId,
          stripeConnectAccountId: null,
          payoutEnabled: false,
        }),
      });

      await expect(
        releasePayoutToProvider({
          orderId,
          providerId,
          customerId: '507f1f77bcf86cd799439014',
          serviceId: '507f1f77bcf86cd799439015',
          grossAmount: 1000,
          platformFee: 30,
          releaseSource: 'customer_approve',
          releasedBy: '507f1f77bcf86cd799439014',
          stripeCheckoutSessionId: 'cs_test_123',
          stripePaymentIntentId: 'pi_test_123',
        })
      ).rejects.toThrow('PAYOUT_SETUP_REQUIRED');
    });

    it('uses the selected Stripe account as payout readiness authority, not the shared cached flag', async () => {
      const orderId = '507f1f77bcf86cd799439022';
      const providerId = '507f1f77bcf86cd799439023';

      Order.findById.mockReturnValue({
        lean: () => buildOrder({ orderId, providerId, customerId: '507f1f77bcf86cd799439024', serviceId: '507f1f77bcf86cd799439025' }),
      });
      Payment.findOne.mockReturnValue({
        lean: () => ({ status: 'completed', stripeSessionId: 'cs_test_123', stripePaymentIntentId: 'pi_test_123', stripeLivemode: false }),
      });
      Payout.findOne.mockResolvedValue(null);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: providerId,
          stripeConnectAccountIdTest: 'acct_test123',
          payoutEnabled: false,
        }),
      });
      mockStripe.accounts.retrieve.mockResolvedValueOnce({
        id: 'acct_test123',
        deleted: false,
        payouts_enabled: false,
        capabilities: { transfers: 'active' },
      });

      await expect(
        releasePayoutToProvider({
          orderId,
          providerId,
          customerId: '507f1f77bcf86cd799439024',
          serviceId: '507f1f77bcf86cd799439025',
          grossAmount: 1000,
          platformFee: 30,
          releaseSource: 'customer_approve',
          releasedBy: '507f1f77bcf86cd799439024',
          stripeCheckoutSessionId: 'cs_test_123',
          stripePaymentIntentId: 'pi_test_123',
        })
      ).rejects.toMatchObject({ code: 'PAYOUT_CONNECT_ACCOUNT_UNVERIFIED' });
      expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith('acct_test123');
      expect(mockStripe.transfers.create).not.toHaveBeenCalled();
    });

    it('should create Stripe transfer and mark payout transferred on success', async () => {
      const orderId = '507f1f77bcf86cd799439032';
      const providerId = '507f1f77bcf86cd799439033';

      Order.findById.mockReturnValue({
        lean: () => buildOrder({ orderId, providerId, customerId: '507f1f77bcf86cd799439034', serviceId: '507f1f77bcf86cd799439035' }),
      });
      Payment.findOne.mockReturnValue({
        lean: () => ({ status: 'completed', stripeSessionId: 'cs_test_123', stripePaymentIntentId: 'pi_test_123', stripeLivemode: false }),
      });
      Payout.findOne.mockResolvedValue(null);

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: providerId,
          stripeConnectAccountIdTest: 'acct_test123',
          payoutEnabled: false,
        }),
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: 'tr_test_9999',
        amount: 97000,
        currency: 'nok',
      });

      const result = await releasePayoutToProvider({
        orderId,
        providerId,
        customerId: '507f1f77bcf86cd799439034',
        serviceId: '507f1f77bcf86cd799439035',
        grossAmount: 1000,
        platformFee: 30,
        releaseSource: 'customer_approve',
        releasedBy: '507f1f77bcf86cd799439034',
        stripeCheckoutSessionId: 'cs_test_123',
        stripePaymentIntentId: 'pi_test_123',
      });

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 97000,
          currency: 'nok',
          destination: 'acct_test123',
        }),
        expect.objectContaining({
          idempotencyKey: `transfer_payout_order_${orderId}`,
        })
      );

      expect(result.alreadyPaid).toBe(false);
      expect(result.transfer.id).toBe('tr_test_9999');
    });

    it('selects the isolated live Connect account when live mode is active', async () => {
      const orderId = '507f1f77bcf86cd799439052';
      const providerId = '507f1f77bcf86cd799439053';
      getStripeConfiguration.mockResolvedValue({ testMode: false, mode: 'live' });
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_123',
        livemode: true,
        mode: 'payment',
        status: 'complete',
        payment_status: 'paid',
        amount_total: 97000,
        currency: 'nok',
        metadata: { orderId, userId: '507f1f77bcf86cd799439054' },
        customer: 'cus_test_123',
        payment_intent: 'pi_test_123',
      });
      Order.findById.mockReturnValue({
        lean: () => buildOrder({ orderId, providerId, customerId: '507f1f77bcf86cd799439054', serviceId: '507f1f77bcf86cd799439055', checkoutMode: 'live' }),
      });
      Payment.findOne.mockReturnValue({
        lean: () => ({ status: 'completed', stripeSessionId: 'cs_test_123', stripePaymentIntentId: 'pi_test_123', stripeLivemode: true }),
      });
      Payout.findOne.mockResolvedValue(null);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: providerId,
          stripeConnectAccountId: 'acct_live_123',
          payoutEnabled: true,
        }),
      });
      mockStripe.accounts.retrieve.mockResolvedValue({
        id: 'acct_live_123',
        deleted: false,
        payouts_enabled: true,
        capabilities: { transfers: 'active' },
      });
      mockStripe.transfers.create.mockResolvedValue({ id: 'tr_live_9999', amount: 97000, currency: 'nok' });

      await releasePayoutToProvider({
        orderId,
        providerId,
        customerId: '507f1f77bcf86cd799439054',
        serviceId: '507f1f77bcf86cd799439055',
        grossAmount: 1000,
        platformFee: 30,
        releaseSource: 'customer_approve',
        releasedBy: '507f1f77bcf86cd799439054',
        stripeCheckoutSessionId: 'cs_test_123',
        stripePaymentIntentId: 'pi_test_123',
      });

      expect(getStripeForMode).toHaveBeenCalledWith(false);
      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({ destination: 'acct_live_123' }),
        expect.any(Object)
      );
    });

    it('should be idempotent and return existing transferred Payout without re-transferring', async () => {
      const orderId = '507f1f77bcf86cd799439042';

      const existingPayout = {
        _id: '507f1f77bcf86cd799439099',
        orderId,
        status: 'transferred',
        stripeTransferId: 'tr_existing_123',
      };

      Order.findById.mockReturnValue({
        lean: () => buildOrder({ orderId, providerId: '507f1f77bcf86cd799439043', customerId: '507f1f77bcf86cd799439044', serviceId: '507f1f77bcf86cd799439045' }),
      });
      Payment.findOne.mockReturnValue({
        lean: () => ({ status: 'completed', stripeSessionId: 'cs_test_123', stripePaymentIntentId: 'pi_test_123', stripeLivemode: false }),
      });
      Payout.findOne.mockResolvedValue(existingPayout);

      const result = await releasePayoutToProvider({
        orderId,
        providerId: '507f1f77bcf86cd799439043',
        customerId: '507f1f77bcf86cd799439044',
        serviceId: '507f1f77bcf86cd799439045',
        grossAmount: 1000,
        platformFee: 30,
        releaseSource: 'legacy_complete',
        releasedBy: '507f1f77bcf86cd799439044',
        stripeCheckoutSessionId: 'cs_test_123',
        stripePaymentIntentId: 'pi_test_123',
      });

      expect(mockStripe.transfers.create).not.toHaveBeenCalled();
      expect(result.alreadyPaid).toBe(true);
      expect(result.payout.stripeTransferId).toBe('tr_existing_123');
    });

    it('reconciles an unknown transfer before account checks and never creates another transfer', async () => {
      const orderId = '507f1f77bcf86cd799439062';
      const providerId = '507f1f77bcf86cd799439063';
      const payout = {
        _id: '507f1f77bcf86cd799439064',
        orderId,
        status: 'reconciliation_required',
        stripeLivemode: false,
        stripeConnectAccountId: 'acct_test123',
        stripePaymentIntentId: 'pi_test_123',
        lastAttemptedAt: new Date(Date.now() - 10 * 60 * 1000),
        save: jest.fn().mockResolvedValue(true),
      };
      const transfer = {
        id: 'tr_recovered_1',
        destination: 'acct_test123',
        source_transaction: 'ch_test_123',
        amount: 97000,
        currency: 'nok',
        livemode: false,
        metadata: { payoutId: payout._id },
      };
      Order.findById.mockReturnValue({
        lean: () => buildOrder({
          orderId,
          providerId,
          customerId: '507f1f77bcf86cd799439014',
          serviceId: '507f1f77bcf86cd799439015',
        }),
      });
      Payment.findOne.mockReturnValue({
        lean: () => ({
          status: 'completed',
          stripeSessionId: 'cs_test_123',
          stripePaymentIntentId: 'pi_test_123',
          stripeLivemode: false,
        }),
      });
      Payout.findOne.mockResolvedValue(payout);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: providerId,
          stripeConnectAccountIdTest: 'acct_test123',
          payoutEnabled: true,
        }),
      });
      mockStripe.transfers.list = jest.fn().mockResolvedValue({ data: [transfer], has_more: false });

      const result = await releasePayoutToProvider({
        orderId,
        providerId,
        customerId: '507f1f77bcf86cd799439014',
        serviceId: '507f1f77bcf86cd799439015',
        grossAmount: 1000,
        platformFee: 30,
        releaseSource: 'customer_approve',
        releasedBy: '507f1f77bcf86cd799439014',
        stripeCheckoutSessionId: 'cs_test_123',
        stripePaymentIntentId: 'pi_test_123',
      });

      expect(result).toMatchObject({
        reconciled: true,
        transfer: { id: 'tr_recovered_1' },
        payout: { status: 'transferred', stripeTransferId: 'tr_recovered_1' },
      });
      expect(mockStripe.transfers.list).toHaveBeenCalledTimes(1);
      expect(mockStripe.accounts.retrieve).not.toHaveBeenCalled();
      expect(mockStripe.transfers.create).not.toHaveBeenCalled();
    });
  });
});
