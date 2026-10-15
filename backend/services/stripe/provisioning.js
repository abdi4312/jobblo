const Coupon = require('../../models/Coupon');
const Subscription = require('../../models/Subscription');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { upsertTransaction } = require('../../utils/transaction');
const { upsertSubscription } = require('../../utils/subscription');
const { notify } = require('../../services/notifications');
const { getStripe, getStripeForMode } = require('../../config/stripe');
const { retrieveLiveSubscription, isBillingCapableStripeStatus } = require('./subscriptionState');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const { resolveAllowedPlanType } = require('../../utils/planAccess');
const { customerFieldForMode } = require('./customers');

function promotionCodeFromSession(session) {
  const discount = session?.discounts?.find((item) => item?.promotion_code);
  const promotionCode = discount?.promotion_code;
  return promotionCode && typeof promotionCode === 'object' ? promotionCode.code || null : null;
}

async function finalizedCheckoutSession(session) {
  if (
    !session?.id ||
    (!session?.discounts?.length && !(session.total_details?.amount_discount > 0))
  ) {
    return session;
  }
  const stripe =
    typeof session.livemode === 'boolean'
      ? await getStripeForMode(!session.livemode)
      : await getStripe();
  return stripe.checkout.sessions.retrieve(session.id, {
    expand: ['discounts.promotion_code'],
  });
}

/**
 * Provisioning for the two non-SafePay purchase types.
 *
 * These bodies used to live inside the two "did the browser come back?" status
 * endpoints, which meant a customer who closed the tab at Stripe was charged and
 * provisioned nothing, permanently, with no reconciliation path. Extracted here so
 * the webhook and the redirect run the *same* code — the same arrangement
 * confirmPaidSession already has on the SafePay side.
 *
 * Every function here must be safe to run twice: the webhook and the redirect race
 * by design, and Stripe replays events.
 */

/**
 * The subscription's current period end.
 *
 * Stripe moved this off Subscription and onto SubscriptionItem in the Basil-era API
 * versions. On our pinned 2025-12-15.clover `sub.current_period_end` is always
 * undefined, so both readers in stripeController silently took their `if (…)` false
 * branch and the cancellation date shown to users was a locally guessed "now + 1
 * month" rather than Stripe's real one. Read both shapes so this stays correct
 * across a version change in either direction.
 */
