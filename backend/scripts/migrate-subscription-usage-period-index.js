const mongoose = require('mongoose');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');
  mongoose.set('autoIndex', false);
  await mongoose.connect(uri);

  const collection = mongoose.connection.collection('subscription_usage_periods');
  const indexes = await collection.indexes();
  const oldUnique = indexes.find(
    (index) =>
      index.unique &&
      index.key?.subscriptionId === 1 &&
      index.key?.billingPeriodStart === 1
  );
  await collection.createIndex(
    { userId: 1, billingPeriodStart: 1 },
    { unique: true, name: 'userId_1_billingPeriodStart_1' }
  );
  if (oldUnique) await collection.dropIndex(oldUnique.name);
  await collection.createIndex(
    { subscriptionId: 1, billingPeriodStart: 1 },
    { name: 'subscriptionId_1_billingPeriodStart_1' }
  );
}

if (require.main === module) {
  migrate()
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error('Subscription usage-period index migration failed:', err);
      await mongoose.disconnect();
      process.exitCode = 1;
    });
}

module.exports = { migrate };
