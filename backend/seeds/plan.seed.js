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
        perContactPrice: 49,
        ContactUnlock: 120, // minutes
        radius: 75,
        maxContact: 999,
        maxJobsValue: 150000,
      },
      featuresText: [
        "5 gratis kontakter",
        "49 kr per ekstra kontakt",
        "Kontakt åpner etter 2 timer",
        "Radius: 75 km",
      ],
    },
    {
      name: "Pro",
      price: 399,
      type: "business",
      entitlements: {
        freeContact: 10,
        perContactPrice: 29,
        ContactUnlock: 30, // minutes
        radius: 50,
        maxContact: 25,
      },
      featuresText: [
        "10 gratis kontakter",
        "29 kr per ekstra kontakt (maks 25)",
        "Kontakt åpner etter 30 minutter",
        "Radius: 50 km",
      ],
    },
    {
      name: "Premium",
      price: 639,
      type: "business",
      entitlements: {
        freeContact: 20,
        perContactPrice: 19,
        ContactUnlock: 0, // real-time
        radius: 15,
        maxContact: 999,
      },
      featuresText: [
        "20 gratis kontakter",
        "19 kr per ekstra kontakt (ingen grense)",
        "Kontakt i sanntid",
        "Radius: 15 km",
      ],
    },

    // ===== PRIVATE =====
    {
      name: "Standard",
      price: 0,
      type: "private",
      entitlements: {
        freeContact: 0,
        perContactPrice: 49,
        ContactUnlock: 240, // minutes
        maxContact: 15,
        radius: 75,
        maxJobsValue: 10000,
      },
      featuresText: [
        "0 gratis kontakter",
        "Maks 15 kontakter per måned",
        "49 kr per kontakt",
        "Kontakt åpner etter 4 timer",
        "Maks oppdrag: 10.000 kr",
        "Radius: 75 km",
      ],
    },
    {
      name: "Fleksibel",
      price: 99,
      type: "private",
      entitlements: {
        freeContact: 5,
        perContactPrice: 29,
        ContactUnlock: 180, // minutes
        maxContact: 10,
        radius: 50,
        maxJobsValue: 15000,
      },
      featuresText: [
        "5 gratis kontakter",
        "29 kr per ekstra kontakt (maks 10)",
        "Kontakt åpner etter 3 timer",
        "Maks oppdrag: 15.000 kr",
        "Radius: 50 km",
      ],
    },
    {
      name: "Jobblo Pluss",
      price: 149,
      type: "private",
      entitlements: {
        freeContact: 15,
        perContactPrice: 19,
        ContactUnlock: 30, // minutes
        maxContact: 20,
        radius: 15,
        maxJobsValue: 30000,
      },
      featuresText: [
        "15 gratis kontakter",
        "19 kr per ekstra kontakt (maks 20)",
        "Kontakt åpner etter 30 minutter",
        "Maks oppdrag: 30.000 kr",
        "Radius: 15 km",
      ],
    },
  ];

  const created = await SubscriptionPlan.insertMany(plans);
  console.log(`💳 SubscriptionPlans seeded: ${created.length}`);
};
