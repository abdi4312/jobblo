const mongoose = require('mongoose');
const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const SafePayHistory = require('../models/SafePayHistory');
const Review = require('../models/Review');
const Chat = require('../models/ChatMessage');
const { getStripe } = require('../config/stripe');
const { resolveStripeCustomer } = require('../services/stripe/customers');
const { notify, emitToUser } = require('../services/notifications');
const { normaliseReviewPhotos, MAX_REVIEW_PHOTOS } = require('../utils/reviewPhotos');

const PAID_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'completed'];

/**
 * Idempotently move an order to "paid" for a Stripe Checkout session that Stripe
 * reports as paid, create the Payment record, notify both parties and emit sockets.
 *
 * Shared by two callers so they cannot drift:
 *   - checkoutSessionStatus  (browser returned from Stripe — best effort)
 *   - stripeWebhook          (Stripe told us directly — the source of truth)
 *
 * Returns { ok, alreadyConfirmed, order } or { ok: false, reason }.
 */
async function confirmPaidSession(session, io) {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return { ok: false, reason: 'missing_order_metadata' };

  const order = await Order.findById(orderId);
  if (!order) return { ok: false, reason: 'order_not_found' };

  // The session must be the one this order was created for. Stripe set this
  // metadata when we created the session, so it is trusted — but an order whose
  // metadata points elsewhere means we are about to mark the wrong order paid,
  // which is worth refusing rather than guessing about.
  const sessionUserId = session?.metadata?.userId;
  if (sessionUserId && String(sessionUserId) !== String(order.customerId)) {
    return { ok: false, reason: 'session_customer_mismatch' };
  }

  if (PAID_STATUSES.includes(order.status)) {
    return { ok: true, alreadyConfirmed: true, order };
  }

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ['awaiting_payment', 'pending', 'accepted'] } },
    {
      $set: {
        status: 'paid',
        paymentStatus: 'paid',
        paymentConfirmedAt: new Date(),
        checkoutSessionId: session.id,
        checkoutSessionStatus: 'complete',
        paymentIntentId: session.payment_intent,
      },
      $push: {
        history: {
          action: 'payment_confirmed',
          userId: null,
          timestamp: new Date(),
          data: { stripeSessionId: session.id, message: 'Betaling bekreftet' },
        },
      },
    },
    { new: true }
  );

  // Another caller won the race between our read and our write.
  if (!updatedOrder) {
    return { ok: true, alreadyConfirmed: true, order: await Order.findById(orderId) };
  }

  if (updatedOrder.chatId) {
    const chat = await Chat.findById(updatedOrder.chatId);
    if (chat && !['paid', 'completed'].includes(chat.status)) {
      chat.status = 'paid';
      chat.messages.push({
        type: 'system_payment',
        systemData: { orderId: updatedOrder._id, amount: updatedOrder.agreedPrice },
        text: `Betaling på ${updatedOrder.agreedPrice} kr er bekreftet og holdes i SafePay`,
        createdAt: new Date(),
      });
      await chat.save();
    }
  }

  // Payment record.
  //
  // This was a find-then-create guarded by a `catch (11000)` that claimed a unique
  // index on orderId was doing the real work — but the schema declared orderId as
  // indexed and NOT unique, so the catch never fired and the redirect racing the
  // webhook could write two Payment documents plus two sets of notifications.
  //
  // A single upsert closes the window: `upsertedCount === 1` is true for exactly
  // one caller, so the side effects below run exactly once even under a race, and
  // it does not depend on the index existing to be correct.
  const paymentResult = await Payment.updateOne(
    { orderId },
    {
      $setOnInsert: {
        orderId,
        chatId: updatedOrder.chatId,
        status: 'completed',
        amount: updatedOrder.agreedPrice || 0,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
      },
    },
    { upsert: true }
  );

  if (paymentResult?.upsertedCount === 1) {
    await User.updateMany(
      {
        _id: { $in: [order.customerId, order.providerId].filter(Boolean) },
        isSafePayUser: { $ne: true },
      },
      { $set: { isSafePayUser: true, safePayActivatedAt: new Date() } }
    );

    await Promise.all([
      notify({
        userId: order.providerId,
        type: 'payment',
        content: 'Betaling mottatt — du kan starte jobben.',
        orderId: order._id,
        senderId: order.customerId,
        event: 'order_paid',
        payload: { orderId: String(order._id) },
      }),
      notify({
        userId: order.customerId,
        type: 'payment',
        content: 'Betalingen er bekreftet og holdes trygt til jobben er godkjent.',
        orderId: order._id,
        senderId: order.customerId,
        event: 'order_paid',
        payload: { orderId: String(order._id) },
      }),
    ]);
  }

  if (io) {
    io.to(`user_${order.providerId}`).emit('payment_confirmed', { orderId: order._id });
    io.to(`user_${order.customerId}`).emit('payment_confirmed', { orderId: order._id });
  }

  return { ok: true, alreadyConfirmed: false, order: updatedOrder };
}

