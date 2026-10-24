/**
 * Duplicate Payment records block the unique { orderId } index, so the database cannot
 * enforce "one Payment per order". Follow docs/runbooks/duplicate-payments-archive.md —
 * this script is one step of that runbook, never a shortcut around it.
 *
 * Root cause (seen locally, 2026-06-01): commit ff7eaab8's job-completion path did
 * `new Payment({ status: 'released' })` on every call. Payments are now upserted by orderId.
 *
 * A group is only ever a candidate when it is provably not a real payment:
 *   - the order no longer exists, AND
 *   - no record carries any Stripe reference.
 *
 * Modes (read-only unless --apply / --restore):
 *   node scripts/archive-orphan-duplicate-payments.js                          dry run
 *   node scripts/archive-orphan-duplicate-payments.js --export review.json     full records for manual review
 *   node scripts/archive-orphan-duplicate-payments.js --verify-stripe          search CURRENT Stripe accounts by orderId metadata
 *   node scripts/archive-orphan-duplicate-payments.js --apply --backup-ref=<verified backup id> --reviewed=<row count>
 *   node scripts/archive-orphan-duplicate-payments.js --restore=<archiveBatch> [--drop-unique-index]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const arg = (name) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes('=')) return hit.split('=').slice(1).join('=');
  const next = process.argv[process.argv.indexOf(hit) + 1];
  return next && !next.startsWith('--') ? next : true;
};
const STRIPE_FIELDS = ['stripePaymentIntentId', 'stripeSessionId', 'stripeEventId', 'stripeRefundId', 'paymentProviderId', 'transactionId', 'capturedAmountMinor'];

async function scan(db) {
  const payments = db.collection('payments');
  const groups = await payments.aggregate([{ $group: { _id: '$orderId', ids: { $push: '$_id' }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]).toArray();
  const archivable = [];
  const needsReview = [];
  for (const g of groups) {
    const docs = await payments.find({ _id: { $in: g.ids } }).sort({ createdAt: 1 }).toArray();
    const orderExists = Boolean(await db.collection('orders').findOne({ _id: g._id }, { projection: { _id: 1 } }));
    const related = {
      safePayHistory: await db.collection('safepayhistories').countDocuments({ orderId: g._id }),
      payouts: await db.collection('payouts').countDocuments({ orderId: g._id }),
      financialOps: await db.collection('stripefinancialoperations').countDocuments({ orderId: g._id }),
      incidents: await db.collection('stripepaymentincidents').countDocuments({ orderId: g._id }),
    };
    const hasStripe = docs.some((d) => STRIPE_FIELDS.some((f) => d[f] !== undefined && d[f] !== null));
    const hasRelated = Object.values(related).some(Boolean);
    const row = { orderId: String(g._id), count: g.n, orderExists, hasStripe, related, docs };
    if (!orderExists && !hasStripe && !hasRelated) archivable.push(row);
    else needsReview.push(row);
  }
  return { groups, archivable, needsReview };
}

async function verifyStripe(rows) {
  const { getStripeForMode } = require('../config/stripe');
  for (const testMode of [true, false]) {
    let stripe;
    try {
      stripe = await getStripeForMode(testMode);
    } catch (err) {
      console.log(`  ${testMode ? 'TEST' : 'LIVE'}: not checked (${err.message})`);
      continue;
    }
    const account = await stripe.accounts.retrieve().then((a) => a.id).catch(() => 'unknown');
    for (const r of rows) {
      const q = `metadata['orderId']:'${r.orderId}'`;
      const pis = await stripe.paymentIntents.search({ query: q }).then((x) => x.data.map((p) => `${p.id}/${p.status}`)).catch((e) => [`search failed: ${e.code || e.message}`]);
      console.log(`  ${testMode ? 'TEST' : 'LIVE'} ${account} order ${r.orderId}: ${pis.length ? pis.join(', ') : 'no PaymentIntent with this orderId'}`);
    }
  }
  console.log('  NOTE: only the CURRENT Stripe accounts were searched. Old/rotated accounts must be checked in their dashboards (see runbook).');
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  const restoreBatch = arg('restore');
  if (restoreBatch) {
    const archived = await db.collection('payments_archive').find({ archiveBatch: restoreBatch }).toArray();
    if (!archived.length) throw new Error(`No archived rows for batch ${restoreBatch}.`);
    // Pre-flight BEFORE any write: restoring duplicates is impossible while the unique
    // index exists, and a half-done restore must never happen.
    const indexes = await db.collection('payments').indexes();
    const unique = indexes.find((i) => i.unique && i.key && i.key.orderId === 1);
    if (unique) {
      if (!arg('drop-unique-index')) throw new Error(`payments has a unique orderId index (${unique.name}); restoring duplicates needs --drop-unique-index. Nothing was changed.`);
      await db.collection('payments').dropIndex(unique.name);
      console.log(`Dropped ${unique.name} so the duplicates can be restored.`);
    }
    const docs = archived.map(({ archivedAt, archiveReason, archiveBatch, archiveBackupRef, archiveDb, ...d }) => d);
    // Idempotent: upsert by _id, so re-running after any interruption converges.
    await db.collection('payments').bulkWrite(docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })), { ordered: true });
    await db.collection('payments_archive').deleteMany({ archiveBatch: restoreBatch });
    console.log(`Restored ${docs.length} row(s) from batch ${restoreBatch} into payments (${dbName}).`);
    return mongoose.disconnect();
  }

  const { groups, archivable, needsReview } = await scan(db);
  const rows = archivable.reduce((a, r) => a + r.count, 0);
  console.log(`Database: ${dbName}`);
  console.log(`Duplicate groups: ${groups.length}`);
  console.log(`\nCandidates (order gone, no Stripe reference, no related money records): ${archivable.length} group(s), ${rows} row(s)`);
  archivable.forEach((r) => console.log(`  order ${r.orderId}: ${r.count} rows, status ${[...new Set(r.docs.map((d) => d.status))].join('/')}, amount ${[...new Set(r.docs.map((d) => d.amount))].join('/')}, created ${r.docs[0].createdAt?.toISOString()} … ${r.docs[r.docs.length - 1].createdAt?.toISOString()}`));
  console.log(`\nNeeds human review (order exists, Stripe-linked, or related money records): ${needsReview.length}`);
  needsReview.forEach((r) => console.log(`  order ${r.orderId}: ${r.count} rows, orderExists=${r.orderExists}, stripe=${r.hasStripe}, related=${JSON.stringify(r.related)}`));

  const exportPath = arg('export');
  if (exportPath && exportPath !== true) {
    fs.writeFileSync(exportPath, JSON.stringify({ database: dbName, generatedAt: new Date(), archivable, needsReview }, null, 2));
    console.log(`\nWrote full records for manual review to ${exportPath}`);
  }
  if (arg('verify-stripe')) {
    console.log('\nStripe verification:');
    await verifyStripe([...archivable, ...needsReview]);
  }

  if (!arg('apply')) {
    console.log('\nRead-only run — nothing changed.');
    return mongoose.disconnect();
  }

  const backupRef = arg('backup-ref');
  const reviewed = Number(arg('reviewed'));
  if (!backupRef || backupRef === true) throw new Error('--apply needs --backup-ref=<id of a backup you have test-restored>.');
  if (reviewed !== rows) throw new Error(`--reviewed=${arg('reviewed')} does not match the ${rows} candidate row(s) — re-run the review.`);
  if (!archivable.length) {
    console.log('Nothing to archive.');
    return mongoose.disconnect();
  }
  const batch = `dup-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
  const docs = archivable.flatMap((r) => r.docs.map((d) => ({ ...d, archivedAt: new Date(), archiveReason: 'orphan-duplicate-no-stripe-ref', archiveBatch: batch, archiveBackupRef: backupRef, archiveDb: dbName })));
  await db.collection('payments_archive').insertMany(docs, { ordered: true });
  const res = await db.collection('payments').deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  console.log(`\nArchived ${docs.length} row(s) to payments_archive as batch ${batch}; removed ${res.deletedCount}.`);
  console.log(`Undo with: node scripts/archive-orphan-duplicate-payments.js --restore=${batch}`);
  if (needsReview.length) {
    console.log('Unique index NOT built: some groups still need review.');
  } else {
    await require('../models/Payment').createIndexes();
    console.log('Payment indexes built (orderId unique).');
  }
  return mongoose.disconnect();
})().catch(async (err) => {
  console.error(`ERROR: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
