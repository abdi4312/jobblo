const mongoose = require('mongoose');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const GlobalConfig = require('../models/GlobalConfig');

/**
 * No Stripe client is constructed here any more.
 *
 * This middleware guards POST /api/orders/request and POST /api/chats/create, and it
 * used to call getStripe() unconditionally on the first line. That made the Stripe
 * configuration a hard dependency of applying for a job: turning on the
 * STRIPE_TEST_MODE toggle without a test key set threw here and returned 500 for
 * every application in the product, not just for checkout. Entitlements are read
 * from Jobblo's own records now, so a Stripe misconfiguration can no longer take the
 * job flow down with it.
 */
exports.checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { serviceId } = req.body;

    // 1. Get User with usage info
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // --- MONTHLY RESET LOGIC ---
    const now = new Date();
    const lastReset = new Date(user.lastContactReset || user.createdAt);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (lastReset < thirtyDaysAgo) {
      user.monthlyContactUsage = 0;
      user.lastContactReset = now;
      await user.save();
    }

    // --- PAID EXTRA-CONTACT ENTITLEMENT ---
    //
    // Claimed atomically: the filter requires `consumedAt: null` and the update sets
    // it, so exactly one of two concurrent applications can win. Previously this was
    // a bare findOne with no consumption at all, which made a single purchase an
    // unlimited permanent unlock for that service.
    //
    // Released again below if the request it was claimed for does not succeed, so a
    // failed application does not silently burn something the user paid for.
    // `serviceId` is untyped body input and reaches this filter before the controller
    // validates it. An operator object such as {"$ne": null} would otherwise match an
    // entitlement bought for a DIFFERENT service and consume it.
    if (serviceId && typeof serviceId === 'string' && mongoose.Types.ObjectId.isValid(serviceId)) {
      const claimed = await Transaction.findOneAndUpdate(
        {
          userId,
          serviceId,
          status: 'succeeded',
          type: 'extra_contact',
          consumedAt: null,
        },
        { $set: { consumedAt: new Date() } },
        { new: true, sort: { createdAt: 1 } }
      );

      if (claimed) {
        req.consumedEntitlementId = claimed._id;
        // This contact was PAID for, so it must not also spend a free monthly one.
        // The free-under-10k branch below sets this flag; the paid branch did not, so
        // buying an extra contact charged the user cash AND incremented their counter.
        req.isFreeContact = true;
        res.on('finish', () => {
          if (res.statusCode >= 400) {
            Transaction.updateOne({ _id: claimed._id }, { $set: { consumedAt: null } }).catch(
              (err) =>
                console.error('Could not release extra-contact entitlement: %s', err.message)
            );
          }
        });
        return next();
      }
    }

    // 2. Check Subscription Plan
    const subscription = await Subscription.findOne({ userId });
    // Default to Standard if no subscription found
    const currentPlanName = subscription?.currentPlan?.plan || 'Standard';
    const currentPlanType = user.planType || 'private';

    // 3. Get Plan Details
    let planDoc = await SubscriptionPlan.findOne({
      name: currentPlanName,
      type: currentPlanType,
      isActive: true,
    });

    // Fallback: if the exact plan name doesn't exist for this type
    // (e.g. company users default to "Standard" but business plans are
    // Start/Pro/Premium), use the cheapest active plan of the same type.
    if (!planDoc) {
      planDoc = await SubscriptionPlan.findOne({
        type: currentPlanType,
        isActive: true,
      }).sort({ price: 1 });
    }

    if (!planDoc) {
      return res.status(403).json({ message: 'Invalid subscription plan' });
    }

    const { freeContact, perContactPrice, ContactUnlock } = planDoc.entitlements;

    // ── Removed: raw Stripe sessionId bypass ─────────────────────────────────
    //
    // This used to retrieve whatever `sessionId` the request body carried and call
    // next() if Stripe reported it paid. It never checked that the session belonged
    // to the caller, that it was an extra-contact purchase rather than any other
    // payment, that it matched this service, or that it had already been redeemed —
    // so ANY paid session id, including the user's own subscription checkout, granted
    // unlimited quota bypass simply by being replayed in the body.
    //
    // The entitlement is Jobblo's own Transaction record, claimed above. That row is
    // written only by verified Stripe events, is scoped to (userId, serviceId, type),
    // and is consumed exactly once.

    // --- FREE JOBS UNDER 10,000 NOK RULE (Private Users Only) ---
    let isFreeUnder10k = false;
    if (serviceId && currentPlanType === 'private') {
      const freeUnder10kConfig = await GlobalConfig.findOne({
        key: 'FREE_PRIVATE_JOBS_UNDER_10000',
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
    if (typeof ContactUnlock === 'number' && ContactUnlock > 0) {
      const lastRequest = await JobRequest.findOne({ customerId: userId }).sort({
        createdAt: -1,
      });

      if (lastRequest) {
        const unlockAt = new Date(lastRequest.createdAt.getTime() + ContactUnlock * 60 * 1000);
        const now = new Date();

        if (now < unlockAt) {
          const minutesLeft = Math.ceil((unlockAt.getTime() - now.getTime()) / 60000);
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
      message: 'Du har nådd din månedlige grense for kontakter.',
      paymentRequired: true,
      upgradeRequired: true,
      limit: freeContact,
      usage: currentUsage,
      perContactPrice,
    });
  } catch (error) {
    console.error('checkSubscription Error:', error);
    res.status(500).json({ message: error.message });
  }
};
