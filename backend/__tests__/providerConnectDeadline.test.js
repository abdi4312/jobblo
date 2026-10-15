jest.mock('../models/GlobalConfig', () => ({ findOneAndUpdate: jest.fn() }));

const GlobalConfig = require('../models/GlobalConfig');
const {
  DEFAULT_DAYS,
  deadlineSnapshot,
  getProviderConnectDeadlineDays,
} = require('../services/safepay/providerConnectDeadline');

describe('SafePay Connect onboarding deadline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SAFEPAY_CONNECT_TEST_DEADLINE_MINUTES;
  });

  it.each([2, 3, 4])('uses %i days as exact 24-hour periods', (days) => {
    const confirmedAt = new Date('2025-01-01T12:34:56.000Z');
    const snapshot = deadlineSnapshot(days, confirmedAt);

    expect(snapshot.providerConnectDeadlineDays).toBe(days);
    expect(snapshot.paymentConfirmedAt).toBe(confirmedAt);
    expect(snapshot.providerConnectDeadlineAt.getTime() - confirmedAt.getTime())
      .toBe(days * 24 * 60 * 60 * 1000);
  });

  it('persists the three-day default when no admin value exists', async () => {
    GlobalConfig.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ value: DEFAULT_DAYS }),
    });
    await expect(getProviderConnectDeadlineDays()).resolves.toBe(3);
    expect(GlobalConfig.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'SAFEPAY_CONNECT_ONBOARDING_DEADLINE_DAYS' },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ value: 3 }) }),
      { upsert: true, new: true }
    );
  });

  it('rejects invalid persisted settings rather than silently defaulting', async () => {
    GlobalConfig.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ value: 3.5 }),
    });
    await expect(getProviderConnectDeadlineDays()).rejects.toThrow('Invalid SAFEPAY_CONNECT_ONBOARDING_DEADLINE_DAYS');
  });

  it('supports a recorded one-minute deadline override outside production', () => {
    process.env.SAFEPAY_CONNECT_TEST_DEADLINE_MINUTES = '1';
    const confirmedAt = new Date('2025-01-01T12:34:56.000Z');

    const snapshot = deadlineSnapshot(3, confirmedAt);

    expect(snapshot.providerConnectDeadlineDays).toBe(3);
    expect(snapshot.providerConnectDeadlineTestMinutes).toBe(1);
    expect(snapshot.providerConnectDeadlineAt.getTime() - confirmedAt.getTime()).toBe(60_000);
  });

  it('does not allow the test override in production', () => {
    process.env.SAFEPAY_CONNECT_TEST_DEADLINE_MINUTES = '1';
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const snapshot = deadlineSnapshot(3, new Date('2025-01-01T12:34:56.000Z'));
      expect(snapshot.providerConnectDeadlineAt.getTime()).toBe(
        snapshot.paymentConfirmedAt.getTime() + 3 * 24 * 60 * 60 * 1000
      );
      expect(snapshot).not.toHaveProperty('providerConnectDeadlineTestMinutes');
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
