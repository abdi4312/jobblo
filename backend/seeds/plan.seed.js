const SubscriptionPlan = require("../models/SubscriptionPlan");

module.exports = async () => {
  await SubscriptionPlan.deleteMany();

  const plans = [
    // ===== BUSINESS =====
    {
      name: "Start",
      price: 199,
      type: "business",
      entitlements: {
        freeContact: 5,
        perContactPrice:49,
        ContactUnlock:120,
        radius: 50,
      },
      featuresText: [
        "5 gratis visninger",
        "39 kr per ekstra visning",
        "Kommer øverst etter forespørsel",
        "Standardsupport",
      ],
    },
    {
      name: "Pro",
      price: 399,
      type: "business",
      entitlements: {
        freeContact: 10,
        perContactPrice:29,
        ContactUnlock:30,
        maxContact:25,
        radius: 50,
      },
      featuresText: [
        "10 gratis visninger",
        "29 kr per ekstra visning",
        "Prioritert support",
      ],
    },
    {
      name: "Premium",
      price: 639,
      type: "business",
      entitlements: {
        freeContact: 20,
        perContactPrice:19,
        ContactUnlock:30,
        maxContact:25,
        radius: 15,
      },
      featuresText: [
        "20 gratis visninger",
        "Premium support 24/7",
        "Verifisert bedriftsbadge",
      ],
    },

    // ===== PRIVATE =====
    {
      name: "Free",
      price: 0,
      type: "private",
      entitlements: {
        freeContact: 0,
        perContactPrice:49,
        ContactUnlock:240,
        maxContact:15,
        radius: 75,
        maxJobsValue: 10000,
      },
      featuresText: [
        "2 gratis visninger",
        "45 kr per ekstra visning",
      ],
    },
    {
      name: "Fleksibel",
      price: 99,
      type: "private",
      entitlements: {
        freeContact: 5,
        perContactPrice:29,
        ContactUnlock:180,
        maxContact:10,
        radius: 50,
        maxJobsValue: 15000,
      },
      featuresText: [
        "5 gratis visninger",
        "25 kr per ekstra visning",
        "Estimat under 15 000 kr",
      ],
    },
    {
      name: "Job Plus",
      price: 149,
      type: "private",
      entitlements: {
        freeContact: 10,
        perContactPrice:19,
        ContactUnlock:30,
        maxContact:30,
        radius: 50,
        maxJobsValue: 30000,
      },
      featuresText: [
        "10 gratis visninger",
        "Prioritert support",
        "Ekstra fordeler",
      ],
    },
  ];

  const created = await SubscriptionPlan.insertMany(plans);
  console.log(`💳 SubscriptionPlans seeded: ${created.length}`);
};
