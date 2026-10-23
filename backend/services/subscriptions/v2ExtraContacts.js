/**
 * Paid extra contacts (Subscription V2), per job.
 *
 * When the billing period's included contacts are used up, the applicant can pay the
 * plan's `perContactPrice` (NOK) for ONE extra contact to ONE job:
 *   - at most `maxContact` extra contacts per billing period (0 = feature off for the plan);
 *   - after an extra contact is used, the next one unlocks `ContactUnlock` minutes later;
 *   - payment is confirmed only from Stripe (signed webhook or a server-side session read).
 * All three values are per plan, set by the admin on the plans page.
 */
const mongoose = require('mongoose');
const ExtraContactPurchase = require('../../models/ExtraContactPurchase');
const SubscriptionUsagePeriod = require('../../models/SubscriptionUsagePeriod');
const Service = require('../../models/Service');
const JobRequest = require('../../models/JobRequest');
const User = require('../../models/User');
const { getStripeConfiguration, getStripeForMode } = require('../../config/stripe');
const { resolveStripeCustomer } = require('../stripe/customers');

const CHECKOUT_MINUTES = 30; // Stripe's minimum Checkout lifetime
const CLOSED_SERVICE_STATUSES = ['completed', 'in_progress', 'closed', 'cancelled', 'expired', 'draft', 'waiting_for_approval'];

class ExtraContactError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
const fail = (status, code, message, details) => new ExtraContactError(status, code, message, details);
const idOf = (value) => (typeof value === 'string' ? value : value?.id);
const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');

/**
 * Whether this user may buy an extra contact for `serviceId` right now.
 * `entitlements` is the resolveEntitlements() snapshot (it carries the plan's entitlements).
 */
async function extraContactOffer({ userId, serviceId, entitlements, now = new Date() }, Model = ExtraContactPurchase) {
  const plan = entitlements?.entitlements || {};
  const priceNok = Number(plan.perContactPrice) || 0;
  const maxPerPeriod = Number(plan.maxContact) || 0;
  const cooldownMinutes = Number(plan.ContactUnlock) || 0;
  const base = { available: false, priceNok, maxPerPeriod, cooldownMinutes, usedThisPeriod: 0, unlockAt: null };
  if (!entitlements?.period) return { ...base, reason: 'no_period' };
  if ((entitlements.remainingIncludedContacts || 0) > 0) return { ...base, reason: 'included_remaining' };
  if (priceNok <= 0 || maxPerPeriod <= 0) return { ...base, reason: 'disabled' };

  if (serviceId && await Model.exists({ userId, serviceId, status: 'paid' })) {
    return { ...base, reason: 'already_paid' };
  }
  const usedThisPeriod = await Model.countDocuments({
    userId,
    billingPeriodStart: new Date(entitlements.period.start),
    $or: [{ status: { $in: ['paid', 'consumed'] } }, { status: 'pending', expiresAt: { $gt: now } }],
  });
  if (usedThisPeriod >= maxPerPeriod) return { ...base, usedThisPeriod, reason: 'period_limit_reached' };

  if (cooldownMinutes > 0) {
    const last = await Model.findOne({ userId, status: 'consumed' }).sort({ consumedAt: -1 }).select('consumedAt').lean();
    const unlockAt = last?.consumedAt ? new Date(last.consumedAt.getTime() + cooldownMinutes * 60 * 1000) : null;
    if (unlockAt && unlockAt > now) return { ...base, usedThisPeriod, unlockAt, reason: 'cooldown' };
  }
  return { ...base, usedThisPeriod, available: true, reason: null };
}

