const GlobalConfig = require('../../models/GlobalConfig');

const CONFIG_KEY = 'SAFEPAY_CONNECT_ONBOARDING_DEADLINE_DAYS';
const DEFAULT_DAYS = 3;
const MIN_DAYS = 1;
const MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TEST_MINUTE_OVERRIDE = 'SAFEPAY_CONNECT_TEST_DEADLINE_MINUTES';

async function getProviderConnectDeadlineDays() {
  const config = await GlobalConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    {
      $setOnInsert: {
        value: DEFAULT_DAYS,
        description: 'Provider Stripe Connect onboarding deadline in 24-hour days',
      },
    },
    { upsert: true, new: true }
  ).lean();
  const days = Number(config.value);
  if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
    throw new Error(`Invalid ${CONFIG_KEY} setting; expected an integer from ${MIN_DAYS} to ${MAX_DAYS}.`);
  }
  return days;
}

function deadlineSnapshot(days, confirmedAt = new Date()) {
  if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
    throw new Error(`Provider Connect deadline must be an integer from ${MIN_DAYS} to ${MAX_DAYS} days.`);
  }
  const testMinutes = process.env.NODE_ENV === 'production'
    ? undefined
    : process.env[TEST_MINUTE_OVERRIDE] === undefined
      ? undefined
      : Number(process.env[TEST_MINUTE_OVERRIDE]);
  if (testMinutes !== undefined && (!Number.isInteger(testMinutes) || testMinutes < 1)) {
    throw new Error(`${TEST_MINUTE_OVERRIDE} must be a positive integer and is disabled in production.`);
  }
  return {
    paymentConfirmedAt: confirmedAt,
    providerConnectDeadlineDays: days,
    ...(testMinutes === undefined ? {} : { providerConnectDeadlineTestMinutes: testMinutes }),
    providerConnectDeadlineAt: new Date(
      confirmedAt.getTime() + (testMinutes === undefined ? days * DAY_MS : testMinutes * 60 * 1000)
    ),
  };
}

module.exports = {
  CONFIG_KEY,
  DEFAULT_DAYS,
  MIN_DAYS,
  MAX_DAYS,
  getProviderConnectDeadlineDays,
  deadlineSnapshot,
};