function subscriptionPeriodEnd(sub) {
  const ts = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

/** Stripe sometimes expands an object and sometimes sends a bare id. Accept both. */
function idOf(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

function invoiceSubscriptionId(invoice) {
  return (
    idOf(invoice?.subscription) ||
    idOf(invoice?.parent?.subscription_details?.subscription) ||
    idOf(invoice?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription)
  );
}

/**
 * Refuse to point a user's subscription record at a new Stripe subscription while the
 * one it currently names is still able to bill them.
 *
 * `upsertSubscription` overwrites `currentPlan.stripeSubscriptionId` wholesale. That is
 * correct for a replay (same id) and for a genuine re-subscribe after cancellation (old
 * id is dead), but it is destructive in one case: the stored id names a *different*
 * subscription that Stripe is still invoicing. Overwriting then leaves that first
 * subscription billing every month with nothing in Jobblo referring to it —
 * `cancelMySubscription`, `applySubscriptionUpdated` and `applySubscriptionDeleted` all
 * find their subscription through the stored id, so it becomes unreachable and
 * uncancellable from inside the product.
 *
 * `createCheckoutSession` now blocks this at the source, but a session created before
 * that guard existed can still be paid, a checkout link can sit in a browser tab for
 * hours, and two simultaneous unpaid sessions can still both be completed. So the
 * destructive write is also refused here, where the money has already moved.
 *
 * The transaction row is written before this runs and is deliberately kept: the customer
 * was charged, and that has to be on record for anyone reconciling or refunding it. What
 * is withheld is only the overwrite.
 *
 * @throws when Stripe cannot be reached — the caller's contract is that a thrown error
 *   releases the webhook claim so Stripe retries, which is right for a transient fault.
 * @returns {Promise<{ conflict: boolean, storedStripeSubscriptionId?: string, storedStripeStatus?: string }>}
 */
async function detectConflictingLiveSubscription({ userId, stripeSubscriptionId }) {
  // Nothing to protect if the incoming session has no subscription id to write.
  if (!stripeSubscriptionId) return { conflict: false };

  const record = await Subscription.findOne({ userId });
  const storedId = record?.currentPlan?.stripeSubscriptionId || null;

  // No stored id, or the same one: this is a first purchase or a replay. Both are safe.
  if (!storedId || storedId === stripeSubscriptionId) return { conflict: false };

  const stripe = await getStripe();
  const live = await retrieveLiveSubscription(stripe, storedId);

  // Stripe does not know it — stale, or from the other mode. Safe to replace.
  if (!live.found) return { conflict: false };

  const storedStripeStatus = live.subscription.status;
  if (!isBillingCapableStripeStatus(storedStripeStatus)) return { conflict: false };

  return { conflict: true, storedStripeSubscriptionId: storedId, storedStripeStatus };
}

/**
 * Activate a subscription from a paid Checkout session.
 *
 * `session` must come from Stripe (webhook payload or a server-side retrieve),
 * never from the client — every value below is trusted.
 */
async function provisionSubscriptionFromSession(session) {
  const finalizedSession = await finalizedCheckoutSession(session);
  const metadata = finalizedSession.metadata || {};

  const userId = metadata.userId;
  if (!userId) return { ok: false, reason: 'missing_user_metadata' };

  const planId = metadata.planId;
  const planName = metadata.planName;
  const planType = metadata.planType;

  const [plan, user] = await Promise.all([
    SubscriptionPlan.findById(planId),
    User.findById(userId),
  ]);
  if (!plan || plan.type !== planType) return { ok: false, reason: 'plan_metadata_mismatch' };
  if (!user || resolveAllowedPlanType(user) !== plan.type) {
    return { ok: false, reason: 'plan_type_not_allowed' };
  }
  if (
    finalizedSession.mode !== 'subscription' ||
    !['paid', 'no_payment_required'].includes(finalizedSession.payment_status) ||
    typeof finalizedSession.livemode !== 'boolean' ||
    finalizedSession.currency?.toLowerCase() !== 'nok' ||
    !Number.isSafeInteger(finalizedSession.amount_total) ||
    finalizedSession.amount_total < 0
  ) {
    return { ok: false, reason: 'checkout_payment_mismatch' };
  }
  const expectedUnitAmount = Math.round(Number(plan.price) * 100);
  if (
    !Number.isSafeInteger(expectedUnitAmount) ||
    expectedUnitAmount <= 0 ||
    finalizedSession.amount_total > expectedUnitAmount
  ) {
    return { ok: false, reason: 'checkout_payment_mismatch' };
  }

  const discountAmount = Number(finalizedSession.total_details?.amount_discount || 0) / 100;
  const discountCoupon = promotionCodeFromSession(finalizedSession);
  const couponId = null;
  const autoRenew = metadata.autoRenew !== 'false';
  const livemode = typeof finalizedSession.livemode === 'boolean' ? finalizedSession.livemode : null;

  const amount = Number(finalizedSession.amount_total || 0) / 100;
  const stripeSubscriptionId = idOf(finalizedSession.subscription);
  if (!stripeSubscriptionId) return { ok: false, reason: 'missing_stripe_subscription' };
  const stripe = livemode === null ? await getStripe() : await getStripeForMode(!livemode);
  const liveSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const items = liveSubscription.items?.data || [];
  const subscriptionPrice = items[0]?.price;
  const expectedCustomerId = user[await customerFieldForMode(!livemode)];
  if (
    liveSubscription.id !== stripeSubscriptionId ||
    !['active', 'trialing'].includes(liveSubscription.status) ||
    items.length !== 1 ||
    !subscriptionPrice ||
    subscriptionPrice.currency?.toLowerCase() !== 'nok' ||
    subscriptionPrice.unit_amount !== expectedUnitAmount ||
    subscriptionPrice.recurring?.interval !== 'month' ||
    idOf(finalizedSession.customer) !== idOf(liveSubscription.customer) ||
    !expectedCustomerId ||
    idOf(liveSubscription.customer) !== expectedCustomerId ||
    (liveSubscription.metadata?.userId &&
      liveSubscription.metadata.userId !== String(userId)) ||
    (liveSubscription.metadata?.planId &&
      liveSubscription.metadata.planId !== String(planId)) ||
    (typeof liveSubscription.livemode === 'boolean' &&
      typeof livemode === 'boolean' &&
      liveSubscription.livemode !== livemode)
  ) {
    return { ok: false, reason: 'stripe_subscription_mismatch' };
  }
  const subscriptionMode =
    typeof liveSubscription.livemode === 'boolean'
      ? liveSubscription.livemode
        ? 'live'
        : 'test'
      : livemode === null
        ? undefined
        : livemode
          ? 'live'
          : 'test';

  // Keyed on the unique stripeSessionId, so a replay updates in place.
  await upsertTransaction({
    userId,
    planId,
    planName,
    planType,
    stripeSessionId: finalizedSession.id,
    amount,
    currency: finalizedSession.currency || 'nok',
    status: 'succeeded',
    type: 'subscription',
    livemode,
    discountAmount,
    discountCoupon,
    coupon: couponId,
  });

  const conflict = await detectConflictingLiveSubscription({ userId, stripeSubscriptionId });
  if (conflict.conflict) {
    // Ids are Stripe object references, not credentials, and this is the only record an
    // admin has to work from — both subscriptions have to be named or the duplicate
    // cannot be found and cancelled. No keys, secrets or card data are logged.
    console.error(
      'provisionSubscriptionFromSession: refusing to overwrite subscription for user %s — stored %s is still %s at Stripe, incoming %s from session %s was NOT applied; the customer may now have two live subscriptions and needs manual review',
      String(userId),
      conflict.storedStripeSubscriptionId,
      conflict.storedStripeStatus,
      stripeSubscriptionId,
      session.id
    );
    return { ok: false, reason: 'conflicting_live_subscription' };
  }

  const subscription = await upsertSubscription({
    userId,
    planId,
    planName,
    planType,
    stripeSubscriptionId,
    stripeMode: subscriptionMode,
    periodEnd: subscriptionPeriodEnd(liveSubscription),
    autoRenew,
    discountAmount,
    discountCoupon,
    couponId,
  });

  await User.findByIdAndUpdate(userId, { subscription: planName, planType });

  if (couponId) {
    // $addToSet, so a replay does not record a second use.
    await Coupon.findByIdAndUpdate(couponId, { $addToSet: { usedBy: userId } });
  }

  return { ok: true, subscription, amount, planType, discountAmount, discountCoupon };
}

/** Record a paid one-off "extra contact" purchase. */
async function provisionExtraContactFromSession(session) {
  const { userId, serviceId, type } = session.metadata || {};

  if (type !== 'extra_contact') return { ok: false, reason: 'wrong_type' };
  if (!userId || !serviceId) return { ok: false, reason: 'missing_metadata' };

  const transaction = await upsertTransaction({
    userId,
    serviceId,
    stripeSessionId: session.id,
    amount: session.amount_total ? session.amount_total / 100 : 0,
    currency: session.currency || 'nok',
    status: 'succeeded',
    type: 'extra_contact',
    livemode: typeof session.livemode === 'boolean' ? session.livemode : null,
  });

  return { ok: true, transaction, serviceId };
}

/**
 * A renewal was paid. Without this the database only ever knew about month one —
 * every subsequent charge was invisible.
 */
async function applyInvoicePaid(invoice) {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return { ok: false, reason: 'not_a_subscription_invoice' };

  const subscription = await Subscription.findOne({
    'currentPlan.stripeSubscriptionId': stripeSubscriptionId,
  });
  if (!subscription) return { ok: false, reason: 'subscription_not_found' };

  const stripe = typeof invoice.livemode === 'boolean'
    ? await getStripeForMode(!invoice.livemode)
    : await getStripe();
  const canonical = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const periodEnd =
    subscriptionPeriodEnd(canonical) ||
    subscriptionPeriodEnd(invoice.lines?.data?.[0]) ||
    (invoice.period_end ? new Date(invoice.period_end * 1000) : null);

  // A renewal has no Checkout session. Transaction.stripeSessionId is unique and
  // required, so the invoice id stands in for it — it is equally unique and equally
  // stable across retries, which is all the idempotency guard needs.
  await upsertTransaction({
    userId: subscription.userId,
    planId: subscription.currentPlan.planId,
    planName: subscription.currentPlan.plan,
    planType: subscription.currentPlan.planType,
    stripeSessionId: invoice.id,
    amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
    currency: invoice.currency || 'nok',
    status: 'succeeded',
    type: 'subscription',
    livemode: typeof invoice.livemode === 'boolean' ? invoice.livemode : null,
  });

  if (['active', 'trialing'].includes(canonical.status)) {
    subscription.currentPlan.status = 'active';
    subscription.currentPlan.pastDueSince = undefined;
    if (periodEnd) {
      subscription.currentPlan.renewalDate = periodEnd;
      subscription.currentPlan.endDate = periodEnd;
    }
    await subscription.save();
  }

  return { ok: true, subscription };
}

/**
 * A renewal charge failed.
 *
 * Deliberately does NOT revoke access. Stripe retries on the account's dunning
 * schedule, and cutting a customer off on the first failed attempt punishes
 * someone whose card merely needed re-authorisation. Entitlements are revoked by
 * customer.subscription.updated when Stripe itself gives up and moves the
 * subscription to past_due/unpaid.
 */
async function applyInvoicePaymentFailed(invoice) {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return { ok: false, reason: 'not_a_subscription_invoice' };

  const stripe = typeof invoice.livemode === 'boolean'
    ? await getStripeForMode(!invoice.livemode)
    : await getStripe();
  const canonicalInvoice = await stripe.invoices.retrieve(invoice.id);
  if (canonicalInvoice.status === 'paid') {
    return applyInvoicePaid(canonicalInvoice);
  }
  const subscription = await Subscription.findOne({
    'currentPlan.stripeSubscriptionId': stripeSubscriptionId,
  });
  if (!subscription) return { ok: true, ignored: 'subscription_not_found' };

  const canonicalSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  await upsertTransaction({
    userId: subscription.userId,
    planId: subscription.currentPlan.planId,
    planName: subscription.currentPlan.plan,
    planType: subscription.currentPlan.planType,
    stripeSessionId: invoice.id,
    amount: canonicalInvoice.amount_due ? canonicalInvoice.amount_due / 100 : 0,
    currency: canonicalInvoice.currency || 'nok',
    status: 'failed',
    type: 'subscription',
    livemode: typeof canonicalInvoice.livemode === 'boolean' ? canonicalInvoice.livemode : null,
  });

  if (['past_due', 'unpaid', 'incomplete'].includes(canonicalSubscription.status)) {
    if (subscription.currentPlan.status !== 'past_due') {
      subscription.currentPlan.pastDueSince = new Date();
    }
    subscription.currentPlan.status = 'past_due';
    await subscription.save();
  }

  if (!['past_due', 'unpaid', 'incomplete'].includes(canonicalSubscription.status)) {
    return { ok: true, subscription, staleFailure: true };
  }
  await notify({
    userId: subscription.userId,
    type: 'payment',
    content: 'Betalingen for abonnementet ditt mislyktes. Oppdater betalingskortet ditt.',
    event: 'subscription_payment_failed',
    payload: { subscriptionId: String(subscription._id) },
  });

  return { ok: true, subscription };
}

/** Map Stripe's subscription status onto the Subscription.currentPlan.status enum. */
function mapStripeSubscriptionStatus(stripeStatus) {
  if (['active', 'trialing'].includes(stripeStatus)) return 'active';
  if (stripeStatus === 'past_due') return 'past_due';
  if (['unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(stripeStatus)) {
    return 'inactive';
  }
  if (stripeStatus === 'canceled') return 'cancelled';
  return 'inactive';
}

/**
 * Stripe changed the subscription — a plan swap, a dunning transition, or a cancel
 * scheduled from the dashboard. This is where entitlements actually follow Stripe
 * instead of drifting from it.
 */
async function applySubscriptionUpdated(stripeSub) {
  const stripe = typeof stripeSub.livemode === 'boolean'
    ? await getStripeForMode(!stripeSub.livemode)
    : await getStripe();
  const canonical = await stripe.subscriptions.retrieve(stripeSub.id);
  if (canonical.status === 'canceled') return applySubscriptionDeleted(canonical);
  const subscription = await Subscription.findOne({
    'currentPlan.stripeSubscriptionId': canonical.id,
  });
  if (!subscription) return { ok: false, reason: 'subscription_not_found' };

  const periodEnd = subscriptionPeriodEnd(canonical);

  subscription.currentPlan.status = mapStripeSubscriptionStatus(canonical.status);
  subscription.currentPlan.stripeMode =
    typeof canonical.livemode === 'boolean' ? (canonical.livemode ? 'live' : 'test') : subscription.currentPlan.stripeMode;
  subscription.currentPlan.autoRenew = !canonical.cancel_at_period_end;
  if (canonical.status === 'past_due') {
    subscription.currentPlan.pastDueSince ||= new Date();
  } else {
    subscription.currentPlan.pastDueSince = undefined;
  }
  if (periodEnd) {
    subscription.currentPlan.renewalDate = periodEnd;
    subscription.currentPlan.endDate = periodEnd;
  }

  const priceId = canonical.items?.data?.[0]?.price?.id;
  const testMode = canonical.livemode === false || subscription.currentPlan.stripeMode === 'test';
  const planByPrice = priceId
    ? await SubscriptionPlan.findOne({
        [testMode ? 'stripePriceIdTest' : 'stripePriceId']: priceId,
      })
    : null;
  const plan =
    planByPrice ||
    (canonical.metadata?.planId
      ? await SubscriptionPlan.findById(canonical.metadata.planId)
      : null);
  if (plan && plan.type === subscription.currentPlan.planType) {
    if (String(subscription.currentPlan.planId || '') !== String(plan._id)) {
      const now = new Date();
      subscription.planHistory.push({
        planId: subscription.currentPlan.planId,
        plan: subscription.currentPlan.plan,
        planType: subscription.currentPlan.planType,
        startDate: subscription.currentPlan.startDate || now,
        endDate: now,
        stripeSubscriptionId: canonical.id,
        status: 'expired',
        discountAmount: subscription.currentPlan.discountAmount || 0,
        discountCoupon: subscription.currentPlan.discountCoupon || null,
        coupon: subscription.currentPlan.coupon || null,
      });
      subscription.currentPlan.planId = plan._id;
      subscription.currentPlan.plan = plan.name;
      subscription.pendingPlan = undefined;
      await User.findByIdAndUpdate(subscription.userId, {
        subscription: plan.name,
        planType: plan.type,
      });
    }
  }
  await subscription.save();

  return { ok: true, subscription };
}

/** The subscription ended for good. */
async function applySubscriptionDeleted(stripeSub) {
  const subscription = await Subscription.findOne({
    'currentPlan.stripeSubscriptionId': stripeSub.id,
  });
  if (!subscription) return { ok: false, reason: 'subscription_not_found' };

  if (subscription.currentPlan.status !== 'cancelled') {
    subscription.planHistory.push({
      planId: subscription.currentPlan.planId,
      plan: subscription.currentPlan.plan,
      planType: subscription.currentPlan.planType,
      startDate: subscription.currentPlan.startDate || new Date(),
      endDate: new Date(),
      stripeSubscriptionId: subscription.currentPlan.stripeSubscriptionId || null,
      status: 'cancelled',
      discountAmount: subscription.currentPlan.discountAmount || 0,
      discountCoupon: subscription.currentPlan.discountCoupon || null,
      coupon: subscription.currentPlan.coupon || null,
    });
  }

  subscription.currentPlan.status = 'cancelled';
  subscription.currentPlan.autoRenew = false;
  subscription.currentPlan.pastDueSince = undefined;
  subscription.pendingPlan = undefined;
  await subscription.save();

  // Drop the denormalised copy on the user so gated features stop reading a plan
  // Stripe no longer bills for.
  await User.findByIdAndUpdate(subscription.userId, { subscription: null });

  return { ok: true, subscription };
}

async function applySubscriptionScheduleCanceled(schedule) {
  const stripeSubscriptionId = idOf(schedule?.subscription);
  if (!stripeSubscriptionId) return { ok: false, reason: 'subscription_not_found' };
  const subscription = await Subscription.findOne({
    'currentPlan.stripeSubscriptionId': stripeSubscriptionId,
  });
  if (!subscription) return { ok: false, reason: 'subscription_not_found' };
  subscription.pendingPlan = undefined;
  await subscription.save();
  return { ok: true, subscription };
}

module.exports = {
  provisionSubscriptionFromSession,
  provisionExtraContactFromSession,
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  applySubscriptionUpdated,
  applySubscriptionDeleted,
  subscriptionPeriodEnd,
  invoiceSubscriptionId,
  mapStripeSubscriptionStatus,
  detectConflictingLiveSubscription,
  applySubscriptionScheduleCanceled,
};
