/**
 * Remove the duplicate rows that would fail the new unique index builds.
 *
 *   node scripts/dedupe-payment-records.js            # report only, changes nothing
 *   node scripts/dedupe-payment-records.js --apply    # actually delete
 *
 * Run this BEFORE deploying the models that declare those indexes. Mongoose fails an
 * index build soft — it logs and carries on — so a collection with duplicates leaves
 * the application running with no index while looking perfectly healthy.
 *
 * Two constraints are being introduced:
 *
 *   Payment    unique on orderId
 *              Duplicates come from the browser redirect racing the Stripe webhook,
 *              back when confirmPaidSession used find-then-create.
 *
 *   JobRequest unique on (serviceId, customerId) where status = 'pending'
 *              Duplicates come from two concurrent applications both passing the
 *              controller's findOne guard.
 *
 * Keeps the OLDEST row in each group: for Payment that is the one carrying the
 * original stripeSessionId, and for JobRequest it is the application the job owner
 * has actually been looking at.
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function dedupe({ model, groupBy, matchStage, label }) {
  const pipeline = [];
  if (matchStage) pipeline.push({ $match: matchStage });
  pipeline.push(
    { $sort: { createdAt: 1, _id: 1 } },
    { $group: { _id: groupBy, n: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { n: { $gt: 1 } } }
  );

  const groups = await model.aggregate(pipeline);

  if (groups.length === 0) {
    console.log(`  ${label}: no duplicates`);
    return 0;
  }

  // Everything except the first (oldest) id in each group.
  const doomed = groups.flatMap((g) => g.ids.slice(1));

  console.log(`  ${label}: ${groups.length} duplicated key(s), ${doomed.length} row(s) to remove`);
  for (const g of groups.slice(0, 10)) {
    console.log(`      key=${JSON.stringify(g._id)}  keeping=${g.ids[0]}  removing=${g.ids.slice(1).join(', ')}`);
  }
  if (groups.length > 10) console.log(`      … and ${groups.length - 10} more`);

  if (APPLY) {
    const res = await model.deleteMany({ _id: { $in: doomed } });
    console.log(`  ${label}: deleted ${res.deletedCount}`);
  }

  return doomed.length;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log(`\nDeduplicating payment records${APPLY ? '' : '  (DRY RUN — pass --apply to delete)'}\n`);

  const Payment = require('../models/Payment');
  const JobRequest = require('../models/JobRequest');

  let total = 0;
  total += await dedupe({
    model: Payment,
    groupBy: '$orderId',
    label: 'Payment.orderId',
  });
  total += await dedupe({
    model: JobRequest,
    groupBy: { serviceId: '$serviceId', customerId: '$customerId' },
    matchStage: { status: 'pending' },
    label: 'JobRequest(serviceId,customerId) status=pending',
  });

  console.log(
    `\n${total === 0 ? 'Nothing to do — safe to build the unique indexes.' : APPLY ? `Removed ${total} row(s). Now verify with db.payments.getIndexes().` : `${total} row(s) would be removed. Re-run with --apply.`}\n`
  );

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error('dedupe failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
