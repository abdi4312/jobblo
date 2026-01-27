const Coupon = require("../models/Coupon");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const stripe = require("../config/stripe");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const calculateDiscount = require("../utils/calculateDiscount");
const { upsertTransaction } = require("../utils/transaction");
const { upsertSubscription } = require("../utils/subscription");

const now = new Date();
const nextMonth = new Date();
nextMonth.setMonth(now.getMonth() + 1);

exports.createCheckoutSession = async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
    const user = req.user;

    // 1️⃣ Get plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // 2️⃣ Determine final price
    let finalPrice = plan.price; // default price
    let appliedCoupon = null;
    let couponId = null; // ✅ declare here

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (!coupon) return res.status(404).json({ message: "Coupon not found" });
      if (!coupon.active)
        return res.status(400).json({ message: "Coupon is not active" });
      if (coupon.expiresDate < new Date())
        return res.status(400).json({ message: "Coupon expired" });

      // calculate discounted price
      const pricing = calculateDiscount(plan.price, coupon);
      finalPrice = pricing.finalPrice;
      appliedCoupon = coupon.code;
      couponId = coupon._id; // ✅ store coupon ObjectId
    }

    // 3️⃣ Create Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user._id) },
    });

    // 4️⃣ Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: { name: plan.name },
            unit_amount: Math.round(finalPrice * 100),
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}`,
      metadata: {
        userId: String(user._id),
        planId: String(planId),
        planName: plan.name,
        planPrice: plan.price,
        discountAmount: plan.price - finalPrice,
        planType: plan.type,
        autoRenew: String(plan.autoRenew),
        coupon: appliedCoupon || "",
        couponId: couponId ? String(couponId) : "", // ✅ safe
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("STRIPE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.checkoutSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return res.json({ payment_status: session.payment_status });
    }

    const metadata = session.metadata || {};
    const stripeSub = session.subscription;

    const userId = metadata.userId;
    const planId = metadata.planId;
    const planName = metadata.planName;
    const planType = metadata.planType;

    const discountAmount = Number(metadata.discountAmount || 0);
    const discountCoupon = metadata.coupon || null;
    const couponId = metadata.couponId || null;
    const autoRenew = metadata.autoRenew === "true";

    const amount = session.amount_total
      ? session.amount_total / 100
      : 0;

    // ===============================
    // 🔹 TRANSACTION (UTIL)
    // ===============================
    await upsertTransaction({
      userId,
      planId,
      planName,
      planType,
      stripeSessionId: sessionId,
      amount,
      currency: session.currency || "nok",
      status: "succeeded",
      type: "subscription",
      discountAmount,
      discountCoupon,
      coupon: couponId,
    });

    // ===============================
    // 🔹 SUBSCRIPTION (UTIL)
    // ===============================
    const subscription = await upsertSubscription({
      userId,
      planId,
      planName,
      planType,
      stripeSubscriptionId: stripeSub.id,
      autoRenew,
      discountAmount,
      discountCoupon,
      couponId,
    });

    // ===============================
    // 🔹 USER UPDATE
    // ===============================
    await User.findByIdAndUpdate(userId, {
      subscription: planName,
      planType,
    });

    // ===============================
    // 🔹 COUPON USAGE (SAFE)
    // ===============================
    if (couponId) {
      await Coupon.findByIdAndUpdate(couponId, {
        $addToSet: { usedBy: userId },
      });
    }

    res.json({
      payment_status: "paid",
      plan: subscription.currentPlan.plan,
    });
  } catch (error) {
    console.error("Status Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.createExtraContactPayment = async (req, res) => {
  try {
    const user = req.user;
    const { amount, serviceId, providerId } = req.body;

    // Validate required fields
    if (!amount || !serviceId || !providerId) {
      return res
        .status(400)
        .json({ message: "Amount, serviceId, and providerId are required" });
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user._id) },
      });
      stripeCustomerId = customer.id;
      await User.findByIdAndUpdate(user._id, { stripeCustomerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: { name: "Extra Contact" },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],

      success_url: `${process.env.FRONTEND_URL}contact/success?session_id={CHECKOUT_SESSION_ID}&serviceId=${serviceId}&providerId=${providerId}`,
      cancel_url: `${process.env.FRONTEND_URL}`,
      metadata: {
        userId: String(user._id),
        type: "extra_contact",
        serviceId,
        providerId,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