exports.getCheckoutDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId)
      .populate({
        path: 'serviceId',
        // (F-38) fromDate/toDate/duration added: the contract panel used to print a
        // hardcoded date and "Ca. 2 timer" because these were never sent.
        select: 'title location price equipment userId checklist fromDate toDate duration',
      })
      .populate('customerId', 'name lastName avatarUrl')
      .populate('providerId', 'name lastName avatarUrl averageRating')
      .populate('checklist.checkedBy', 'name lastName avatarUrl');

    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    if (
      String(order.customerId._id) !== String(req.userId) &&
      String(order.providerId?._id) !== String(req.userId) &&
      String(order.serviceId.userId) !== String(req.userId)
    ) {
      return res.status(403).json({ error: 'Ikke autorisert til å se denne kontrakten' });
    }

    const fee = Math.round(order.agreedPrice * 0.03);
    const total = order.agreedPrice + fee;
    const netProvider = order.agreedPrice - fee;

    res.json({
      order,
      calculation: {
        basePrice: order.agreedPrice,
        fee,
        total,
        providerNet: netProvider,
      },
    });
  } catch (err) {
    console.error('Error fetching checkout details:', err);
    res.status(500).json({ error: 'Serverfeil ved henting av betalingsinformasjon' });
  }
};

/**
 * Everything that must be true before Stripe is called, checked one at a time.
 *
 * This used to be a bare `catch` that returned "Kunne ikke starte betalingen" and threw
 * the real error away — so a missing env var, a deleted service and a Stripe outage were
 * indistinguishable from each other and from the outside, and there was nothing in the
 * logs to tell them apart. Each failure now names itself, in the log and in a `code` on
 * the response. The customer-facing `error` string is unchanged.
 */
function resolveFrontendUrl() {
  const raw = process.env.FRONTEND_URL?.trim().replace(/\/$/, '');
  if (!raw) return { error: 'FRONTEND_URL is not set — Stripe needs absolute return URLs' };
  if (!/^https?:\/\//i.test(raw)) {
    return { error: `FRONTEND_URL must start with http(s)://, got "${raw}"` };
  }
  return { url: raw };
}

