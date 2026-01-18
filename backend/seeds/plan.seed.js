const SubscriptionPlan = require("../models/SubscriptionPlan");

module.exports = async () => {
  await SubscriptionPlan.deleteMany();

  const plans = [
    // ===== BUSINESS PLANS =====
    {
      name: "Free",
      price: 0,
      freeViews: 2,
      pricePerExtraView: 79,
      numberOfCustomers: 1,
      type: "business",
      features: [
        "2 gratis visninger",
        "79 kr per ekstra visning",
        "Grunnleggende funksjoner",
        "Begrenset tilgang",
      ],
    },
    {
      name: "Start",
      price: 199,
      freeViews: 5,
      pricePerExtraView: 39,
      numberOfCustomers: 1,
      type: "business",
      features: [
        "5 gratis visninger",
        "39 kr per ekstra visning",
        "Kommer øverst etter forespørsel",
        "Standardsupport",
      ],
    },
    {
      name: "Pro",
      price: 399,
      freeViews: 10,
      pricePerExtraView: 29,
      numberOfCustomers: 1,
      type: "business",
      features: [
        "10 gratis visninger",
        "29 kr per ekstra visning",
        "Kommer øverst etter forespørsel",
        "Prioritert support",
      ],
    },
    {
      name: "Premium",
      price: 639,
      freeViews: 20,
      pricePerExtraView: 19,
      numberOfCustomers: 1,
      type: "business",
      features: [
        "20 gratis visninger",
        "19 kr per ekstra visning",
        "Kommer øverst når kunder søker",
        "Premium support 24/7",
        "Verifisert bedriftsbadge",
      ],
    },

    // ===== PRIVATE PLANS =====
    {
      name: "Free",
      price: 0,
      freeViews: 2,
      pricePerExtraView: 45,
      numberOfCustomers: 1,
      type: "private",
      features: [
        "2 gratis visninger",
        "45 kr per ekstra visning",
        "Grunnleggende funksjoner",
        "Begrenset tilgang",
      ],
    },
    {
      name: "Fleksibel",
      price: 99,
      freeViews: 5,
      pricePerExtraView: 25,
      numberOfCustomers: 1,
      type: "private",
      features: [
        "5 gratis visninger",
        "25 kr per ekstra visning",
        "Standardsupport",
        "Estimat under 15 000 kr",
      ],
    },
    {
      name: "Job Plus",
      price: 149,
      freeViews: 15,
      pricePerExtraView: 15,
      numberOfCustomers: 1,
      type: "private",
      features: [
        "15 gratis visninger",
        "15 kr per ekstra visning",
        "Prioritert support",
        "Estimat under 15 000 kr",
        "Ekstra fordeler",
      ],
    },
  ];

  const created = await SubscriptionPlan.insertMany(plans);
  console.log(`💳 SubscriptionPlans: ${created.length}`);
  return created;
};
