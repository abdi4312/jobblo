/**
 * Link every paid subscription plan to a Stripe Price for the ACTIVE Stripe mode
 * (the same mode the app uses: GlobalConfig STRIPE_TEST_MODE + the matching key).
 *
 *   node scripts/configure-plan-prices.js           dry run: report only, writes nothing
 *   node scripts/configure-plan-prices.js --apply   create missing Product/Price and save the ids
 *
 * Fixes checkout error SUBSCRIPTION_PRICE_UNCONFIGURED. Rules:
 *  - a plan's price amount is never changed; the Stripe Price is created FROM it
 *    (monthly, NOK, unit_amount = plan.price * 100), which is exactly what checkout verifies;
 *  - an already linked Price is only verified, never replaced; a mismatch is reported;
 *  - re-running never duplicates: Prices carry lookup_key jobblo_plan_<planId>_<øre>, and
 *    creates use idempotency keys.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');

const apply = process.argv.includes('--apply');
const idOf = (v) => (typeof v === 'string' ? v : v?.id);

function priceProblems(price, plan, live) {
  const problems = [];
  if (!price.active) problems.push('inactive');
  if (price.livemode !== live) problems.push(`livemode=${price.livemode}`);
  if (String(price.currency).toLowerCase() !== 'nok') problems.push(`currency=${price.currency}`);
  if (price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring?.interval_count !== 1) problems.push('not monthly recurring');
  if (price.unit_amount !== Math.round(plan.price * 100)) problems.push(`amount ${price.unit_amount / 100} kr != plan ${plan.price} kr`);
  return problems;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const config = await getStripeConfiguration();
  if (!config.keyModeValid) throw new Error(`Stripe key does not match the configured ${config.mode.toUpperCase()} mode.`);
  const live = config.mode === 'live';
  const stripe = await getStripeForMode(config.testMode);
  const priceField = live ? 'stripePriceId' : 'stripePriceIdTest';
  const productField = live ? 'stripeProductId' : 'stripeProductIdTest';
  console.log(`[plans] database ${mongoose.connection.host}/${mongoose.connection.name} · Stripe ${config.mode.toUpperCase()} · ${apply ? 'APPLY' : 'DRY RUN (add --apply to write)'}`);

  const plans = await SubscriptionPlan.find({ isActive: { $ne: false }, price: { $gt: 0 } }).sort({ type: 1, price: 1 }).lean();
  let problems = 0;
  for (const plan of plans) {
    const label = `${plan.type}/${plan.name} (${plan.price} kr)`;
    const amount = Math.round(plan.price * 100);

    if (plan[priceField]) {
      let price;
      try { price = await stripe.prices.retrieve(plan[priceField]); } catch (e) { price = null; }
      const issues = price ? priceProblems(price, plan, live) : ['price not found in this Stripe account'];
      if (plan[productField] && price && idOf(price.product) !== plan[productField]) issues.push('product id does not match');
      if (issues.length) { problems += 1; console.log(`  ✗ ${label}: ${plan[priceField]} — ${issues.join(', ')} (fix manually; not changed)`); }
      else console.log(`  ✓ ${label}: ${plan[priceField]} OK`);
      continue;
    }

    const lookupKey = `jobblo_plan_${plan._id}_${amount}`;
    const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0];
    if (!apply) {
      console.log(`  • ${label}: no ${priceField} — would ${existing ? `link existing ${existing.id}` : 'create a monthly NOK price'}`);
      continue;
    }

    let price = existing;
    if (!price) {
      const productId = plan[productField] || (await stripe.products.create(
        { name: `Jobblo ${plan.name} (${plan.type === 'business' ? 'Bedrift' : 'Privat'})`, metadata: { planId: String(plan._id) } },
        { idempotencyKey: `jobblo-plan-product:${plan._id}:${config.mode}` }
      )).id;
      price = await stripe.prices.create({
        product: productId,
        currency: 'nok',
        unit_amount: amount,
        recurring: { interval: 'month', interval_count: 1 },
        lookup_key: lookupKey,
        metadata: { planId: String(plan._id) },
      }, { idempotencyKey: `jobblo-plan-price:${plan._id}:${amount}:${config.mode}` });
    }
    const issues = priceProblems(price, plan, live);
    if (issues.length) { problems += 1; console.log(`  ✗ ${label}: ${price.id} — ${issues.join(', ')} (not saved)`); continue; }

    // Compare-and-set: only fills an empty field, never overwrites a link made meanwhile.
    const saved = await SubscriptionPlan.updateOne(
      { _id: plan._id, $or: [{ [priceField]: null }, { [priceField]: { $exists: false } }, { [priceField]: '' }] },
      { $set: { [priceField]: price.id, [productField]: idOf(price.product) } }
    );
    console.log(`  ${saved.modifiedCount ? '✓ linked' : '• already linked by another run'} ${label}: ${price.id} (${idOf(price.product)})`);
  }
  console.log(problems ? `[plans] ${problems} plan(s) need manual attention.` : '[plans] done.');
  await mongoose.disconnect();
  process.exitCode = problems ? 1 : 0;
})().catch(async (e) => {
  console.error('[plans] failed:', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
