require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');

const apply = process.argv.includes('--apply');
const DEFAULT_PLANS = new Set(['Standard', 'Start']);

async function classify(user, subscription, subscriptionTransactions) {
  const current = subscription?.currentPlan;
  const hasStripeEvidence = Boolean(current?.stripeSubscriptionId);
  const hasPaidTransaction = subscriptionTransactions.some(
    (transaction) => transaction.status === 'succeeded'
  );

  if (hasStripeEvidence || hasPaidTransaction) return 'REAL_PAID';
  if (
    !current ||
    (!current.planId &&
      current.planType === 'business' &&
      (!current.plan || DEFAULT_PLANS.has(current.plan)) &&
      !(subscription?.planHistory?.length > 0))
  ) {
    return 'LEGACY_AUTO_ASSIGNED';
  }
  return 'UNKNOWN';
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({ role: 'company' })
    .select('_id email role planType subscription')
    .lean();
  const report = [];

  for (const user of users) {
    const subscription = await Subscription.findOne({ userId: user._id }).lean();
    const transactions = await Transaction.find({ userId: user._id, type: 'subscription' })
      .select('status provider stripeSessionId')
      .lean();
    const classification = await classify(user, subscription, transactions);
    const current = subscription?.currentPlan || null;
    const proposedAction = classification === 'LEGACY_AUTO_ASSIGNED'
      ? 'set currentPlan to null'
      : 'no automatic change';

    report.push({
      userId: String(user._id),
      email: user.email,
      oldPlan: current?.plan || null,
      planId: current?.planId ? String(current.planId) : null,
      stripeSubscriptionId: current?.stripeSubscriptionId || null,
      classification,
      proposedAction,
    });

    if (apply && classification === 'LEGACY_AUTO_ASSIGNED' && subscription) {
      await Subscription.updateOne({ _id: subscription._id }, { $set: { currentPlan: null } });
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', database: mongoose.connection.name, report }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
