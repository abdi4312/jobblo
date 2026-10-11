const { ensureStripePlanPrice } = require('../services/stripe/planPrice');

describe('mode-isolated recurring Stripe prices', () => {
  const plan = () => ({
    _id: 'plan_123',
    name: 'Existing Pro',
    price: 299,
    stripeProductIdTest: undefined,
    stripePriceIdTest: undefined,
    save: jest.fn().mockResolvedValue(undefined),
  });

  function stripeMock() {
    return {
      products: {
        create: jest.fn().mockResolvedValue({ id: 'prod_test' }),
        retrieve: jest.fn(),
      },
      prices: {
        list: jest.fn().mockResolvedValue({ data: [] }),
        retrieve: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'price_test' }),
      },
    };
  }

  it('creates a monthly NOK price using the unchanged plan amount and test-mode fields', async () => {
    const stripe = stripeMock();
    const subscriptionPlan = plan();

    const priceId = await ensureStripePlanPrice(stripe, subscriptionPlan, true);

    expect(priceId).toBe('price_test');
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_test',
        currency: 'nok',
        unit_amount: 29900,
        recurring: { interval: 'month' },
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining('jobblo_plan_price_test_plan_123_29900'),
      })
    );
    expect(subscriptionPlan.stripePriceIdTest).toBe('price_test');
    expect(subscriptionPlan.stripePriceId).toBeUndefined();
  });

  it('reuses a stored active price only when amount and monthly interval still match', async () => {
    const stripe = stripeMock();
    stripe.products.retrieve.mockResolvedValue({ id: 'prod_test', deleted: false });
    stripe.prices.retrieve.mockResolvedValue({
      id: 'price_existing',
      active: true,
      currency: 'nok',
      unit_amount: 29900,
      recurring: { interval: 'month' },
    });
    const subscriptionPlan = {
      ...plan(),
      stripeProductIdTest: 'prod_test',
      stripePriceIdTest: 'price_existing',
    };

    await expect(ensureStripePlanPrice(stripe, subscriptionPlan, true)).resolves.toBe(
      'price_existing'
    );
    expect(stripe.prices.create).not.toHaveBeenCalled();
  });

  it('creates a replacement Stripe price after the existing plan price changes', async () => {
    const stripe = stripeMock();
    stripe.products.retrieve.mockResolvedValue({ id: 'prod_test', deleted: false });
    stripe.prices.retrieve.mockResolvedValue({
      id: 'price_old',
      active: true,
      currency: 'nok',
      unit_amount: 10000,
      recurring: { interval: 'month' },
    });
    stripe.prices.list.mockResolvedValue({ data: [] });
    const subscriptionPlan = {
      ...plan(),
      stripeProductIdTest: 'prod_test',
      stripePriceIdTest: 'price_old',
    };

    await ensureStripePlanPrice(stripe, subscriptionPlan, true);

    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ unit_amount: 29900, recurring: { interval: 'month' } }),
      expect.any(Object)
    );
  });
});