/** POST /api/stripe/create-extra-contact-payment */
async function createExtraContactCheckout({ userId, serviceId }, overrides = {}) {
  const deps = {
    Model: ExtraContactPurchase,
    now: () => new Date(),
    resolveEntitlements: require('./v2Entitlements').resolveEntitlements,
    entitlementsEnabled: require('./v2Entitlements').enabled,
    getStripeConfiguration,
    getStripeForMode,
    resolveStripeCustomer,
    ...overrides,
  };
  if (!deps.entitlementsEnabled()) throw fail(503, 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED', 'Extra contacts are not available.');
  if (!mongoose.Types.ObjectId.isValid(String(serviceId || ''))) throw fail(400, 'SERVICE_REQUIRED', 'A valid job is required.');

  const service = await Service.findById(serviceId).select('userId status title').lean();
  if (!service) throw fail(404, 'SERVICE_NOT_FOUND', 'Oppdraget finnes ikke.');
  if (String(service.userId) === String(userId)) throw fail(400, 'OWN_SERVICE', 'Du kan ikke kjøpe kontakt til ditt eget oppdrag.');
  if (CLOSED_SERVICE_STATUSES.includes(service.status)) throw fail(400, 'SERVICE_CLOSED', 'Oppdraget tar ikke imot søknader.');
  if (await JobRequest.exists({ serviceId, customerId: userId, status: 'pending' })) {
    throw fail(400, 'ALREADY_APPLIED', 'Du har allerede sendt en forespørsel på dette oppdraget.');
  }

  const now = deps.now();
  const entitlements = await deps.resolveEntitlements(userId);
  const offer = await extraContactOffer({ userId, serviceId, entitlements, now }, deps.Model);
  if (!offer.available) {
    throw fail(409, 'EXTRA_CONTACT_UNAVAILABLE', 'Ekstra kontakt er ikke tilgjengelig nå.', { extraContact: offer });
  }

  const config = await deps.getStripeConfiguration();
  if (!config.keyModeValid) throw fail(503, 'STRIPE_UNAVAILABLE', 'Betaling er ikke tilgjengelig nå.');
  const stripe = await deps.getStripeForMode(config.testMode);
  const user = await User.findById(userId);
  const customerId = await deps.resolveStripeCustomer(stripe, user, config.testMode);

  // Free the single open-checkout slot from a session that has already expired.
  await deps.Model.updateMany({ userId, status: 'pending', expiresAt: { $lte: now } }, { $set: { status: 'expired' } });
  let purchase;
  try {
    purchase = await deps.Model.create({
      userId,
      serviceId,
      billingPeriodStart: new Date(entitlements.period.start),
      stripeMode: config.mode,
      amountMinor: Math.round(offer.priceNok * 100),
      expiresAt: new Date(now.getTime() + (CHECKOUT_MINUTES + 1) * 60 * 1000),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    throw fail(409, 'EXTRA_CONTACT_CHECKOUT_OPEN', 'Du har allerede en åpen betaling for ekstra kontakt. Fullfør eller vent til den utløper.');
  }

  const metadata = {
    type: 'extra_contact',
    purchaseId: String(purchase._id),
    userId: String(userId),
    serviceId: String(serviceId),
    stripeMode: config.mode,
  };
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: String(userId),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'nok',
          unit_amount: purchase.amountMinor,
          product_data: { name: 'Ekstra kontakt', description: String(service.title || 'Jobblo-oppdrag').slice(0, 200) },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
      expires_at: Math.floor(now.getTime() / 1000) + CHECKOUT_MINUTES * 60,
      success_url: `${frontendUrl()}/jobs/${serviceId}?extra_contact=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl()}/jobs/${serviceId}?extra_contact=cancelled`,
    }, { idempotencyKey: `jobblo-extra-contact:${purchase._id}` });
  } catch (error) {
    await deps.Model.updateOne({ _id: purchase._id, status: 'pending' }, { $set: { status: 'expired' } });
    console.error('[extra-contact] checkout creation failed:', error.code || error.type || error.message);
    throw fail(503, 'STRIPE_UNAVAILABLE', 'Kunne ikke starte betalingen. Prøv igjen.');
  }
  await deps.Model.updateOne({ _id: purchase._id }, { $set: { checkoutSessionId: session.id } });
  return { url: session.url, sessionId: session.id, priceNok: offer.priceNok };
}

/**
 * Mark a purchase paid from a VERIFIED Stripe Checkout session (signed webhook, or the
 * status endpoint's own server-side retrieve). Idempotent.
 */
