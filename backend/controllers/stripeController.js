const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Service = require('../models/Service');
const mongoose = require('mongoose');
const {
  getStripe,
  getStripeConfiguration,
  getStripeForMode,
} = require('../config/stripe');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { upsertTransaction } = require('../utils/transaction');
const { upsertSubscription } = require('../utils/subscription');
const { findBillingCapableSubscription } = require('../services/stripe/subscriptionState');
const {
  subscriptionPeriodEnd,
} = require('../services/stripe/provisioning');
const { resolveAllowedPlanType } = require('../utils/planAccess');
const {
  resolveCurrentSubscriptionEntitlements,
  summarizePaidExtraContacts,
} = require('../utils/subscriptionEntitlements');

const now = new Date();
const nextMonth = new Date();
nextMonth.setMonth(now.getMonth() + 1);

/**
 * The site's origin, with any trailing slash removed.
 *
 * The return URLs below used to be built by concatenating `process.env.FRONTEND_URL`
 * straight onto `subscription/success…`, which only produced a valid URL when the variable
 * happened to end in a slash. Set as `https://jobblo.no` it yielded
 * `https://jobblo.nosubscription/success` — Stripe rejects that, and the whole call came
 * back as a 500 with no clue why. Normalising once here means the value works either way.
 */
function resolveFrontendUrl() {
  const raw = process.env.FRONTEND_URL?.trim().replace(/\/$/, '');
  if (!raw) return { error: 'FRONTEND_URL is not set — Stripe needs absolute return URLs' };
  if (!/^https?:\/\//i.test(raw)) {
    return { error: `FRONTEND_URL must start with http(s)://, got "${raw}"` };
  }
  return { url: raw };
}

/**
 * The user's Stripe customer, created once and reused.
 *
 * Every other checkout path in this codebase already does this. The subscription path did
 * not: it called `customers.create` unconditionally, so a user who clicked "Start
 * abonnement" twice — or came back a month later — left a fresh Stripe customer behind
 * each time, and their subscriptions ended up scattered across several customer records
 * with no single place to see or cancel them.
 *
 * Now shared with the SafePay and chat checkout paths, and mode-aware: the stored id
 * is verified against Stripe before reuse, so a `cus_…` left over from the other mode
 * is replaced instead of producing a `resource_missing` 500.
 */
const {
  resolveStripeCustomer,
  customerFieldForMode,
} = require('../services/stripe/customers');
const { getStripeWebhookReadiness } = require('../services/stripe/webhookReadiness');

/**
 * How long two identical checkout requests are collapsed into one Stripe session.
 *
 * A double-tap on the mobile "Kjøp" button, or a re-submit on a slow connection, sends
 * the request twice. Both copies pass the duplicate-subscription guard below, because
 * neither has been paid yet and so neither is visible to the other — see the race note
 * on `subscriptionIdempotencyKey`. Handing Stripe the same idempotency key makes it
 * return the *same* session for the second call instead of minting a second one.
 *
 * A window rather than a bare key because Stripe remembers keys for 24 hours: a
 * customer who abandons checkout and comes back an hour later should get a fresh
 * session, not a replay of the old one. A minute is long enough to cover any plausible
 * double-submit and short enough that a deliberate retry is never blocked.
 */
const CHECKOUT_IDEMPOTENCY_WINDOW_MS = 60 * 1000;

/**
 * A key that is stable across an accidental double-submit and different across a
 * deliberate retry.
 *
 * Every component is server-derived: the authenticated user and the plan we looked up
 * ourselves. Nothing the client sent as an authority contributes to it.
 */
function subscriptionIdempotencyKey({ userId, planId }) {
  const window = Math.floor(Date.now() / CHECKOUT_IDEMPOTENCY_WINDOW_MS);
  return `sub_checkout_${userId}_${planId}_nocoupon_${window}`;
}

/** Stripe's two "you are already using this key" signals, which mean: they tapped twice. */
function isIdempotencyCollision(error) {
  return error?.code === 'idempotency_key_in_use' || error?.type === 'idempotency_error';
}

