const { hasPaidEntitlement, subscriptionGraceDays } = require('../services/stripe/billingPolicy');

describe('subscription entitlement billing policy', () => {
  const oldGrace = process.env.STRIPE_SUBSCRIPTION_GRACE_DAYS;

  afterEach(() => {
    if (oldGrace === undefined) delete process.env.STRIPE_SUBSCRIPTION_GRACE_DAYS;
    else process.env.STRIPE_SUBSCRIPTION_GRACE_DAYS = oldGrace;
  });

  it('requires an unexpired Stripe period for active paid access', () => {
    const now = new Date('2026-10-12T00:00:00Z');
    expect(
      hasPaidEntitlement(
        {
          stripeSubscriptionId: 'sub_active',
          status: 'active',
          endDate: new Date('2026-10-13T00:00:00Z'),
        },
        now
      )
    ).toBe(true);
    expect(
      hasPaidEntitlement(
        { stripeSubscriptionId: 'sub_expired', status: 'active', endDate: new Date('2026-10-11') },
        now
      )
    ).toBe(false);
    expect(
      hasPaidEntitlement({ stripeSubscriptionId: 'sub_legacy', status: 'active' }, now)
    ).toBe(false);
  });

  it('grants access only during the configured past-due grace window', () => {
    process.env.STRIPE_SUBSCRIPTION_GRACE_DAYS = '3';
    const current = {
      stripeSubscriptionId: 'sub_past_due',
      status: 'past_due',
      pastDueSince: new Date('2026-10-10T00:00:00Z'),
    };
    expect(hasPaidEntitlement(current, new Date('2026-10-12T23:59:59Z'))).toBe(true);
    expect(hasPaidEntitlement(current, new Date('2026-10-13T00:00:00Z'))).toBe(false);
  });

  it('supports zero grace and rejects invalid configuration', () => {
    process.env.STRIPE_SUBSCRIPTION_GRACE_DAYS = '0';
    expect(subscriptionGraceDays()).toBe(0);
    expect(
      hasPaidEntitlement(
        {
          stripeSubscriptionId: 'sub_past_due',
          status: 'past_due',
          pastDueSince: new Date('2026-10-12T00:00:00Z'),
        },
        new Date('2026-10-12T00:00:00Z')
      )
    ).toBe(false);
    process.env.STRIPE_SUBSCRIPTION_GRACE_DAYS = '31';
    expect(() => subscriptionGraceDays()).toThrow(/integer from 0 to 30/);
  });

  it('keeps non-Stripe default subscriptions on their existing active rule', () => {
    expect(hasPaidEntitlement({ status: 'active' })).toBe(true);
    expect(hasPaidEntitlement({ status: 'cancelled' })).toBe(false);
  });
});