async function confirmExtraContactSession(session, Model = ExtraContactPurchase, UsageModel = SubscriptionUsagePeriod) {
  const metadata = session?.metadata || {};
  if (metadata.type !== 'extra_contact' || !mongoose.Types.ObjectId.isValid(String(metadata.purchaseId || ''))) {
    return { handled: 'extra_contact_invalid_metadata' };
  }
  const purchase = await Model.findById(metadata.purchaseId).lean();
  if (
    !purchase ||
    purchase.checkoutSessionId !== session.id ||
    String(purchase.userId) !== String(metadata.userId) ||
    String(purchase.serviceId) !== String(metadata.serviceId) ||
    session.mode !== 'payment' ||
    session.amount_total !== purchase.amountMinor ||
    String(session.currency || '').toLowerCase() !== purchase.currency ||
    session.livemode !== (purchase.stripeMode === 'live')
  ) {
    console.error('[extra-contact] session does not match its purchase; manual review', { sessionId: session?.id, purchaseId: metadata.purchaseId });
    return { handled: 'extra_contact_mismatch' };
  }
  if (session.payment_status !== 'paid') return { handled: 'extra_contact_unpaid' };
  if (['paid', 'consumed'].includes(purchase.status)) return { handled: 'extra_contact_already_paid' };

  // `expired` too: a payment that completed right at the session's expiry was still taken.
  const updated = await Model.findOneAndUpdate(
    { _id: purchase._id, status: { $in: ['pending', 'expired'] } },
    { $set: { status: 'paid', paidAt: new Date(), paymentIntentId: idOf(session.payment_intent) || null } },
    { new: true }
  );
  if (!updated) return { handled: 'extra_contact_already_paid' };
  await UsageModel.updateOne(
    { userId: purchase.userId, billingPeriodStart: purchase.billingPeriodStart },
    { $inc: { purchasedExtraContacts: 1 } }
  );
  return { handled: 'extra_contact_paid' };
}

async function expireExtraContactSession(session, Model = ExtraContactPurchase) {
  await Model.updateOne({ checkoutSessionId: session.id, status: 'pending' }, { $set: { status: 'expired' } });
  return { handled: 'extra_contact_expired' };
}

/** GET /api/stripe/extra-contact-status/:sessionId — owner only; re-checks Stripe while pending. */
async function getExtraContactStatus({ userId, sessionId }, overrides = {}) {
  const deps = { Model: ExtraContactPurchase, getStripeForMode, entitlementsEnabled: require('./v2Entitlements').enabled, ...overrides };
  if (!deps.entitlementsEnabled()) throw fail(503, 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED', 'Extra contacts are not available.');
  if (typeof sessionId !== 'string' || !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
    throw fail(404, 'EXTRA_CONTACT_NOT_FOUND', 'Betalingen ble ikke funnet.');
  }
  let purchase = await deps.Model.findOne({ checkoutSessionId: sessionId, userId }).lean();
  if (!purchase) throw fail(404, 'EXTRA_CONTACT_NOT_FOUND', 'Betalingen ble ikke funnet.');
  if (purchase.status === 'pending') {
    const stripe = await deps.getStripeForMode(purchase.stripeMode === 'test');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === 'expired') await expireExtraContactSession(session, deps.Model);
    else await confirmExtraContactSession(session, deps.Model);
    purchase = await deps.Model.findById(purchase._id).lean();
  }
  return { status: purchase.status, serviceId: String(purchase.serviceId) };
}

/**
 * Inside the application transaction: use a paid extra contact bought for THIS job.
 * Returns true when one was consumed.
 */
async function consumePaidExtraContact({ userId, serviceId, jobRequestId, usagePeriodId, operationId, now = new Date() }, { session, Model = ExtraContactPurchase, UsageModel = SubscriptionUsagePeriod } = {}) {
  if (!serviceId) return false;
  const opts = session ? { session } : {};
  const purchase = await Model.findOneAndUpdate(
    { userId, serviceId, status: 'paid' },
    { $set: { status: 'consumed', consumedAt: now, jobRequestId } },
    { new: true, ...opts }
  );
  if (!purchase) return false;
  if (usagePeriodId) {
    await UsageModel.updateOne(
      { _id: usagePeriodId },
      { $inc: { consumedExtraContacts: 1 }, $push: { contactOperations: { operationId, status: 'consumed' } } },
      opts
    );
  }
  return true;
}

module.exports = {
  ExtraContactError,
  extraContactOffer,
  createExtraContactCheckout,
  confirmExtraContactSession,
  expireExtraContactSession,
  getExtraContactStatus,
  consumePaidExtraContact,
};
