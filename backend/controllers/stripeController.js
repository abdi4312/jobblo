const Subscription = require("../models/Subscription");
const User = require("../models/User");
const stripe = require("../config/stripe");
const SubscriptionPlan = require("../models/SubscriptionPlan");

exports.createCheckoutSession = async (req, res) => {
  try {
    const { planId } = req.body;
    const user = req.user;

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user._id) },
    });

    // 2. Checkout Session banayein
    const session = await stripe.checkout.sessions.create({
      customer: customer.id, 
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: { name: String(plan.name) },
            unit_amount: Math.round(plan.price * 100),
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId: String(user._id),
        planId: String(planId),
        planName: String(plan.name),
        planPrice: Math.round(plan.price * 100),
        planType: String(plan.type),
        autoRenew: String(plan.autoRenew),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("STRIPE ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.checkoutSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      // 1. Duplicate check
      const existingSub = await Subscription.findOne({
        stripeSubscriptionId: session.subscription,
      });

      if (!existingSub) {
        // 2. Dates setup
        const now = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(now.getMonth() + 1);

        await Subscription.create({
          userId: session.metadata.userId,
          planId: session.metadata.planId,
          plan: session.metadata.planName,
          stripeSubscriptionId: session.subscription,
          startDate: now,
          endDate: nextMonth,
          renewalDate: nextMonth,
          planPrice: Number(session.metadata.planPrice), 
          planType: session.metadata.planType,
          autoRenew: session.metadata.autoRenew === "true",
          status: "active",
        });

        await User.findByIdAndUpdate(session.metadata.userId, {
          subscription: session.metadata.planName,
          planType: session.metadata.planType,
        });
      }
    }

    res.json({ payment_status: session.payment_status });
  } catch (error) {
    console.error("Status Error:", error);
    res.status(500).json({ message: error.message });
  }
};
