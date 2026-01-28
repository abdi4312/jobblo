const Subscription = require("../models/Subscription");
const User = require("../models/User");
const stripe = require("../config/stripe");
const SubscriptionPlan = require("../models/SubscriptionPlan");

const now = new Date();
const nextMonth = new Date();
nextMonth.setMonth(now.getMonth() + 1);

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
      success_url: `${process.env.FRONTEND_URL}subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}`,
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

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return res.json({ payment_status: session.payment_status });
    }

    const stripeSub = session.subscription;
    const userId = session.metadata.userId;
    const newPlanName = session.metadata.planName;
    const newPlanType = session.metadata.planType;

    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // 🔁 Get or create user subscription doc
    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      // Create new subscription with currentPlan already set
      subscription = new Subscription({
        userId,
        currentPlan: {
          planId: session.metadata.planId,
          plan: newPlanName,
          planType: newPlanType,
          stripeSubscriptionId: stripeSub.id,
          startDate: now,
          endDate: nextMonth,
          renewalDate: nextMonth,
          autoRenew: session.metadata.autoRenew === "true",
          status: "active",
        },
        planHistory: [],
      });
    } else {
      // ✅ Only push to history if plan actually changes
      const isPlanChanged =
        !subscription.currentPlan ||
        !subscription.currentPlan.plan ||
        subscription.currentPlan.plan !== newPlanName;

      if (isPlanChanged && subscription.currentPlan && subscription.currentPlan.plan) {
        subscription.planHistory.push({
          planId: subscription.currentPlan.planId || null,
          plan: subscription.currentPlan.plan,
          planType: subscription.currentPlan.planType,
          startDate: subscription.currentPlan.startDate || now,
          endDate: now,
          stripeSubscriptionId:
            subscription.currentPlan.stripeSubscriptionId || null,
          status: "expired",
        });
      }

      // 🆕 Update current plan
      subscription.currentPlan = {
        planId: session.metadata.planId,
        plan: newPlanName,
        planType: newPlanType,
        stripeSubscriptionId: stripeSub.id,
        startDate: now,
        endDate: nextMonth,
        renewalDate: nextMonth,
        autoRenew: session.metadata.autoRenew === "true",
        status: "active",
      };
    }

    await subscription.save();
    await User.findByIdAndUpdate(session.metadata.userId, {
      subscription: session.metadata.planName,
      planType: session.metadata.planType,
    });
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
      return res.status(400).json({ message: "Amount, serviceId, and providerId are required" });
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
      cancel_url: `${process.env.FRONTEND_URL}contact/cancel`,
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

exports.createUrgentPayment = async (req, res) => {
  try {
    const { serviceId } = req.body;
    const user = req.user;

    if (!serviceId) {
      return res.status(400).json({ message: "Service ID is required" });
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user._id) },
    });

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: { 
              name: "Haster - Umiddelbar kontakt",
              description: "Lås opp øyeblikkelig kontakt for alle brukere"
            },
            unit_amount: 2000, // 20 NOK
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}service/urgent/success?session_id={CHECKOUT_SESSION_ID}&serviceId=${serviceId}`,
      cancel_url: `${process.env.FRONTEND_URL}mine-annonser`,
      metadata: {
        userId: String(user._id),
        type: "urgent_feature",
        serviceId,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// New endpoint for initial urgent payment (before service creation)
exports.createUrgentPaymentInitial = async (req, res) => {
  try {
    const user = req.user;

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user._id) },
    });

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: { 
              name: "Haster - Umiddelbar kontakt",
              description: "Lås opp øyeblikkelig kontakt for alle brukere"
            },
            unit_amount: 2000, // 20 NOK
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}service/urgent/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}mine-annonser`,
      metadata: {
        userId: String(user._id),
        type: "urgent_feature_initial",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.urgentPaymentSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;
    const jobData = req.body;

    if (!session_id) {
      return res.status(400).json({ message: "Missing session_id" });
    }

    if (!jobData || Object.keys(jobData).length === 0) {
      return res.status(400).json({ message: "Missing job data" });
    }

    // Verify payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid") {
      // Create the service with urgent flag
      const Service = require("../models/Service");
      const newService = new Service({
        ...jobData,
        urgent: true // Mark as urgent since payment is complete
      });
      
      await newService.save();

      return res.json({ 
        success: true, 
        message: "Service created and marked as urgent successfully",
        serviceId: newService._id
      });
    }

    res.status(400).json({ message: "Payment not completed" });
  } catch (error) {
    console.error("Urgent payment success error:", error);
    res.status(500).json({ message: error.message });
  }
};