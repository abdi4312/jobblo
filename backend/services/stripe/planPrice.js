function priceFields(testMode) {
  return {
    product: testMode ? 'stripeProductIdTest' : 'stripeProductId',
    price: testMode ? 'stripePriceIdTest' : 'stripePriceId',
    mode: testMode ? 'test' : 'live',
  };
}

function matchesMonthlyNokPrice(price, amount) {
  return (
    price &&
    price.active &&
    price.currency === 'nok' &&
    price.unit_amount === amount &&
    price.recurring?.interval === 'month'
  );
}

async function ensureStripePlanPrice(stripe, plan, testMode) {
  const fields = priceFields(testMode);
  const amount = Math.round(Number(plan.price) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('A paid subscription plan must have a valid NOK price');
  }

  let productId = plan[fields.product];
  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId);
      if (product.deleted) productId = null;
    } catch (error) {
      if (error?.code === 'resource_missing') productId = null;
      else throw error;
    }
  }

  if (!productId) {
    const product = await stripe.products.create(
      {
        name: plan.name,
        metadata: { jobbloPlanId: String(plan._id), jobbloStripeMode: fields.mode },
      },
      { idempotencyKey: `jobblo_plan_product_${fields.mode}_${plan._id}` }
    );
    productId = product.id;
    plan[fields.product] = productId;
    await plan.save();
  }

  let storedPrice;
  if (plan[fields.price]) {
    try {
      storedPrice = await stripe.prices.retrieve(plan[fields.price]);
    } catch (error) {
      if (error?.code !== 'resource_missing') throw error;
    }
    if (matchesMonthlyNokPrice(storedPrice, amount)) return storedPrice.id;
  }

  const existing = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  storedPrice = existing.data.find((price) => matchesMonthlyNokPrice(price, amount));
  if (!storedPrice) {
    storedPrice = await stripe.prices.create(
      {
        product: productId,
        currency: 'nok',
        unit_amount: amount,
        recurring: { interval: 'month' },
        metadata: {
          jobbloPlanId: String(plan._id),
          jobbloStripeMode: fields.mode,
        },
      },
      { idempotencyKey: `jobblo_plan_price_${fields.mode}_${plan._id}_${amount}_month` }
    );
  }

  plan[fields.price] = storedPrice.id;
  await plan.save();
  return storedPrice.id;
}

module.exports = { ensureStripePlanPrice, priceFields, matchesMonthlyNokPrice };
