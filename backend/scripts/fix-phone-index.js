/**
 * Migration: remove phone unique index
 *
 * PURPOSE:
 *   User.js previously declared `phone` as unique + sparse, which left a
 *   `phone_1` unique index in MongoDB. Empty strings ("") are not skipped
 *   by a sparse index, so the second user saved with `phone: ""` triggers:
 *     E11000 duplicate key error users index: phone_1 dup key: { phone: "" }
 *
 *   The `unique` constraint has been removed from the schema. This script
 *   drops the leftover `phone_1` index so it can no longer cause errors.
 *
 * USAGE (manual, run once):
 *   node backend/scripts/fix-phone-index.js --apply
 *
 * SAFETY:
 *   This only drops the phone_1 index. No user data is modified.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI || process.env.MONGO_URI);
  console.log('[Migration] Connected to MongoDB.');

  const collection = User.collection;
  const indexes = await collection.indexes();
  const phoneIndex = indexes.find((i) => i.name === 'phone_1');

  if (!phoneIndex) {
    console.log('[Migration] phone_1 index not found. Nothing to do.');
  } else {
    await collection.dropIndex('phone_1');
    console.log('[Migration] phone_1 index dropped. It can no longer cause duplicate key errors.');
  }

  await mongoose.disconnect();
  console.log('[Migration] Done.');
}

run().catch((err) => {
  console.error('[Migration] Error:', err.message);
  process.exit(1);
});
