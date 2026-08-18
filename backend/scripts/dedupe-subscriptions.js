/**
 * Collapse the duplicate Subscription rows left behind by the Vipps login bug.
 *
 *   npm run dedupe:subscriptions             # report only, changes nothing
 *   npm run dedupe:subscriptions -- --apply  # actually delete
 *
 * (or `node scripts/dedupe-subscriptions.js [--apply]` directly.)
 *
 * Background: controllers/vippsController.js ran `Subscription.create(...)` on every
 * sign-in instead of only at signup, so a user who logged in ten times has ten rows.
 * That is fixed -- the callback now does an idempotent `$setOnInsert` upsert -- but
 * the rows already written are still in the database, and every reader in the codebase
 * resolves the subscription with `findOne({ userId })`. Which row wins is natural
 * document order, so an upgraded customer can be served a stale free row and silently
 * lose the plan they are paying for.
 *
 * The rules for choosing the survivor live in utils/subscriptionDedupe.js, next to the
 * reasoning behind them, and are unit-tested in __tests__/subscriptionDedupe.test.js.
 * The short version: a Stripe-backed or otherwise non-default row always beats a
 * signup default regardless of age, and a group containing two rows that both mean
 * something is reported as MANUAL_REVIEW and left completely alone.
 *
 * Run this BEFORE the unique index on Subscription.userId is built. Mongoose fails an
 * index build soft -- it logs and carries on -- so a collection with duplicates leaves
 * the application running with no index while looking perfectly healthy.
 *
 * Idempotent: after a successful --apply every user has one row, so a second run finds
 * no groups and changes nothing.
 *
 * Prints no e-mail addresses, names or Stripe ids -- only row ids, plan names,
 * statuses, and a boolean for whether a Stripe subscription is attached.
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const mongoose = require('mongoose');
const {
  classifySubscriptionGroup,
  assertNoStripeIdLost,
  describeRow,
} = require('../utils/subscriptionDedupe');

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

/** How many duplicate groups to print in full before summarising the rest. */
const DETAIL_LIMIT = VERBOSE ? Infinity : 25;

function printGroup(userId, rows, verdict) {
  const tag =
    verdict.decision === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : APPLY ? 'DEDUPE' : 'WOULD DEDUPE';

  console.log(`\n  [${tag}] user=${userId}  rows=${rows.length}  (${verdict.reason})`);

  for (const row of rows.map(describeRow)) {
    const marker =
      row.id === verdict.keepId ? 'KEEP  ' : verdict.deleteIds.includes(row.id) ? 'DELETE' : '  --  ';
    console.log(
      `      ${marker} ${row.id}  plan=${row.plan}/${row.type}  status=${row.status}  ` +
        `stripe=${row.hasStripeSubscriptionId ? 'yes' : 'no'}  history=${row.historyEntries}  ` +
        `created=${row.createdAt}`
    );
  }
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const Subscription = require('../models/Subscription');

  console.log(
    `\nDeduplicating subscriptions${APPLY ? '' : '  (DRY RUN -- pass --apply to delete)'}\n`
  );

  // Group in the database rather than pulling the whole collection into memory: only
  // the userIds that actually have more than one row come back.
  const duplicated = await Subscription.aggregate([
    { $group: { _id: '$userId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $sort: { n: -1 } },
  ]);

  if (duplicated.length === 0) {
    console.log('  No user has more than one subscription. Nothing to do.\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  let safeGroups = 0;
  let manualGroups = 0;
  let deletedRows = 0;
  let plannedRows = 0;
  let printed = 0;
  const manualUserIds = [];

  for (const group of duplicated) {
    const userId = group._id;

    // Re-read the rows themselves; the aggregate above only counted them.
    const rows = await Subscription.find({ userId }).lean();
    const verdict = classifySubscriptionGroup(rows);

    if (verdict.decision === 'SINGLE') continue; // raced with a concurrent write

    if (printed < DETAIL_LIMIT) {
      printGroup(userId, rows, verdict);
      printed++;
    }

    if (verdict.decision === 'MANUAL_REVIEW') {
      manualGroups++;
      manualUserIds.push(String(userId));
      continue;
    }

    safeGroups++;
    plannedRows += verdict.deleteIds.length;

    if (APPLY) {
      // Throws rather than deleting if the survivor would not carry a Stripe
      // subscription id that a doomed row does. Nothing has been written at this
      // point, so aborting here leaves the group exactly as it was.
      assertNoStripeIdLost(rows, verdict.keepId, verdict.deleteIds);

      const res = await Subscription.deleteMany({
        _id: { $in: verdict.deleteIds.map((id) => new mongoose.Types.ObjectId(id)) },
      });
      deletedRows += res.deletedCount;
    }
  }

  if (printed >= DETAIL_LIMIT && duplicated.length > printed) {
    console.log(
      `\n  ... and ${duplicated.length - printed} more group(s) not shown. Pass --verbose for all.`
    );
  }

  console.log('\n' + '-'.repeat(72));
  console.log(`  users with duplicates : ${duplicated.length}`);
  console.log(`  safe to collapse      : ${safeGroups}`);
  console.log(`  need manual review    : ${manualGroups}`);
  console.log(
    APPLY ? `  rows deleted          : ${deletedRows}` : `  rows that would go    : ${plannedRows}`
  );
  console.log('-'.repeat(72));

  if (manualUserIds.length > 0) {
    console.log(
      `\n  Left untouched -- more than one row carries real subscription data.\n` +
        `  Resolve these by hand before building the unique index:\n`
    );
    for (const id of manualUserIds) console.log(`      ${id}`);
  }

  if (!APPLY) {
    console.log(`\n  Nothing was changed. Re-run with --apply to delete.\n`);
  } else if (manualGroups === 0) {
    console.log(
      `\n  Done. Every user now has at most one subscription -- safe to build the\n` +
        `  unique index on Subscription.userId (see models/Subscription.js).\n`
    );
  } else {
    console.log(
      `\n  Done for the safe groups. ${manualGroups} still need a human; the unique\n` +
        `  index will FAIL to build until those are resolved.\n`
    );
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error('dedupe failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
