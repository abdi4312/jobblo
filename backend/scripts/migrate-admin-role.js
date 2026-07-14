/**
 * Migration: admin → superAdmin role cleanup
 *
 * PURPOSE:
 *   The previous codebase allowed an "admin" role value in the UsersPage form.
 *   The canonical User.js model has never included "admin" in its enum, so any
 *   records with role:"admin" were created outside normal Mongoose validation.
 *
 *   This script safely identifies and reports any such records.
 *   It does NOT modify data automatically.
 *
 * USAGE (manual, run once):
 *   node backend/scripts/migrate-admin-role.js --dry-run
 *   node backend/scripts/migrate-admin-role.js --apply
 *
 * SAFETY:
 *   --dry-run  List affected documents, make no changes (default).
 *   --apply    Promote affected users from "admin" → "superAdmin".
 *              Review the dry-run output first.
 *
 * This script must be reviewed and approved by a human before --apply is used.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const isDryRun = !process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI || process.env.MONGO_URI);
  console.log('[Migration] Connected to MongoDB.');

  // Find users with "admin" role (unsupported value)
  const affected = await User.find({ role: 'admin' }).select('_id name email role createdAt').lean();

  console.log(`\n[Migration] Users with role "admin": ${affected.length}`);

  if (affected.length === 0) {
    console.log('[Migration] No cleanup needed. Exiting.');
    await mongoose.disconnect();
    return;
  }

  affected.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name} <${u.email}> — created: ${u.createdAt}`);
  });

  if (isDryRun) {
    console.log('\n[Migration] DRY RUN — no changes made.');
    console.log('[Migration] To apply: node scripts/migrate-admin-role.js --apply');
  } else {
    console.log('\n[Migration] Applying: promoting role "admin" → "superAdmin"...');
    const result = await User.updateMany({ role: 'admin' }, { $set: { role: 'superAdmin' } });
    console.log(`[Migration] Updated ${result.modifiedCount} record(s).`);
    console.log('[Migration] IMPORTANT: Verify the promoted accounts are intended super admins.');
  }

  await mongoose.disconnect();
  console.log('[Migration] Done.');
}

run().catch((err) => {
  console.error('[Migration] Error:', err.message);
  process.exit(1);
});
