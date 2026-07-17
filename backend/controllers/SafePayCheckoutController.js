const mongoose = require('mongoose');
const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const SafePayHistory = require('../models/SafePayHistory');
const Review = require('../models/Review');
const Chat = require('../models/ChatMessage');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.getCheckoutDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId)
      .populate({
        path: 'serviceId',
        select: 'title location price duration equipment userId checklist',
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

exports.createSafePaySession = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId).populate('serviceId');

    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
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

    const fee = Math.round(order.agreedPrice * 0.03);
    const total = order.agreedPrice + fee;

    if (total < 3) {
      return res.status(400).json({
        error: 'Beløpet er for lavt. Minimumsbeløpet for betaling er 3 kr inkludert gebyr.',
      });
    }

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');

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
    res.status(500).json({ error: 'Kunne ikke starte betalingen' });
  }
};

exports.checkoutSessionStatus = async (req, res) => {
  try {
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

    // Already paid — return current state
    if (['paid', 'in_progress', 'ready_for_review', 'completed'].includes(order.status)) {
      return res.json({ payment_status: 'paid', orderId: order._id, chatId: order.chatId, alreadyConfirmed: true });
    }

    // Update order status atomically
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: metadata.orderId, status: { $in: ['awaiting_payment', 'pending', 'accepted'] } },
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

    if (updatedOrder?.chatId) {
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

    // Create Payment record (prevent duplicates)
    const existingPayment = await Payment.findOne({ orderId: metadata.orderId });
    if (!existingPayment) {
      try {
        await Payment.create({
          orderId: metadata.orderId,
          chatId: updatedOrder?.chatId,
          status: 'completed',
          amount: updatedOrder?.agreedPrice || 0,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
        });

        // Mark both users as SafePay users
        await User.updateMany(
          { _id: { $in: [order.customerId, order.providerId].filter(Boolean) }, isSafePayUser: { $ne: true } },
          { $set: { isSafePayUser: true, safePayActivatedAt: new Date() } }
        );

        await Promise.all([
          Notification.create({
            userId: order.providerId,
            type: 'order',
            content: 'Betaling mottatt! Du kan nå starte jobben.',
            orderId: order._id,
            senderId: order.customerId,
          }),
          Notification.create({
            userId: order.customerId,
            type: 'order',
            content: 'Betalingen er bekreftet.',
            orderId: order._id,
            senderId: order.customerId,
          }),
        ]);
      } catch (dupErr) {
        if (dupErr.code !== 11000) throw dupErr;
      }
    }

    // Emit socket events
    const io = req.app?.get('io');
    if (io) {
      io.to(`user_${order.providerId}`).emit('payment_confirmed', { orderId: order._id });
      io.to(`user_${order.customerId}`).emit('payment_confirmed', { orderId: order._id });
    }

    res.json({
      payment_status: 'paid',
      orderId: order._id,
      chatId: order.chatId,
      alreadyConfirmed: false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Serverfeil ved sjekking av betaling' });
  }
};

exports.approveAndPayout = async (req, res) => {
  try {
    const { orderId, ratings, comment, photos, recommendWorker } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    // Validate ratings
    if (!ratings) {
      return res.status(400).json({ error: 'Vurderinger er påkrevd' });
    }
    const requiredRatingFields = ['overall', 'punctuality', 'quality', 'communication', 'tidiness'];
    for (const field of requiredRatingFields) {
      if (typeof ratings[field] !== 'number' || ratings[field] < 1 || ratings[field] > 5) {
        return res.status(400).json({
          error: `Alle vurderingsfelt (${field}) må være mellom 1 og 5 stjerner`,
        });
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
    order = await Order.findOneAndUpdate(
      { _id: orderId, status: 'ready_for_review' },
      {
        $set: {
          status: 'completed',
          paymentStatus: 'paid',
          completedAt: new Date(),
          'review.overall': ratings.overall,
          'review.punctuality': ratings.punctuality,
          'review.quality': ratings.quality,
          'review.communication': ratings.communication,
          'review.tidiness': ratings.tidiness,
          'review.comment': comment || '',
        },
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
        await SafePayHistory.create({
          orderId: order._id,
          serviceId: order.serviceId._id,
          customerId: order.customerId,
          providerId: order.providerId,
          serviceTitle: order.serviceId.title || 'Uten navn',
          amounts: { agreedPrice: order.agreedPrice, fee, tax, totalCustomer, netProvider },
          status: 'completed',
          paymentDate: new Date(),
          ratings,
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
          revieweeRole: 'poster',           // provider is being reviewed
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
      provider.earnings = (provider.earnings || 0) + netProvider;
      provider.averageRating = parseFloat(averageRating.toFixed(1));
      provider.reviewCount = reviewCount;
      // Mark as SafePay user
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

    // ── Notifications ──────────────────────────────────────────────────────────
    await Promise.allSettled([
      Notification.create({
        userId: order.providerId,
        type: 'order',
        content: `Jobb godkjent! ${netProvider} kr er lagt til din saldo.`,
        orderId: order._id,
        senderId: userId,
      }),
      Notification.create({
        userId: order.customerId,
        type: 'order',
        content: 'Oppdraget er fullført og godkjent.',
        orderId: order._id,
        senderId: userId,
      }),
    ]);

    // ── Socket events ──────────────────────────────────────────────────────────
    const io = req.app?.get('io');
    if (io) {
      io.to(`user_${order.providerId}`).emit('order_completed', { orderId: order._id, netProvider });
      io.to(`user_${order.customerId}`).emit('order_completed', { orderId: order._id });
    }

    res.json({ message: 'Jobb godkjent og beløp lagt til saldo', orderId });
  } catch (err) {
    res.status(500).json({ error: 'Serverfeil ved godkjenning av utbetaling' });
  }
};
