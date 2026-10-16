const fs = require('fs');
const path = require('path');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

test('legacy subscription-only Mongoose model files are absent', () => {
  for (const model of ['Subscription', 'SubscriptionPlan', 'StripeBillingOperation', 'Coupon']) {
    expect(fs.existsSync(path.join(__dirname, '..', 'models', `${model}.js`))).toBe(false);
  }
});

test('historic transaction and user subscription fields remain in their shared models', () => {
  expect(Transaction.schema.path('planId')).toBeDefined();
  expect(Transaction.schema.path('coupon')).toBeDefined();
  expect(Transaction.schema.path('stripeSessionId')).toBeDefined();
  expect(User.schema.path('monthlyContactUsage')).toBeDefined();
});

test('plan seed remains unchanged and awaits the V2-compatible model', () => {
  const seed = fs.readFileSync(path.join(__dirname, '..', 'seeds', 'plan.seed.js'), 'utf8');
  expect(seed).toMatch(/require\(['"]\.\.\/models\/SubscriptionPlan['"]\)/);
});
