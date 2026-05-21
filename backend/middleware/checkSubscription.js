const User = require("../models/User");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const Subscription = require("../models/Subscription");
const Transaction = require("../models/Transaction");
const Service = require("../models/Service");
const JobRequest = require("../models/JobRequest");
const GlobalConfig = require("../models/GlobalConfig");
const stripe = require("../config/stripe");

exports.checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { serviceId, sessionId } = req.body;

    // 1. Get User with usage info
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // --- MONTHLY RESET LOGIC ---
    const now = new Date();
    const lastReset = new Date(user.lastContactReset || user.createdAt);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (lastReset < thirtyDaysAgo) {
      user.monthlyContactUsage = 0;
      user.lastContactReset = now;
      await user.save();
    }

    // --- STRIPE SESSION VERIFICATION (Bypass if just paid for extra contact) ---
    if (serviceId) {
      const paidContact = await Transaction.findOne({
        userId: userId,
        serviceId: serviceId,
        status: "succeeded",
        type: "extra_contact",
      });
      if (paidContact) {
        return next();
      }
    }

    // 2. Check Subscription Plan
    const subscription = await Subscription.findOne({ userId });
    // Default to Standard if no subscription found
    const currentPlanName = subscription?.currentPlan?.plan || "Standard";
    const currentPlanType = user.planType || "private";

    // 3. Get Plan Details
    const planDoc = await SubscriptionPlan.findOne({
      name: currentPlanName,
      type: currentPlanType,
      isActive: true,
    });

    if (!planDoc) {
      return res.status(403).json({ message: "Invalid subscription plan" });
    }

    const { freeContact, perContactPrice, ContactUnlock } =
      planDoc.entitlements;

    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
          return next();
        }
      } catch (err) {
        console.error("Stripe verification error:", err.message);
      }
    }

    // --- FREE JOBS UNDER 10,000 NOK RULE (Private Users Only) ---
    let isFreeUnder10k = false;
    if (serviceId && currentPlanType === "private") {
      const freeUnder10kConfig = await GlobalConfig.findOne({
        key: "FREE_PRIVATE_JOBS_UNDER_10000",
      });

      if (freeUnder10kConfig && freeUnder10kConfig.value === true) {
        const service = await Service.findById(serviceId);
        if (service && service.price < 10000) {
          req.isFreeContact = true; // Mark as free for controller
          isFreeUnder10k = true;
          return next(); // Free access for jobs under 10k for private users
        }
      }
    }

    // 5. Check Monthly Limit
    const currentUsage = user.monthlyContactUsage || 0;
    const hasFreeContactsLeft = currentUsage < freeContact;

    if (hasFreeContactsLeft) {
      return next(); // Still has monthly free contacts
    }

    // 6. Contact Unlock Cooldown (ONLY applies after free contacts are exhausted)
    if (typeof ContactUnlock === "number" && ContactUnlock > 0) {
      const lastRequest = await JobRequest.findOne({ customerId: userId }).sort(
        {
          createdAt: -1,
        },
      );

      if (lastRequest) {
        const unlockAt = new Date(
          lastRequest.createdAt.getTime() + ContactUnlock * 60 * 1000,
        );
        const now = new Date();

        if (now < unlockAt) {
          const minutesLeft = Math.ceil(
            (unlockAt.getTime() - now.getTime()) / 60000,
          );
          return res.status(403).json({
            message: `Du må vente ${ContactUnlock} minutter mellom hver forespørsel. Neste åpner om ${minutesLeft} minutter.`,
            isDelayed: true,
            unlockAt: unlockAt.toISOString(),
          });
        }
      }
    }

    // If we are here, monthly limit is reached AND cooldown is over (if any)
    return res.status(402).json({
      message: "Du har nådd din månedlige grense for kontakter.",
      paymentRequired: true,
      upgradeRequired: true,
      limit: freeContact,
      usage: currentUsage,
      perContactPrice,
    });
  } catch (error) {
    console.error("checkSubscription Error:", error);
    res.status(500).json({ message: error.message });
  }
};
