const transaction = require("../utils/transaction");
const Chat = require("../models/ChatMessage");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const Subscription = require("../models/Subscription");
const Transaction = require("../models/Transaction");
const Service = require("../models/Service");
const stripe = require("../config/stripe");

exports.checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { serviceId, sessionId } = req.body;

    // --- STRIPE SESSION VERIFICATION (Bypass all limits if just paid) ---
    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
          return next();
        }

        const metadata = session.metadata || {};

        await transaction.upsertTransaction({
          userId: metadata.userId || userId,
          serviceId: metadata.serviceId || null,

          planId: metadata.planId || null,
          planName: metadata.planName || null,
          planType: metadata.planType || null,

          stripeSessionId: sessionId,
          amount: session.amount_total ? session.amount_total / 100 : 0,

          currency: session.currency || "nok",
          status: "succeeded",
          type: "extra_contact",

          discountAmount: Number(metadata.discountAmount || 0),
          discountCoupon: metadata.coupon || null,
          coupon: metadata.couponId || null,
        });

        return next();
      } catch (err) {
        console.error("Stripe verification error:", err.message);
      }
    }

    // 1. Check Subscription Plan
    const subscription = await Subscription.findOne({ userId });
    if (!subscription || !subscription.currentPlan) {
      return res.status(403).json({ message: "No subscription found" });
    }

    const { plan, endDate, planType, startDate } = subscription.currentPlan; // 👈 startDate nikalein

    if (plan !== "Standard" && new Date(endDate) < new Date()) {
      return res.status(403).json({ message: "Subscription expired" });
    }

    const planDoc = await SubscriptionPlan.findOne({
      name: plan,
      type: planType,
      isActive: true,
    });

    if (!planDoc) {
      return res.status(403).json({ message: "Invalid subscription plan" });
    }

    const { freeContact, perContactPrice, maxContact, ContactUnlock } =
      planDoc.entitlements;

    // 1a. Per-service unlock window: wait ContactUnlock minutes after job posted
    if (serviceId && typeof ContactUnlock === "number") {
      const service = await Service.findById(serviceId).select("createdAt");
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      const unlockAt = new Date(
        service.createdAt.getTime() + ContactUnlock * 60 * 1000,
      );
      if (Date.now() < unlockAt.getTime()) {
        const minutesLeft = Math.ceil(
          (unlockAt.getTime() - Date.now()) / 60000,
        );
        return res
          .status(403)
          .json({ message: `Contact unlocks in ${minutesLeft} minutes` });
      }
    }

    // 2. Count used contacts (Reset Logic)
    // Hum sirf wahi chats count karenge jo current plan ke startDate ke baad hui hain
    const countFilterDate =
      new Date(startDate) > new Date(Date.now() - 72 * 60 * 60 * 1000)
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const usedContacts = await Chat.countDocuments({
      clientId: userId,
      createdAt: { $gte: countFilterDate }, // 👈 Limit reset here
    });

    // 3. Check if user already paid for THIS specific contact
    if (serviceId) {
      const paidContact = await Transaction.findOne({
        userId: userId,
        serviceId: serviceId,
        status: "succeeded",
        type: "extra_contact",
      });
      if (paidContact) return next();
    }

    // 🚫 Limits Check
    if (usedContacts >= maxContact) {
      return res
        .status(403)
        .json({ message: "Maximum monthly contacts reached" });
    }

    if (usedContacts < freeContact) {
      // 👈 Change: < instead of <= to be precise
      return next();
    }

    // (Optional) keep legacy last-chat unlock? Commented out to prioritize per-service unlock
    // const lastChat = await Chat.findOne(
    //   { clientId: userId },
    //   { createdAt: 1 },
    //   { sort: { createdAt: -1 } },
    // );
    // if (lastChat) {
    //   const unlockAt = new Date(lastChat.createdAt.getTime() + ContactUnlock * 60 * 1000);
    //   if (new Date() < unlockAt) {
    //     return res.status(403).json({
    //       message: `Next contact unlocks in ${ContactUnlock} minutes`,
    //     });
    //   }
    // }

    // 💳 PAYMENT REQUIRED
    return res.status(402).json({
      message: "Free contacts finished",
      paymentRequired: true,
      amount: perContactPrice,
      currency: "NOK",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
