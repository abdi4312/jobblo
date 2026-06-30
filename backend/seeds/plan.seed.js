const SubscriptionPlan = require('../models/SubscriptionPlan');

module.exports = async () => {
  await SubscriptionPlan.deleteMany();

  const plans = [
    // ===== BUSINESS =====
    {
      name: 'Start',
      price: 199,
      type: 'business',
      entitlements: {
        freeContact: 8,
        perContactPrice: 49,
        ContactUnlock: 120, // 2 hours
        radius: 75,
        visibilityLevel: 2,
      },
      featuresText: ['8 gratis kontakter per måned', 'Standard synlighet', 'Radius: 75 km'],
    },
    {
      name: 'Pro',
      price: 399,
      type: 'business',
      entitlements: {
        freeContact: 20,
        perContactPrice: 29,
        ContactUnlock: 30, // 30 minutes
        radius: 50,
        visibilityLevel: 3,
        hasBadge: true,
      },
      featuresText: [
        '20 gratis kontakter per måned',
        'Prioritert synlighet',
        'Bedriftsmerke (Badge)',
        'Radius: 50 km',
      ],
    },
    {
      name: 'Premium',
      price: 599,
      type: 'business',
      entitlements: {
        freeContact: 40,
        perContactPrice: 19,
        ContactUnlock: 0, // Real-time
        radius: 15,
        visibilityLevel: 5,
        hasBadge: true,
        hasAnalytics: true,
      },
      featuresText: [
        '40 gratis kontakter per måned',
        'Topp synlighet',
        'Verifisert merke & Analyse',
        'Tidlig tilgang til oppdrag',
      ],
    },

    // ===== PRIVATE =====
    {
      name: 'Standard',
      price: 0,
      type: 'private',
      entitlements: {
        freeContact: 5,
        perContactPrice: 49,
        ContactUnlock: 120, // 2 hours
        radius: 75,
        visibilityLevel: 0,
        locationPrecision: 'approximate',
        maxJobsValue: 10000,
      },
      featuresText: [
        '5 gratis kontakter per måned',
        'Omtrentlig posisjon',
        'Standard synlighet',
        'Gratis kontakt for oppdrag under 10 000 NOK',
      ],
    },
    {
      name: 'Plus',
      price: 99,
      type: 'private',
      entitlements: {
        freeContact: 15,
        perContactPrice: 29,
        ContactUnlock: 60, // 1 hour
        radius: 50,
        visibilityLevel: 2,
        locationPrecision: 'exact',
        maxJobsValue: 20000,
      },
      featuresText: [
        '15 gratis kontakter per måned',
        'Mer nøyaktig posisjon',
        'Bedre synlighet',
        '1 time raskere tilgang enn Standard',
      ],
    },
    {
      name: 'Pro',
      price: 149,
      type: 'private',
      entitlements: {
        freeContact: 35,
        perContactPrice: 19,
        ContactUnlock: 0, // Real-time
        radius: 15,
        visibilityLevel: 3,
        locationPrecision: 'exact',
        maxJobsValue: 50000,
      },
      featuresText: [
        '35 gratis kontakter per måned',
        'Mest nøyaktig posisjon',
        'Høyest synlighet',
        'Sanntidstilgang til alle oppdrag',
      ],
    },
  ];

  const created = await SubscriptionPlan.insertMany(plans);
  console.log(`💳 SubscriptionPlans seeded: ${created.length}`);
};
