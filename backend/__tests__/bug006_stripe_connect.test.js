// Mock Stripe config module
jest.mock('../config/stripe', () => ({
  getStripe: jest.fn(),
}));

// Mock Models to prevent MongoDB connection attempts during unit tests
jest.mock('../models/Payout', () => {
  function MockPayout(data) {
    Object.assign(this, data);
    this.status = data.status || 'pending';
  }
  MockPayout.findOne = jest.fn();
  MockPayout.prototype.save = jest.fn().mockResolvedValue(true);
  MockPayout.prototype.transitionTo = jest.fn(function (nextStatus, extra) {
    this.status = nextStatus;
    if (extra) Object.assign(this, extra);
  });
  return MockPayout;
});

jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/Payment', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue(true),
}));

const { PUBLIC_USER_SELECT, sanitizeUserPublic } = require('../utils/userProjections');
const releasePayoutToProvider = require('../services/payout/releasePayoutToProvider');
const Payout = require('../models/Payout');
const User = require('../models/User');
const { getStripe } = require('../config/stripe');

describe('BUG-006: Stripe Connect & Sensitive Data Leak Prevention', () => {
  let mockStripe;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe = {
      transfers: {
        create: jest.fn(),
      },
    };
    getStripe.mockResolvedValue(mockStripe);
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
        })
      ).rejects.toThrow('PAYOUT_SETUP_REQUIRED');
    });

    it('should throw PAYOUT_NOT_ENABLED if provider Connect account is not enabled for payouts', async () => {
      const orderId = '507f1f77bcf86cd799439022';
      const providerId = '507f1f77bcf86cd799439023';

      Payout.findOne.mockResolvedValue(null);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: providerId,
          stripeConnectAccountId: 'acct_test123',
          payoutEnabled: false,
        }),
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
        })
      ).rejects.toThrow('PAYOUT_NOT_ENABLED');
    });

    it('should create Stripe transfer and mark payout transferred on success', async () => {
      const orderId = '507f1f77bcf86cd799439032';
      const providerId = '507f1f77bcf86cd799439033';

      Payout.findOne.mockResolvedValue(null);

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: providerId,
          stripeConnectAccountId: 'acct_test123',
          payoutEnabled: true,
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

    it('should be idempotent and return existing transferred Payout without re-transferring', async () => {
      const orderId = '507f1f77bcf86cd799439042';

      const existingPayout = {
        _id: '507f1f77bcf86cd799439099',
        orderId,
        status: 'transferred',
        stripeTransferId: 'tr_existing_123',
      };

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
      });

      expect(mockStripe.transfers.create).not.toHaveBeenCalled();
      expect(result.alreadyPaid).toBe(true);
      expect(result.payout.stripeTransferId).toBe('tr_existing_123');
    });
  });
});