async function stripeContextForSubscription(current, userId) {
  const testMode =
    current?.stripeMode === 'test'
      ? true
      : current?.stripeMode === 'live'
        ? false
        : (await getStripeConfiguration()).testMode;
  const [stripe, user] = await Promise.all([
    getStripeForMode(testMode),
    User.findById(userId),
  ]);
  if (!user) throw new Error('Subscription owner not found');
  const live = await stripe.subscriptions.retrieve(current.stripeSubscriptionId);
  const customerId = typeof live.customer === 'string' ? live.customer : live.customer?.id;
  const expectedCustomerId = user[await customerFieldForMode(testMode)];
  if (!customerId || !expectedCustomerId || customerId !== expectedCustomerId) {
    const error = new Error('Subscription customer mismatch');
    error.code = 'subscription_customer_mismatch';
    throw error;
  }
  return { stripe, live, testMode };
}

/**
 * Start a Stripe Checkout session for a paid subscription plan.
 *
 * The request body is read for `planId` and nothing else. Price, plan type, the
 * Stripe customer and the owning user are all resolved server-side.
 */
exports.createCheckoutSession = async (req, res) => {
  let stripeConfig;
  let stripe;
  try {
    try {
      stripeConfig = await getStripeConfiguration();
      const webhookReadiness = await getStripeWebhookReadiness(stripeConfig);
      if (!webhookReadiness.ready) {
        return res.status(503).json({
          message: 'Abonnementsbetaling er ikke tilgjengelig akkurat nå. Prøv igjen senere.',
          code: 'STRIPE_WEBHOOK_NOT_READY',
        });
      }
      stripe = await getStripeForMode(stripeConfig.testMode);
    } catch (error) {
      console.error(
        'createCheckoutSession webhook preflight failed [code=%s]',
        error?.code || error?.type || 'configuration_error'
      );
      return res.status(503).json({
        message: 'Abonnementsbetaling er ikke tilgjengelig akkurat nå. Prøv igjen senere.',
        code: 'STRIPE_WEBHOOK_NOT_READY',
      });
    }
    const { planId } = req.body;
    const user = req.user;

    if (!planId) return res.status(400).json({ message: 'planId mangler' });

    // `findById` on a malformed id throws a CastError, which the catch below would
    // report as a 500 "contact support" — misleading for what is just a bad id.
    if (!mongoose.isValidObjectId(planId)) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const frontend = resolveFrontendUrl();
    if (frontend.error) {
      console.error('createCheckoutSession: %s', frontend.error);
      return res.status(500).json({
        message: 'Betaling er ikke konfigurert riktig. Kontakt support.',
        code: 'frontend_url_invalid',
      });
    }

    // 1️⃣ Get plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const allowedPlanType = resolveAllowedPlanType(user);
    if (!allowedPlanType || plan.type !== allowedPlanType) {
      return res.status(403).json({
        message: 'Denne planen er ikke tilgjengelig for kontotypen din.',
        code: 'plan_type_not_allowed',
      });
    }

    // A retired plan must not be purchasable, and this is the only place that can
    // actually enforce it. `GET /api/plans` returns inactive plans on purpose — the
    // admin plan editor reads the same public route and needs to see them — so both
    // the web and mobile plan lists filter client-side. Client-side filtering is a
    // display choice, not a rule: anyone who kept an old planId, or replayed a stale
    // request, would otherwise still be able to subscribe to a plan that was pulled.
    if (plan.isActive !== true) {
      return res.status(400).json({
        message: 'Denne planen er ikke tilgjengelig lenger. Velg en annen plan.',
        code: 'plan_inactive',
      });
    }

    // A 0 kr plan has nothing to charge. Stripe rejects a subscription line item priced at
    // zero, so this used to surface as an opaque 500 if the UI ever let it through.
    if (!plan.price || plan.price <= 0) {
      return res
        .status(400)
        .json({ message: 'Denne planen er gratis og krever ingen betaling', code: 'plan_is_free' });
    }

    // 2️⃣ Refuse a second paid subscription before anything is created at Stripe.
    //
    // This runs before the customer is resolved and before the session is created, so a
    // blocked attempt leaves nothing behind at Stripe to clean up. Both the same plan
    // and a different plan are refused: "switching" plans through this endpoint is what
    // produced two live subscriptions and one unreachable id in the first place.
    // Proration and plan switching are deliberately out of scope — the existing
    // subscription has to be managed through the subscription screen.
    const existing = await findBillingCapableSubscription(stripe, user._id);
    if (existing.blocking) {
      console.warn(
        'createCheckoutSession blocked: user %s already has a %s subscription (cancelAtPeriodEnd=%s), requested plan %s',
        String(user._id),
        existing.stripeStatus,
        existing.cancelAtPeriodEnd,
        String(planId)
      );
      return res.status(409).json({
        message:
          'Du har allerede et aktivt abonnement. Administrer det eksisterende abonnementet før du kjøper en ny plan.',
        code: 'active_subscription_exists',
      });
    }

    // Stripe owns discounts. The recurring line item always starts at the
    // server-controlled plan price, including when a promotion code makes the
    // first Checkout payment due at zero.
    const unitAmount = Math.round(plan.price * 100);

    // 5️⃣ Reuse the user's Stripe customer, creating it only on the first purchase
    const customerId = await resolveStripeCustomer(stripe, user, stripeConfig.testMode);

    // 6️⃣ Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        payment_method_types: ['card'],
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        line_items: [
          {
            price_data: {
              currency: 'nok',
              product_data: { name: plan.name },
              unit_amount: unitAmount,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${frontend.url}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontend.url}/membership`,
        metadata: {
          userId: String(user._id),
          planId: String(planId),
          planName: plan.name,
          planPrice: plan.price,
          planType: plan.type,
          autoRenew: 'true',
        },
        subscription_data: {
          metadata: {
            userId: String(user._id),
            planId: String(planId),
            planName: plan.name,
            planType: plan.type,
            autoRenew: 'true',
          },
        },
      },
      {
        // Same convention as the payout and refund calls in
        // services/payout/releasePayoutToProvider.js: money-moving Stripe calls carry
        // a key so a retry cannot duplicate them.
        idempotencyKey: subscriptionIdempotencyKey({
          userId: user._id,
          planId,
        }),
      }
    );

    res.json({ url: session.url });
  } catch (error) {
    if (isIdempotencyCollision(error)) {
      // Two copies of the same request, in flight at the same time. The other one is
      // creating the session; asking again in a moment gets it.
      console.warn('createCheckoutSession: duplicate submit for plan %s', req.body?.planId);
      return res.status(409).json({
        message: 'Betalingen er allerede under behandling. Vent et øyeblikk og prøv igjen.',
        code: 'checkout_in_progress',
      });
    }

    // A Stripe or database failure is not safe to echo verbatim to the customer.
    console.error(
      'createCheckoutSession failed [plan=%s, code=%s]',
      req.body?.planId,
      error?.code || error?.type || 'stripe_session_failed'
    );
    res.status(500).json({
      message: 'Kunne ikke starte betalingen. Prøv igjen, eller kontakt support.',
      code: error?.code || 'stripe_session_failed',
    });
  }
};

exports.checkoutSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const transaction = await Transaction.findOne({ stripeSessionId: sessionId }).lean();
    if (transaction && String(transaction.userId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Denne betalingen tilhører en annen bruker' });
    }

    if (!transaction || transaction.type !== 'subscription' || transaction.status !== 'succeeded') {
      return res.json({ payment_status: transaction?.status || 'unpaid' });
    }

    res.json({
      payment_status: 'paid',
      plan: transaction.planName,
      planType: transaction.planType,
      amount: transaction.amount,
      currency: transaction.currency || 'nok',
      discountAmount: transaction.discountAmount,
      coupon: transaction.discountCoupon,
    });
  } catch (error) {
    console.error('Status Error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createExtraContactPayment = async (req, res) => {
  try {
    const stripe = await getStripe();
    const user = req.user;
    const { serviceId } = req.body;

    // Validate required fields
    if (!serviceId) {
      return res.status(400).json({ message: 'serviceId is required' });
    }

    const resolved = await resolveCurrentSubscriptionEntitlements(user._id);
    if (!resolved?.hasPlan) {
      return res.status(403).json({
        message: 'Du trenger et aktivt abonnement for å kjøpe ekstra kontakter.',
        code: 'subscription_required',
      });
    }
    const amount = resolved?.entitlements?.perContactPrice;
    if (!resolved || !Number.isFinite(amount) || amount < 0) {
      return res.status(403).json({ message: 'Invalid subscription plan', code: 'plan_invalid' });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    // Same trailing-slash trap as the subscription checkout above: without this,
    // `FRONTEND_URL=https://jobblo.no` produced `https://jobblo.nocontact/success`.
    const frontend = resolveFrontendUrl();
    if (frontend.error) {
      console.error('createExtraContactPayment: %s', frontend.error);
      return res.status(500).json({
        message: 'Betaling er ikke konfigurert riktig. Kontakt support.',
        code: 'frontend_url_invalid',
      });
    }

    const stripeCustomerId = await resolveStripeCustomer(stripe, user);

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'nok',
            product_data: {
              name: 'Extra Contact',
              description: `Contact for: ${service.title}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],

      success_url: `${frontend.url}/contact/success?session_id={CHECKOUT_SESSION_ID}&serviceId=${serviceId}`,
      cancel_url: `${frontend.url}/services/${serviceId}`,
      metadata: {
        userId: String(user._id),
        type: 'extra_contact',
        serviceId,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Extra Contact Payment Error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.extraContactPaymentStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const transaction = await Transaction.findOne({ stripeSessionId: sessionId }).lean();
    if (transaction && String(transaction.userId) !== String(req.userId)) {
      return res.status(403).json({ message: 'Denne betalingen tilhører en annen bruker' });
    }

    if (
      !transaction ||
      transaction.type !== 'extra_contact' ||
      transaction.status !== 'succeeded'
    ) {
      return res.json({ payment_status: transaction?.status || 'unpaid' });
    }

    res.json({ payment_status: 'paid', serviceId: transaction.serviceId });
  } catch (error) {
    console.error('Extra Contact Status Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ── Subscription self-service ────────────────────────────────────────────────
//
// The support page has told users to open Innstillinger → Abonnementer and press "Si opp"
// since launch, and four other surfaces promise "si opp når som helst". Nothing in the API
// implemented it: there was no cancel endpoint, no billing-portal session, no way to stop
// a renewal short of asking support to do it in the Stripe dashboard. These three close
// that loop.
//
// Cancelling sets `cancel_at_period_end` rather than deleting the subscription, because
// the customer has already paid for the current month — killing it immediately would take
// away access they are owed. That also makes the action reversible right up to the renewal
// date, which is what `resume` is for.

/** The user's live subscription, joined with what Stripe currently believes about it. */
exports.getMySubscription = async (req, res) => {
  try {
    const resolved = await resolveCurrentSubscriptionEntitlements(req.userId);
    if (!resolved) return res.status(404).json({ message: 'Brukeren ble ikke funnet' });

    const current = resolved.subscription?.currentPlan;
    const extraTransactions = await Transaction.find({
      userId: req.userId,
      type: 'extra_contact',
      status: 'succeeded',
      refunded: { $ne: true },
    })
      .select('amount consumedAt type status refunded')
      .lean();
    const paid = summarizePaidExtraContacts(extraTransactions);
    const includedLimit = resolved.hasPlan
      ? Math.max(0, Number(resolved.entitlements.freeContact) || 0)
      : 0;
    const includedUsed = resolved.hasPlan ? Math.max(0, resolved.usage) : 0;
    const includedRemaining = Math.max(includedLimit - includedUsed, 0);

    const payload = {
      hasPlan: resolved.hasPlan,
      plan: resolved.hasPlan ? resolved.planName : null,
      planName: resolved.hasPlan ? resolved.planName : null,
      planType: resolved.planType,
      planId: resolved.hasPlan ? resolved.planId : null,
      status: current?.status || 'inactive',
      autoRenew: current?.autoRenew || false,
      startDate: current?.startDate || null,
      renewalDate: current?.renewalDate || null,
      stripeSubscriptionId: current?.stripeSubscriptionId || null,
      stripeMode: current?.stripeMode || null,
      price: resolved.hasPlan ? resolved.price : null,
      billingInterval: current?.stripeSubscriptionId ? 'month' : null,
      pendingPlan: resolved.subscription?.pendingPlan || null,
      timeline: [
        ...(resolved.subscription?.planHistory || []).map((item) => ({
          plan: item.plan,
          status: item.status,
          startDate: item.startDate,
          endDate: item.endDate,
        })),
        ...(current?.plan
          ? [{
              plan: current.plan,
              status: current.status,
              startDate: current.startDate,
              endDate: current.endDate,
            }]
          : []),
      ],
      cancelAtPeriodEnd: false,
      currentPeriodEnd: current?.renewalDate || current?.endDate || null,
      contacts: {
        includedLimit,
        includedUsed,
        includedRemaining,
        perContactPrice: resolved.hasPlan
          ? Math.max(0, Number(resolved.entitlements.perContactPrice) || 0)
          : null,
        contactUnlockMinutes: resolved.hasPlan
          ? Math.max(0, Number(resolved.entitlements.ContactUnlock) || 0)
          : null,
        ...paid,
        currency: 'nok',
      },
    };

    // Stripe is the source of truth for whether a renewal will actually happen. The local
    // document can drift — a card that failed, a cancellation made in the dashboard.
    if (current?.stripeSubscriptionId) {
      try {
        const { live, stripe } = await stripeContextForSubscription(current, req.userId);
        payload.cancelAtPeriodEnd = Boolean(live.cancel_at_period_end);
        if (live.schedule) {
          const scheduleId = typeof live.schedule === 'string' ? live.schedule : live.schedule.id;
          const liveSchedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
          payload.cancelAtPeriodEnd ||= liveSchedule.end_behavior === 'cancel';
        }
        payload.stripeStatus = live.status;
        payload.stripeMode =
          typeof live.livemode === 'boolean' ? (live.livemode ? 'live' : 'test') : current.stripeMode;
        const price = live.items?.data?.[0]?.price;
        if (Number.isInteger(price?.unit_amount)) {
          payload.price = price.unit_amount / 100;
          payload.billingCurrency = price.currency || 'nok';
        }
        payload.billingInterval = price?.recurring?.interval || payload.billingInterval;
        // On the pinned API version this moved onto the subscription ITEM, so the
        // old `live.current_period_end` read was always undefined and this branch
        // never ran. subscriptionPeriodEnd() reads both shapes.
        const periodEnd = subscriptionPeriodEnd(live);
        if (periodEnd) {
          payload.currentPeriodEnd = periodEnd;
        }
      } catch (err) {
        // A subscription Stripe no longer knows about is worth reporting as unknown rather
        // than failing the whole request — the local record is still useful.
        console.error(
          'getMySubscription: Stripe lookup failed for %s: %s',
          current.stripeSubscriptionId,
          err.message
        );
        payload.stripeStatus = 'unknown';
      }
    }

    res.json({ subscription: payload });
  } catch (error) {
    console.error('getMySubscription failed:', error.message);
    res.status(500).json({ message: 'Kunne ikke hente abonnementet ditt' });
  }
};

/** Stop the subscription renewing, keeping access until the paid period runs out. */
exports.cancelMySubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.userId });
    const current = subscription?.currentPlan;

    if (!current?.plan || current.status === 'cancelled') {
      return res.status(400).json({ message: 'Du har ingen aktivt abonnement å si opp' });
    }
    if (!current.stripeSubscriptionId) {
      return res.status(400).json({ message: 'Denne planen er gratis og har ingenting å si opp' });
    }

    const { stripe, live } = await stripeContextForSubscription(current, req.userId);
    if (live.cancel_at_period_end) {
      const periodEnd = subscriptionPeriodEnd(live);
      subscription.currentPlan.autoRenew = false;
      if (periodEnd) {
        subscription.currentPlan.renewalDate = periodEnd;
        subscription.currentPlan.endDate = periodEnd;
      }
      await subscription.save();
      return res.json({
        message: 'Abonnementet avsluttes ved periodens slutt',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd || subscription.currentPlan.renewalDate,
      });
    }
    if (live.schedule) {
      const scheduleId = typeof live.schedule === 'string' ? live.schedule : live.schedule.id;
      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
      if (
        !subscription.pendingPlan ||
        schedule.metadata?.jobbloPendingPlanId !== String(subscription.pendingPlan.planId) ||
        schedule.metadata?.jobbloUserId !== String(req.userId)
      ) {
        return res.status(409).json({
          message: 'Administrer den planlagte endringen og oppsigelsen i Stripe Portal.',
        });
      }
      await stripe.subscriptionSchedules.release(scheduleId);
      subscription.pendingPlan = undefined;
    }
    const updated = await stripe.subscriptions.update(
      current.stripeSubscriptionId,
      { cancel_at_period_end: true },
      { idempotencyKey: `jobblo_subscription_cancel_${current.stripeSubscriptionId}` }
    );

    // `status` stays 'active': they keep the plan until the period ends. What changes is
    // that it will not renew — recorded as autoRenew, which is the field that means that.
    subscription.currentPlan.autoRenew = false;
    // Same clover-era move as in getMySubscription: reading `current_period_end` off
    // the subscription always yielded undefined, so the date shown to the user was a
    // locally guessed "now + 1 month" rather than the period they actually paid for.
    const periodEnd = subscriptionPeriodEnd(updated);
    if (periodEnd) {
      subscription.currentPlan.renewalDate = periodEnd;
      subscription.currentPlan.endDate = periodEnd;
    }
    await subscription.save();

    res.json({
      message: 'Abonnementet avsluttes ved periodens slutt',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd || subscription.currentPlan.renewalDate,
    });
  } catch (error) {
    console.error('cancelMySubscription failed [user=%s]: %s', req.userId, error.message);
    res.status(500).json({ message: 'Kunne ikke si opp abonnementet. Kontakt support.' });
  }
};

/** Undo a pending cancellation, while the paid period is still running. */
exports.resumeMySubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.userId });
    const current = subscription?.currentPlan;

    if (!current?.stripeSubscriptionId) {
      return res.status(400).json({ message: 'Du har ingen abonnement å gjenoppta' });
    }

    const { stripe, live } = await stripeContextForSubscription(current, req.userId);
    if (live.status === 'canceled') {
      return res.status(409).json({
        message: 'Abonnementet er allerede avsluttet og kan ikke gjenopptas.',
      });
    }
    if (live.schedule) {
      const scheduleId = typeof live.schedule === 'string' ? live.schedule : live.schedule.id;
      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
      if (schedule.end_behavior !== 'cancel') {
        return res.status(409).json({
          message: 'Administrer det planlagte planbyttet i Stripe Portal.',
        });
      }
      await stripe.subscriptionSchedules.release(scheduleId);
      subscription.currentPlan.autoRenew = true;
      subscription.currentPlan.status = 'active';
      await subscription.save();
      return res.json({
        message: 'Oppsigelsen er fjernet. Abonnementet fortsetter.',
        cancelAtPeriodEnd: false,
      });
    }
    if (!live.cancel_at_period_end) {
      subscription.currentPlan.autoRenew = true;
      await subscription.save();
      return res.json({
        message: 'Abonnementet fortsetter som normalt',
        cancelAtPeriodEnd: false,
      });
    }
    const updated = await stripe.subscriptions.update(
      current.stripeSubscriptionId,
      { cancel_at_period_end: false },
      { idempotencyKey: `jobblo_subscription_resume_${current.stripeSubscriptionId}` }
    );

    subscription.currentPlan.autoRenew = true;
    subscription.currentPlan.status = 'active';
    await subscription.save();

    res.json({
      message: 'Abonnementet fortsetter som normalt',
      cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
    });
  } catch (error) {
    console.error('resumeMySubscription failed [user=%s]: %s', req.userId, error.message);
    res.status(500).json({ message: 'Kunne ikke gjenoppta abonnementet. Kontakt support.' });
  }
};
