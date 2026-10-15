jest.mock('../models/StripeTransferRecord', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../models/StripeBankPayoutRecord', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../models/StripeFinancialSyncState', () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../models/Payout', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../models/User', () => ({
  findOne: jest.fn(),
}));

const TransferRecord = require('../models/StripeTransferRecord');
const BankPayoutRecord = require('../models/StripeBankPayoutRecord');
const SyncState = require('../models/StripeFinancialSyncState');
const Payout = require('../models/Payout');
const User = require('../models/User');
const {
  recordStripeTransfer,
  recordStripeBankPayout,
  syncTransfersPage,
  syncBankPayoutsPage,
} = require('../services/stripe/financialHistory');

function queryResult(value) {
  return { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(value) };
}

function storedRecord(value = { _id: 'record_1' }) {
  return { toObject: () => value };
}

beforeEach(() => {
  jest.clearAllMocks();
  Payout.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
  User.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'provider_1' }) }),
  });
  TransferRecord.findOne.mockReturnValue(queryResult(null));
  BankPayoutRecord.findOne.mockReturnValue(queryResult(null));
  TransferRecord.findOneAndUpdate.mockResolvedValue(storedRecord());
  BankPayoutRecord.findOneAndUpdate.mockResolvedValue(storedRecord());
});

describe('Stripe financial history webhook records', () => {
  it.each([
    [{ amount: 1000, amount_reversed: 0, reversed: false }, 'transferred'],
    [{ amount: 1000, amount_reversed: 250, reversed: false }, 'partially_reversed'],
    [{ amount: 1000, amount_reversed: 1000, reversed: true }, 'fully_reversed'],
  ])('derives transfer status from Stripe reversal data', async (overrides, status) => {
    await recordStripeTransfer({
      id: 'tr_1',
      amount: 1000,
      currency: 'nok',
      destination: 'acct_test_1',
      ...overrides,
    }, { livemode: false });

    expect(TransferRecord.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeObjectId: 'tr_1', stripeAccountId: 'acct_test_1', livemode: false }),
      expect.objectContaining({ $set: expect.objectContaining({ normalizedStatus: status, currency: 'NOK' }) }),
      expect.any(Object)
    );
  });

  it('rejects a local transfer whose account or mode does not match the Stripe event', async () => {
    Payout.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({
      _id: 'payout_1',
      stripeConnectAccountId: 'acct_live_1',
      stripeLivemode: true,
    }) });

    await expect(recordStripeTransfer({
      id: 'tr_wrong',
      amount: 1000,
      currency: 'nok',
      destination: 'acct_test_1',
    }, { livemode: false })).rejects.toThrow('destination does not match');
    expect(TransferRecord.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each(['pending', 'in_transit', 'paid', 'failed', 'canceled'])(
    'records connected-account bank payout status %s without exposing bank details',
    async (status) => {
      await recordStripeBankPayout({
        id: 'po_1',
        amount: 12345,
        currency: 'nok',
        status,
        type: 'automatic',
        destination: { last4: '1234', bank_name: 'Example Bank', account_number: 'secret' },
        failure_code: status === 'failed' ? 'account_closed' : null,
      }, { stripeAccountId: 'acct_test_1', livemode: false });

      const update = BankPayoutRecord.findOneAndUpdate.mock.calls[0][1].$set;
      expect(update).toEqual(expect.objectContaining({
        status,
        currency: 'NOK',
        destinationLast4: '1234',
        destinationBankName: 'Example Bank',
      }));
      expect(JSON.stringify(update)).not.toContain('secret');
      if (status === 'failed') expect(update.failureMessage).not.toContain('account_closed');
    }
  );

  it('rejects unsupported payout status and ignores older events', async () => {
    await expect(recordStripeBankPayout({
      id: 'po_bad', amount: 1, currency: 'nok', status: 'unknown',
    }, { stripeAccountId: 'acct_test_1', livemode: false })).rejects.toThrow('unsupported status');

    const latest = { _id: 'record_1', lastEventCreatedAt: new Date(2000) };
    TransferRecord.findOne.mockReturnValue(queryResult(latest));
    TransferRecord.findById.mockReturnValue(queryResult(latest));
    const result = await recordStripeTransfer({
      id: 'tr_1', amount: 1000, currency: 'nok', destination: 'acct_test_1',
    }, {
      livemode: false,
      event: { id: 'evt_old', type: 'transfer.created', created: 1 },
    });
    expect(result).toEqual(latest);
    expect(TransferRecord.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('read-only Stripe history reconciliation', () => {
  it('uses list APIs and never creates a transfer or payout', async () => {
    SyncState.findOneAndUpdate.mockResolvedValue({ _id: 'lease_1', cursor: null });
    SyncState.updateOne.mockResolvedValue({});
    const stripe = {
      transfers: { list: jest.fn().mockResolvedValue({ data: [], has_more: false }) },
      payouts: { list: jest.fn().mockResolvedValue({ data: [], has_more: false }) },
    };

    await syncTransfersPage(stripe, { id: 'acct_test_1' }, false);
    await syncBankPayoutsPage(stripe, { id: 'acct_test_1' }, false);

    expect(stripe.transfers.list).toHaveBeenCalledWith({ destination: 'acct_test_1', limit: 100 });
    expect(stripe.payouts.list).toHaveBeenCalledWith(
      { limit: 100, expand: ['data.destination'] },
      { stripeAccount: 'acct_test_1' }
    );
    expect(stripe.transfers.create).toBeUndefined();
    expect(stripe.payouts.create).toBeUndefined();
  });

  it('skips an account while another sync lease is active', async () => {
    SyncState.findOneAndUpdate.mockResolvedValue(null);
    const stripe = { transfers: { list: jest.fn() } };

    await expect(syncTransfersPage(stripe, { id: 'acct_test_1' }, false))
      .resolves.toEqual({ skipped: true, reason: 'sync_in_progress' });
    expect(stripe.transfers.list).not.toHaveBeenCalled();
  });
});
