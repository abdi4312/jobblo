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

    console.log('createSafePaySession - userId:', userId);
    console.log('createSafePaySession - typeof userId:', typeof userId);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId).populate('serviceId');
    console.log('createSafePaySession - order:', order);
    console.log('createSafePaySession - order.customerId:', order.customerId);
    console.log('createSafePaySession - typeof order.customerId:', typeof order.customerId);
    console.log('createSafePaySession - order.customerId.toString():', order.customerId.toString());
    console.log('createSafePaySession - String(order.customerId):', String(order.customerId));

    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    if (['paid', 'in_progress', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Denne kontrakten er allerede betalt' });
    }

    // Allow both customer AND provider to create checkout session
    const customerIdStr = order.customerId.toString();
    const providerIdStr = order.providerId.toString();
    const userIdStr = String(userId);
    console.log('createSafePaySession - customerIdStr:', customerIdStr);
    console.log('createSafePaySession - providerIdStr:', providerIdStr);
    console.log('createSafePaySession - userIdStr:', userIdStr);
    console.log('createSafePaySession - is customer:', customerIdStr === userIdStr);
    console.log('createSafePaySession - is provider:', providerIdStr === userIdStr);

    if (customerIdStr !== userIdStr && providerIdStr !== userIdStr) {
      return res.status(403).json({ error: 'Ikke autorisert' });
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

    // Check Stripe minimum amount requirement (NOK 3.00 = 300 øre)
    if (total < 3) {
      return res.status(400).json({
        error: 'Beløpet er for lavt. Minimumsbeløpet for betaling er 3 kr inkludert gebyr.',
      });
    }

    // 8. Fix FRONTEND_URL path joining
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

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating Stripe session:', err);
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
    if (!metadata.orderId) {
      return res.status(400).json({ error: 'Invalid session metadata' });
    }

    const order = await Order.findById(metadata.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Allow both customer AND provider to check session status
    const customerIdStr = order.customerId.toString();
    const providerIdStr = order.providerId.toString();
    const userIdStr = String(req.userId);

    if (customerIdStr !== userIdStr && providerIdStr !== userIdStr) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    if (session.payment_status !== 'paid') {
      return res.json({ payment_status: session.payment_status });
    }

    order.status = 'paid';
    order.paymentStatus = 'paid';
    await order.save();

    // If order has chatId, update chat status and add system message
    if (order.chatId) {
      const chat = await Chat.findById(order.chatId);
      if (chat) {
        chat.status = 'paid';
        // Add system payment message
        chat.messages.push({
          type: 'system_payment',
          systemData: { orderId: order._id, amount: order.agreedPrice },
          text: `Betaling på ${order.agreedPrice} kr er reservert i escrow`,
          createdAt: new Date(),
        });
        await chat.save();
      }
    }

    // 4. Prevent duplicate Payment creation
    const existingPayment = await Payment.findOne({ orderId: order._id });
    if (!existingPayment) {
      const payment = new Payment({
        orderId: order._id,
        chatId: order.chatId,
        status: 'completed',
        amount: order.agreedPrice,
      });
      await payment.save();

      // Send notifications only once when payment is first created
      const providerNotification = new Notification({
        userId: order.providerId,
        type: 'order',
        content: 'Betaling for oppdraget er mottatt! Jobben kan nå starte.',
        orderId: order._id,
        senderId: order.customerId,
      });

      const customerNotification = new Notification({
        userId: order.customerId,
        type: 'order',
        content: 'Betalingen er mottatt! Oppdraget kan nå starte.',
        orderId: order._id,
        senderId: order.customerId,
      });
      await Promise.all([providerNotification.save(), customerNotification.save()]);
    }

    res.json({
      payment_status: 'paid',
      orderId: order._id,
      chatId: order.chatId,
    });
  } catch (err) {
    console.error('Error checking checkout session:', err);
    res.status(500).json({ error: 'Serverfeil ved sjekking av betaling' });
  }
};

exports.approveAndPayout = async (req, res) => {
  try {
    const { orderId, ratings, comment, photos, recommendWorker } = req.body;
    const userId = req.userId;

    // Validate orderId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    // Validate ratings are present and each at least 1 star
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

    // Optional comment validation (if present, not too long)
    if (comment && comment.length > 1000) {
      return res.status(400).json({ error: 'Kommentaren kan ikke være lenger enn 1000 tegn' });
    }

    let order = await Order.findById(orderId).populate('serviceId');
    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    // Allow both customer AND provider to approve payout
    const customerIdStr = order.customerId.toString();
    const providerIdStr = order.providerId.toString();
    const userIdStr = String(userId);

    if (customerIdStr !== userIdStr && providerIdStr !== userIdStr) {
      return res.status(403).json({ error: 'Ikke autorisert til å godkjenne denne kontrakten' });
    }

    // 5. Do not allow for already completed orders
    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Jobben er allerede fullført' });
    }

    if (
      order.status !== 'in_progress' &&
      order.status !== 'paid' &&
      order.status !== 'awaiting_payment'
    ) {
      return res.status(400).json({ error: 'Jobben kan ikke fullføres fra denne statusen' });
    }

    order = await Order.findOneAndUpdate(
      { _id: orderId, status: { $ne: 'completed' } },
      {
        $set: {
          status: 'completed',
          paymentStatus: 'paid',
          'review.overall': ratings.overall,
          'review.punctuality': ratings.punctuality,
          'review.quality': ratings.quality,
          'review.communication': ratings.communication,
          'review.tidiness': ratings.tidiness,
          'review.comment': comment || '',
        },
        $push: {
          history: {
            action: 'payout_approved',
            userId: userId,
            timestamp: new Date(),
            data: { ratings, comment, photos, recommendWorker },
          },
        },
      },
      { new: true }
    ).populate('serviceId');

    // If order has chatId, update chat status to completed and add system message
    if (order.chatId) {
      const chat = await Chat.findById(order.chatId);
      if (chat) {
        chat.status = 'completed';
        chat.messages.push({
          type: 'system_status',
          systemData: { orderId: order._id },
          text: 'Jobben er fullført',
          createdAt: new Date(),
        });
        await chat.save();
      }
    }

    // 2. Check if order is null (race condition: already updated by another request)
    if (!order) {
      return res.status(400).json({ error: 'Jobben er allerede fullført' });
    }

    const fee = Math.round(order.agreedPrice * 0.03);
    const tax = Math.round(order.agreedPrice * 0);
    const totalCustomer = order.agreedPrice + fee;
    const netProvider = order.agreedPrice - fee;

    // 7. Use order.serviceId._id because serviceId is populated
    await Service.findByIdAndUpdate(order.serviceId._id, {
      status: 'completed',
    });

    // Check if we already processed this order to prevent duplicates
    const [existingPayment, existingHistory] = await Promise.all([
      Payment.findOne({ orderId: order._id }),
      SafePayHistory.findOne({ orderId: order._id }),
    ]);

    if (!existingPayment) {
      const payment = new Payment({
        orderId: order._id,
        status: 'released',
        amount: order.agreedPrice,
      });
      await payment.save();
    }

    if (!existingHistory) {
      const service = order.serviceId;
      const safePayHistory = new SafePayHistory({
        orderId: order._id,
        serviceId: service._id,
        customerId: order.customerId,
        providerId: order.providerId,
        serviceTitle: service.title || 'Uten navn',
        amounts: {
          agreedPrice: order.agreedPrice,
          fee,
          tax,
          totalCustomer,
          netProvider,
        },
        status: 'completed',
        paymentDate: new Date(),
        ratings,
        reviewComment: comment,
      });
      await safePayHistory.save();
    }

    // Determine who is reviewing who
    const isCustomerReviewing = String(userId) === String(order.customerId);
    const reviewerId = userId;
    const revieweeId = isCustomerReviewing ? order.providerId : order.customerId;
    const revieweeRole = isCustomerReviewing ? 'poster' : 'seeker';
    console.log('approveAndPayout: Review info:', {
      isCustomerReviewing,
      reviewerId,
      revieweeId,
      revieweeRole,
    });

    // Check if a review for this order already exists
    let review = await Review.findOne({
      orderId: order._id,
      reviewerId,
    });

    if (!review) {
      // Create the review document
      console.log('approveAndPayout: Creating new review');
      review = await Review.create({
        orderId: order._id,
        serviceId: order.serviceId._id,
        reviewerId,
        revieweeId,
        revieweeRole,
        rating: ratings.overall,
        comment: comment || '',
        photos: photos || [],
        recommendWorker: recommendWorker || false,
      });
      console.log('approveAndPayout: Review created:', review);
    } else {
      console.log('approveAndPayout: Review already exists:', review);
      // Update existing review
      review.rating = ratings.overall;
      review.comment = comment || '';
      review.photos = photos || [];
      review.recommendWorker = recommendWorker || false;
      await review.save();
    }

    // Update the reviewee's stats
    const reviewee = await User.findById(revieweeId);
    console.log('approveAndPayout: Found reviewee:', reviewee);
    if (reviewee) {
      // Calculate new average rating from all reviews for this reviewee
      const allReviews = await Review.find({ revieweeId, revieweeRole });
      console.log('approveAndPayout: All reviews for reviewee:', allReviews);
      const reviewCount = allReviews.length;
      const averageRating =
        reviewCount > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;
      console.log('approveAndPayout: Calculated stats:', {
        reviewCount,
        averageRating,
      });

      // Only update completedJobs and earnings if the reviewee is the provider (they're the one doing the job)
      if (isCustomerReviewing) {
        reviewee.completedJobs = (reviewee.completedJobs || 0) + 1;
        reviewee.earnings = (reviewee.earnings || 0) + netProvider;
      }

      reviewee.averageRating = parseFloat(averageRating.toFixed(1));
      reviewee.reviewCount = reviewCount;
      await reviewee.save();
      console.log('approveAndPayout: Saved reviewee:', reviewee);
    }

    // 6. Keep as internal wallet update only, no real payout wording
    const providerNotification = new Notification({
      userId: order.providerId,
      type: 'order',
      content: `Oppdraget er fullført! ${netProvider} kr er lagt til din saldo.`,
      orderId: order._id,
      senderId: userId,
    });
    const customerNotification = new Notification({
      userId: order.customerId,
      type: 'order',
      content: `Oppdraget er fullført.`,
      orderId: order._id,
      senderId: userId,
    });
    await Promise.all([providerNotification.save(), customerNotification.save()]);

    res.json({ message: 'Jobb godkjent og beløp lagt til saldo', orderId });
  } catch (err) {
    console.error('Error approving payout:', err);
    res.status(500).json({ error: 'Serverfeil ved godkjenning av utbetaling' });
  }
};