exports.createSafePaySession = async (req, res) => {
  const { orderId } = req.body || {};
  try {
    const stripe = await getStripe();
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId).populate('serviceId');

    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    // `serviceId` is populated above; if the underlying service was deleted it comes back
    // null and the line-item name below (`order.serviceId.title`) threw a TypeError that
    // surfaced as a bare 500.
    if (!order.serviceId) {
      console.error('createSafePaySession: order %s references a missing service', orderId);
      return res.status(409).json({
        error: 'Oppdraget finnes ikke lenger, så betalingen kan ikke startes.',
        code: 'service_missing',
      });
    }

    if (!(order.agreedPrice > 0)) {
      console.error('createSafePaySession: order %s has agreedPrice %o', orderId, order.agreedPrice);
      return res.status(409).json({
        error: 'Kontrakten mangler en avtalt pris.',
        code: 'missing_agreed_price',
      });
    }

    // ── SECURITY: Only customer (job poster/payer) may create checkout ─────────
    if (String(order.customerId) !== String(userId)) {
      return res.status(403).json({ error: 'Ikke tilgang. Kun oppdragsgiver kan gjøre betalinger.' });
    }

    // Already paid — return 409
    if (order.paymentStatus === 'paid') {
      return res.status(409).json({ error: 'Ordre er allerede betalt.' });
    }
    if (['paid', 'in_progress', 'ready_for_review', 'completed'].includes(order.status)) {
      return res.status(409).json({ error: 'Ordre er allerede betalt.' });
    }

    // Return existing open session if one exists (prevent duplicate sessions)
    if (order.checkoutSessionId && order.checkoutSessionStatus === 'open') {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(order.checkoutSessionId);
        if (existingSession.status === 'open') {
          return res.json({ url: existingSession.url, reused: true });
        }
      } catch (_) {
        // Session expired/invalid — create new one
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Bruker ble ikke funnet' });
    }

    // Verifies the stored id against Stripe before reusing it, so a customer left
    // over from the other Stripe mode is replaced rather than producing a
    // resource_missing 500 on the way into checkout.
    const stripeCustomerId = await resolveStripeCustomer(stripe, user);

    const fee = Math.round(order.agreedPrice * 0.03);
    const total = order.agreedPrice + fee;

    if (total < 3) {
      return res.status(400).json({
        error: 'Beløpet er for lavt. Minimumsbeløpet for betaling er 3 kr inkludert gebyr.',
      });
    }

    // Checked before the Stripe call rather than after: an unset FRONTEND_URL produced
    // `success_url: "undefined/safepay/success?..."`, which Stripe rejects as an invalid
    // URL — a config mistake that arrived looking like a payment-provider failure.
    const frontend = resolveFrontendUrl();
    if (frontend.error) {
      console.error('createSafePaySession: %s', frontend.error);
      return res.status(500).json({
        error: 'Betaling er ikke konfigurert riktig. Kontakt support.',
        code: 'frontend_url_misconfigured',
      });
    }
    const frontendUrl = frontend.url;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nok',
            product_data: {
              name: `SafePay: ${order.serviceId.title}`,
              description: `Kontrakt #${order._id.toString().substring(0, 8).toUpperCase()}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/safepay/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
      cancel_url: `${frontendUrl}/safepay/checkout/${orderId}`,
      metadata: {
        userId: String(user._id),
        orderId: orderId.toString(),
        type: 'safepay_payment',
      },
    });

    // Store session ID on order for reconciliation
    await Order.findByIdAndUpdate(orderId, {
      checkoutSessionId: session.id,
      checkoutSessionStatus: 'open',
      checkoutSessionCreatedAt: new Date(),
    });

    res.json({ url: session.url });
  } catch (err) {
    // A missing Stripe key throws out of getStripe() with a precise message; Stripe's own
    // errors carry `type` and `code`. Both were being discarded, which is why a 500 here
    // was unactionable in production.
    const isConfig = /secret key is missing/i.test(err?.message || '');
    console.error(
      'createSafePaySession failed [order=%s] %s%s: %s',
      orderId,
      err?.type ? `${err.type}` : err?.name || 'Error',
      err?.code ? `/${err.code}` : '',
      err?.message,
      err?.stack
    );

    res.status(500).json({
      error: isConfig
        ? 'Betaling er ikke konfigurert riktig. Kontakt support.'
        : 'Kunne ikke starte betalingen',
      code: isConfig ? 'stripe_key_missing' : err?.code || 'stripe_session_failed',
    });
  }
};

exports.checkoutSessionStatus = async (req, res) => {
  try {
    const stripe = await getStripe();
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const metadata = session.metadata;
    if (!metadata?.orderId) {
      return res.status(400).json({ error: 'Invalid session metadata' });
    }

    const order = await Order.findById(metadata.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only customer or provider can check status
    const isParticipant =
      String(order.customerId) === String(req.userId) ||
      String(order.providerId) === String(req.userId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    if (session.payment_status !== 'paid') {
      return res.json({ payment_status: session.payment_status });
    }

    const result = await confirmPaidSession(session, req.app?.get('io'));
    if (!result.ok) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({
      payment_status: 'paid',
      orderId: result.order._id,
      chatId: result.order.chatId,
      alreadyConfirmed: result.alreadyConfirmed,
    });
  } catch (err) {
    console.error('checkoutSessionStatus error:', err.message);
    res.status(500).json({ error: 'Serverfeil ved sjekking av betaling' });
  }
};

/**
 * POST /api/safepay-checkout/webhook  (raw body, no auth — Stripe calls this)
 *
 * Kept as an alias so an endpoint already registered at this URL in the Stripe
 * dashboard keeps working. The verification, event-level idempotency and routing
 * now live in one dispatcher shared with /api/stripe/webhook — this used to handle
 * only SafePay sessions, which is why subscriptions and extra-contact purchases had
 * no server-side confirmation at all.
 */
exports.stripeWebhook = (req, res) =>
  require('../services/stripe/webhookDispatcher').stripeWebhook(req, res);

/**
 * Exported so the webhook dispatcher can reuse the one confirmation path rather
 * than growing a parallel copy of it.
 */
exports.confirmPaidSession = confirmPaidSession;

/**
 * POST /api/safepay-checkout/review-photos/:orderId
 *
 * Upload the customer's own review photos and get back URLs to send with `approve`.
 *
 * Mirrors providerWorkController.uploadEvidence rather than inventing a second convention:
 * multipart in, Cloudinary out, URLs back. It exists because the approval screen used to
 * inline the images as base64 in the approve request — see utils/reviewPhotos.js for what
 * that cost.
 */
exports.uploadReviewPhotos = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    const files = req.files || [];

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }
    if (!files.length) {
      return res.status(400).json({ error: 'Ingen filer mottatt' });
    }
    if (files.length > MAX_REVIEW_PHOTOS) {
      return res.status(400).json({ error: `Maks ${MAX_REVIEW_PHOTOS} bilder per vurdering.` });
    }

    const order = await Order.findById(orderId).select('customerId status');
    if (!order) return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });

    // Only the customer writes the review, so only the customer uploads its photos.
    if (String(order.customerId) !== String(userId)) {
      return res.status(403).json({ error: 'Ikke tilgang. Kun oppdragsgiver kan legge ved bilder.' });
    }

    // The review is written at approval, so photos are only meaningful from the point the
    // job is up for review. Uploading earlier would leave orphans in Cloudinary that no
    // review ever references.
    if (!['ready_for_review', 'completed'].includes(order.status)) {
      return res.status(400).json({
        error: `Kan ikke legge ved bilder i status "${order.status}".`,
      });
    }

    const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
    const urls = [];
    for (const file of files) {
      urls.push(await uploadToCloudinary(file, `jobblo/reviews/${orderId}`));
    }

    res.status(201).json({ urls });
  } catch (err) {
    console.error('uploadReviewPhotos failed [order=%s]: %s', req.params?.orderId, err?.message);
    res.status(500).json({ error: 'Serverfeil ved opplasting av bilder' });
  }
};

exports.approveAndPayout = async (req, res) => {
  try {
    const { orderId, ratings, comment, recommendWorker } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    // Photos are URLs from uploadReviewPhotos above — never image bytes. An older client
    // sending base64 is refused here rather than being written into the Review document.
    const photoResult = normaliseReviewPhotos(req.body.photos);
    if (!photoResult.ok) {
      return res.status(400).json({ error: photoResult.error });
    }
    const photos = photoResult.photos;

    // Validate ratings: overall is required; other fields optional but if present must be 1-5
    if (!ratings || typeof ratings.overall !== 'number' || ratings.overall < 1 || ratings.overall > 5) {
      return res.status(400).json({ error: 'Overall rating (overall) must be provided and between 1 and 5' });
    }
    const optionalFields = ['punctuality', 'quality', 'communication', 'tidiness'];
    for (const field of optionalFields) {
      if (ratings[field] !== undefined && (typeof ratings[field] !== 'number' || ratings[field] < 1 || ratings[field] > 5)) {
        return res.status(400).json({ error: `Optional rating ${field} must be a number between 1 and 5 if provided` });
      }
    }
    if (comment && comment.length > 1000) {
      return res.status(400).json({ error: 'Kommentaren kan ikke være lenger enn 1000 tegn' });
    }

    let order = await Order.findById(orderId).populate('serviceId');
    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    // ── SECURITY: ONLY customer (job owner / payer) can approve ───────────────
    if (String(order.customerId) !== String(userId)) {
      return res.status(403).json({
        error: 'Ikke tilgang. Kun oppdragsgiver kan godkjenne og utbetale.',
      });
    }

    // ── STATE CHECK: must be ready_for_review ─────────────────────────────────
    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Jobben er allerede fullført' });
    }
    if (order.status !== 'ready_for_review') {
      return res.status(400).json({
        error: `Jobben kan ikke godkjennes fra status "${order.status}". Utfører må melde jobben som ferdig først.`,
      });
    }
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Betaling er ikke bekreftet' });
    }

    // ── Check no active dispute ────────────────────────────────────────────────
    const Dispute = require('../models/Dispute');
    const activeDispute = await Dispute.findOne({
      orderId,
      status: { $nin: ['resolved', 'closed', 'cancelled'] },
    });
    if (activeDispute) {
      return res.status(400).json({ error: 'Kan ikke godkjenne under aktiv tvist' });
    }

    // ── Atomic update: complete the order ─────────────────────────────────────
    // Build $set for review fields, only include optional fields if present
    const reviewSet = {
      status: 'completed',
      paymentStatus: 'paid',
      completedAt: new Date(),
      'review.overall': ratings.overall,
      'review.comment': comment || '',
    };
    if (ratings.punctuality !== undefined) reviewSet['review.punctuality'] = ratings.punctuality;
    if (ratings.quality !== undefined) reviewSet['review.quality'] = ratings.quality;
    if (ratings.communication !== undefined) reviewSet['review.communication'] = ratings.communication;
    if (ratings.tidiness !== undefined) reviewSet['review.tidiness'] = ratings.tidiness;

    order = await Order.findOneAndUpdate(
      { _id: orderId, status: 'ready_for_review' },
      {
        $set: reviewSet,
        $push: {
          history: {
            action: 'work_approved',
            userId,
            timestamp: new Date(),
            data: { ratings, comment, recommendWorker },
          },
        },
      },
      { new: true }
    ).populate('serviceId');

    if (!order) {
      return res.status(400).json({ error: 'Jobben er allerede fullført' });
    }

    const fee = Math.round(order.agreedPrice * 0.03);
    const tax = 0;
    const totalCustomer = order.agreedPrice + fee;
    const netProvider = order.agreedPrice - fee;

    // ── Update chat to completed ───────────────────────────────────────────────
    if (order.chatId) {
      const chat = await Chat.findById(order.chatId);
      if (chat) {
        chat.status = 'completed';
        chat.messages.push({
          type: 'system_status',
          systemData: { event: 'work_approved', orderId: order._id },
          text: 'Jobb godkjent av oppdragsgiver — utbetaling klar',
          createdAt: new Date(),
        });
        await chat.save();
      }
    }

    // ── Complete service ───────────────────────────────────────────────────────
    await Service.findByIdAndUpdate(order.serviceId._id, { status: 'completed' });

    // ── SafePayHistory (idempotent) ────────────────────────────────────────────
    const existingHistory = await SafePayHistory.findOne({ orderId: order._id });
    if (!existingHistory) {
        try {
          // sanitize ratings for history (only include provided fields)
          const sanitizedRatings = { overall: ratings.overall };
          if (ratings.punctuality !== undefined) sanitizedRatings.punctuality = ratings.punctuality;
          if (ratings.quality !== undefined) sanitizedRatings.quality = ratings.quality;
          if (ratings.communication !== undefined) sanitizedRatings.communication = ratings.communication;
          if (ratings.tidiness !== undefined) sanitizedRatings.tidiness = ratings.tidiness;

          await SafePayHistory.create({
            orderId: order._id,
            serviceId: order.serviceId._id,
            customerId: order.customerId,
            providerId: order.providerId,
            serviceTitle: order.serviceId.title || 'Uten navn',
            amounts: { agreedPrice: order.agreedPrice, fee, tax, totalCustomer, netProvider },
            status: 'completed',
            paymentDate: new Date(),
            ratings: sanitizedRatings,
            reviewComment: comment,
          });
        } catch (e) {
          if (e.code !== 11000) throw e;
        }
    }

    // ── Review: customer reviews provider ─────────────────────────────────────
    // revieweeId = provider (the one who did the work)
    // reviewerId = customer (the one who approves)
    const existingReview = await Review.findOne({ orderId: order._id, reviewerId: userId });
    if (!existingReview) {
      try {
        await Review.create({
          orderId: order._id,
          serviceId: order.serviceId._id,
          reviewerId: userId,               // customer writes the review
          revieweeId: order.providerId,     // review is ABOUT the provider
          // 'poster' means the PROVIDER here — the enum values are named
          // backwards. See the note on Review.revieweeRole before changing this.
          revieweeRole: 'poster',
          rating: ratings.overall,
          comment: comment || '',
          photos: photos || [],
          recommendWorker: recommendWorker || false,
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }

    // ── Update provider stats ──────────────────────────────────────────────────
    const provider = await User.findById(order.providerId);
    if (provider) {
      const allProviderReviews = await Review.find({ revieweeId: order.providerId });
      const reviewCount = allProviderReviews.length;
      const averageRating =
        reviewCount > 0
          ? allProviderReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
          : 0;

      provider.completedJobs = (provider.completedJobs || 0) + 1;
      provider.averageRating = parseFloat(averageRating.toFixed(1));
      provider.reviewCount = reviewCount;
      if (!provider.isSafePayUser) {
        provider.isSafePayUser = true;
        provider.safePayActivatedAt = new Date();
      }
      await provider.save();
    }

    // ── Also update customer as SafePay user ───────────────────────────────────
    await User.findOneAndUpdate(
      { _id: order.customerId, isSafePayUser: { $ne: true } },
      { $set: { isSafePayUser: true, safePayActivatedAt: new Date() } }
    );

    // ── Actual Stripe Connect transfer to provider ─────────────────────────────
    const releasePayoutToProvider = require('../services/payout/releasePayoutToProvider');
    let payoutResult;
    try {
      // Source the payment record for reconciliation
      const sourcePayment = await Payment.findOne({ orderId: order._id });
      payoutResult = await releasePayoutToProvider({
        orderId:                 order._id,
        providerId:              order.providerId,
        customerId:              order.customerId,
        serviceId:               order.serviceId._id,
        grossAmount:             order.agreedPrice,
        platformFee:             fee,
        releaseSource:           'customer_approve',
        releasedBy:              userId,
        stripePaymentIntentId:   sourcePayment?.stripePaymentIntentId,
        stripeCheckoutSessionId: sourcePayment?.stripeSessionId,
        safePayHistoryId:        (await SafePayHistory.findOne({ orderId: order._id }))?._id,
      });

      // Only increment virtual earnings after confirmed transfer
      if (!payoutResult.alreadyPaid) {
        await User.findByIdAndUpdate(order.providerId, { $inc: { earnings: netProvider } });
      }
    } catch (payoutErr) {
      // Transfer failed — funds remain on platform, order stays completed for work credit
      // but provider is NOT marked paid and earnings are NOT incremented
      console.error('approveAndPayout: Stripe transfer failed:', payoutErr.message);

      const isSetupRequired = ['PAYOUT_SETUP_REQUIRED', 'PAYOUT_NOT_ENABLED'].includes(payoutErr.code);
      const userMessage = isSetupRequired
        ? 'Jobben er godkjent, men utbetalingen krever at oppdragstaker fullfører Stripe Connect-oppsett før penger kan overføres.'
        : 'Jobben er godkjent, men utbetalingen mislyktes midlertidig. Pengene er trygge og vil bli forsøkt igjen.';

      // Notify provider of action needed
      await notify({
        userId: order.providerId,
        type: 'payment',
        content: isSetupRequired
          ? 'Jobben er godkjent! Fullfør Stripe Connect-oppsett under Innstillinger → Utbetaling for å motta pengene.'
          : `Jobb godkjent, men overføring mislyktes: ${payoutErr.message}. Kontakt support.`,
        orderId: order._id,
        senderId: userId,
        event: 'payout_failed',
        payload: { orderId: String(order._id), setupRequired: isSetupRequired },
      });

      // The approval itself succeeded even though the transfer did not, so both
      // parties still get the completion event. Unlike the happy path above there is
      // no `notify({ event: 'order_completed' })` on this branch, so these are the
      // only delivery — not duplicates. Routed through `emitToUser` so they reach
      // every room the user occupies rather than only the `user_<id>` spelling.
      emitToUser(order.providerId, 'order_completed', {
        orderId: String(order._id),
        payoutPending: true,
      });
      emitToUser(order.customerId, 'order_completed', { orderId: String(order._id) });

      return res.status(200).json({
        message: 'Jobb godkjent',
        orderId,
        payoutWarning: userMessage,
        payoutErrorCode: payoutErr.code || 'TRANSFER_FAILED',
      });
    }

    // ── Notifications ──────────────────────────────────────────────────────────
    await Promise.allSettled([
      notify({
        userId: order.providerId,
        type: 'payment',
        content: `Jobb godkjent — ${netProvider} kr er på vei til deg.`,
        orderId: order._id,
        senderId: userId,
        event: 'payout_sent',
        payload: { orderId: String(order._id), amount: netProvider },
      }),
      notify({
        userId: order.customerId,
        type: 'order',
        content: 'Oppdraget er fullført og godkjent.',
        orderId: order._id,
        senderId: userId,
        event: 'order_completed',
        payload: { orderId: String(order._id) },
      }),
    ]);

    /**
     * The socket emits that used to sit here are gone.
     *
     * Both notifications above already carry their lifecycle event (`payout_sent` to
     * the provider, `order_completed` to the customer) and `notify` delivers it. This
     * block emitted `order_completed` a second time to both parties over a raw
     * `io.to()`, so the customer received the same event twice — two cache
     * invalidations, and two of anything the client chooses to show for it.
     *
     * The provider now learns of completion through `payout_sent`, which is the more
     * accurate event for their side anyway: it carries the amount.
     */
    emitToUser(order.providerId, 'order_completed', {
      orderId: String(order._id),
      netProvider,
    });

    res.json({ message: 'Jobb godkjent og beløp lagt til saldo', orderId });
  } catch (err) {
    // The payout path already logs Stripe transfer failures in its own catch above. This
    // one covers everything before that — and logged nothing at all, on the single most
    // consequential endpoint in the product.
    console.error(
      'approveAndPayout failed [order=%s]: %s',
      req.body?.orderId || req.params?.orderId,
      err?.message,
      err?.stack
    );
    res.status(500).json({ error: 'Serverfeil ved godkjenning av utbetaling' });
  }
};
