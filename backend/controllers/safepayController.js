const mongoose = require('mongoose');
const Order = require('../models/Order');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const User = require('../models/User');
const SafePayHistory = require('../models/SafePayHistory');
const Review = require('../models/Review');

/**
 * POST /api/safepay/create-contract
 * Create a contract (Order) between a client and a selected applicant
 */
exports.createContract = async (req, res) => {
  try {
    const { serviceId, applicantId, requestId } = req.body;
    const userId = req.userId;

    console.log('createContract: req.body:', {
      serviceId,
      applicantId,
      requestId,
    });
    console.log('createContract: userId:', userId);

    // Validate input IDs (Bug 9)
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ error: 'Ugyldig serviceId' });
    }
    if (!mongoose.Types.ObjectId.isValid(applicantId)) {
      return res.status(400).json({ error: 'Ugyldig applicantId' });
    }
    if (requestId && !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ error: 'Ugyldig requestId' });
    }

    // 1. Verify service ownership (userId should be provider/owner of service)
    const service = await Service.findById(serviceId);
    console.log('createContract: service:', service);
    if (!service) {
      return res.status(404).json({ error: 'Oppdraget ble ikke funnet' });
    }

    if (String(service.userId) !== String(userId)) {
      return res.status(403).json({
        error: 'Ikke autorisert til å velge søker for dette oppdraget',
      });
    }

    // Bug 11: Check service/order status
    console.log('createContract: service.status:', service.status);
    if (service.status === 'completed' || service.status === 'closed') {
      return res.status(400).json({ error: 'Denne tjenesten er ikke lenger tilgjengelig' });
    }

    // Bug 10: Validate applicant actually applied
    // In JobRequest: customerId is the applicant (person who wants to do the work), providerId is service owner (person who posted the job)
    // First, let's log all JobRequests for this serviceId to debug
    const allJobRequests = await JobRequest.find({ serviceId });
    console.log('createContract: allJobRequests:', allJobRequests);

    if (requestId) {
      const jobRequest = await JobRequest.findOne({
        _id: requestId,
        serviceId,
        customerId: applicantId,
        providerId: userId,
      });
      console.log('createContract: found jobRequest with requestId:', jobRequest);
      if (!jobRequest) {
        return res.status(400).json({ error: 'Ugyldig søknad' });
      }
    } else {
      const jobRequest = await JobRequest.findOne({
        serviceId,
        customerId: applicantId,
        providerId: userId,
      });
      console.log('createContract: found jobRequest without requestId:', jobRequest);
      if (!jobRequest) {
        return res.status(400).json({ error: 'Søker har ikke søkt på denne tjenesten' });
      }
    }

    // Bug 3: Prevent duplicate contract
    // Check if there's ANY existing order for this service (regardless of provider)
    const existingOrder = await Order.findOne({ serviceId });
    console.log('createContract: existingOrder:', existingOrder);
    if (existingOrder) {
      return res.status(400).json({ error: 'Kontrakt finnes allerede' });
    }

    // 2. Create the Order (Contract) with checklist initialized from service
    const checklist = (service.checklist || []).map((item) => ({
      id: item.id,
      text: item.text,
      checked: false,
    }));

    const order = new Order({
      serviceId,
      customerId: userId, // Service owner is the customer (person who pays)
      providerId: applicantId, // Applicant is the provider (person who does the work)
      status: 'awaiting_payment',
      initialPrice: service.price,
      agreedPrice: service.price,
      checklist,
      history: [
        {
          action: 'contract_created',
          userId: userId,
          timestamp: new Date(),
          data: { message: 'SafePay kontrakt opprettet' },
        },
      ],
    });

    await order.save();

    // Link chat to order and vice versa
    const Chat = require('../models/ChatMessage');
    const chat = await Chat.findOneAndUpdate(
      {
        clientId: userId,
        providerId: applicantId,
        serviceId: serviceId,
      },
      { orderId: order._id, status: 'contracted', agreedPrice: service.price },
      { new: true }
    );
    if (chat) {
      // Also update order to link back to chat
      await Order.findByIdAndUpdate(order._id, { chatId: chat._id });

      // Add system message to chat that contract was created
      chat.messages.push({
        type: 'system_contract',
        systemData: { orderId: order._id },
        text: 'Kontrakt er opprettet!',
        createdAt: new Date(),
      });
      await chat.save();
    }

    // Update service status to in_progress
    await Service.findByIdAndUpdate(serviceId, { status: 'in_progress' });

    // 3. Update JobRequest status if provided (Bug 4)
    if (requestId) {
      await JobRequest.findOneAndUpdate(
        {
          _id: requestId,
          serviceId,
          customerId: applicantId,
          providerId: userId,
        },
        { status: 'accepted' }
      );
      // Mark other requests as declined
      await JobRequest.updateMany(
        { serviceId, _id: { $ne: requestId }, status: 'pending' },
        { status: 'declined' }
      );
    } else {
      await JobRequest.findOneAndUpdate(
        { serviceId, customerId: applicantId, providerId: userId },
        { status: 'accepted' }
      );
      // Mark other requests as declined
      await JobRequest.updateMany(
        { serviceId, customerId: { $ne: applicantId }, status: 'pending' },
        { status: 'declined' }
      );
    }

    // 4. Create notification for the applicant
    const notification = new Notification({
      userId: applicantId,
      type: 'order',
      content: `Du har blitt valgt for oppdraget: ${service.title}. Venter på betaling.`,
      orderId: order._id,
      senderId: userId,
    });
    await notification.save();

    res.status(201).json({
      message: 'Kontrakt opprettet',
      orderId: order._id,
    });
  } catch (err) {
    console.error('Error creating contract:', err);
    res.status(500).json({ error: 'Serverfeil ved opprettelse av kontrakt' });
  }
};

/**
 * GET /api/safepay/contract/:orderId
 * Get contract details
 */
exports.getContract = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate input ID (Bug 9)
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId)
      .populate('serviceId')
      .populate('customerId', 'name lastName avatarUrl')
      .populate('providerId', 'name lastName avatarUrl');

    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    // Bug 1: Authorization check
    if (
      String(order.customerId._id) !== String(req.userId) &&
      String(order.providerId._id) !== String(req.userId)
    ) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    res.json(order);
  } catch (err) {
    console.error('Error fetching contract:', err);
    res.status(500).json({ error: 'Serverfeil ved henting av kontrakt' });
  }
};

/**
 * POST /api/safepay/contract/:orderId/start
 * Mark job as in_progress
 */
exports.startJob = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    // Validate input ID (Bug 9)
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    // Check if user is provider or customer
    if (
      String(order.providerId) !== String(userId) &&
      String(order.customerId) !== String(userId)
    ) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    // Bug 5: Validate order status before starting
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Betaling må fullføres før jobb kan startes' });
    }

    // Bug 11: Status transition check
    if (order.status !== 'awaiting_payment' && order.status !== 'paid') {
      return res.status(400).json({ error: 'Jobben kan ikke startes fra denne statusen' });
    }

    // Update order status
    order.status = 'in_progress';
    order.history.push({
      action: 'job_started',
      userId,
      timestamp: new Date(),
      data: { message: 'Oppdraget er startet' },
    });
    await order.save();

    // If order has chatId, add system message to chat
    if (order.chatId) {
      const Chat = require('../models/ChatMessage');
      const chat = await Chat.findById(order.chatId);
      if (chat) {
        chat.messages.push({
          type: 'system_status',
          systemData: { orderId: order._id },
          text: 'Jobben er startet!',
          createdAt: new Date(),
        });
        await chat.save();
      }
    }

    // Create notification for the other party
    const otherUserId =
      String(order.providerId) === String(userId) ? order.customerId : order.providerId;
    const notification = new Notification({
      userId: otherUserId,
      type: 'order',
      content: `Oppdraget er startet!`,
      orderId: order._id,
      senderId: userId,
    });
    await notification.save();

    res.json({ message: 'Oppdraget startet', order });
  } catch (err) {
    console.error('Error starting job:', err);
    res.status(500).json({ error: 'Serverfeil ved start av oppdrag' });
  }
};

/**
 * POST /api/safepay/contract/:orderId/complete
 * Complete job and release payment
 */
exports.completeJobAndPayout = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { ratings, comment, photos, recommendWorker } = req.body;
    const userId = req.userId;

    // Validate input ID (Bug 9)
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

    // First get the order to check
    let order = await Order.findById(orderId).populate('serviceId');
    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    // Only customer can complete and payout
    if (String(order.customerId) !== String(userId)) {
      return res.status(403).json({ error: 'Kun kunde kan fullføre og utbetale' });
    }

    // Bug 11: Status transition check
    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Oppdraget er allerede fullført' });
    }

    // Then do atomic update
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
            action: 'job_completed',
            userId,
            timestamp: new Date(),
            data: {
              message: 'Oppdraget er fullført og beløp utbetalt',
              photos,
              recommendWorker,
            },
          },
        },
      },
      { new: true }
    ).populate('serviceId');

    if (!order) {
      return res.status(400).json({ error: 'Oppdraget er allerede fullført' });
    }

    // Bug 8: Consistent fee calculation
    const fee = Math.round(order.agreedPrice * 0.03);
    const tax = Math.round(order.agreedPrice * 0); // 0% tax for now
    const totalCustomer = order.agreedPrice + fee;
    const netProvider = order.agreedPrice - fee;

    // 2. Create payment record
    const payment = new Payment({
      orderId: order._id,
      chatId: order.chatId,
      status: 'released',
      amount: order.agreedPrice,
    });
    await payment.save();

    // If order has chatId, update chat to completed status and add system message
    if (order.chatId) {
      const Chat = require('../models/ChatMessage');
      const chat = await Chat.findById(order.chatId);
      if (chat) {
        chat.status = 'completed';
        chat.messages.push({
          type: 'system_status',
          systemData: { orderId: order._id },
          text: 'Jobben er fullført!',
          createdAt: new Date(),
        });
        await chat.save();
      }
    }

    // 3. Create SafePayHistory record
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

    // Update service status to completed
    await Service.findByIdAndUpdate(service._id, { status: 'completed' });

    // Determine who is reviewing who (customer is reviewing provider in this case)
    const reviewerId = userId;
    const revieweeId = order.providerId;
    const revieweeRole = 'poster';
    console.log('completeJobAndPayout: Review info:', {
      reviewerId,
      revieweeId,
      revieweeRole,
    });

    // Check if a review for this order already exists
    let review = await Review.findOne({ orderId: order._id, reviewerId });
    if (!review) {
      // Create the review document
      console.log('completeJobAndPayout: Creating new review');
      review = await Review.create({
        orderId: order._id,
        serviceId: service._id,
        reviewerId,
        revieweeId,
        revieweeRole,
        rating: ratings.overall,
        comment: comment || '',
        photos: photos || [],
        recommendWorker: recommendWorker || false,
      });
      console.log('completeJobAndPayout: Review created:', review);
    } else {
      console.log('completeJobAndPayout: Review already exists:', review);
      // Update existing review
      review.rating = ratings.overall;
      review.comment = comment || '';
      review.photos = photos || [];
      review.recommendWorker = recommendWorker || false;
      await review.save();
    }

    // Update reviewee's stats (provider)
    const reviewee = await User.findById(revieweeId);
    console.log('completeJobAndPayout: Found reviewee:', reviewee);
    if (reviewee) {
      // Calculate new average rating from all reviews
      const allReviews = await Review.find({ revieweeId });
      console.log('completeJobAndPayout: All reviews for reviewee:', allReviews);
      const reviewCount = allReviews.length;
      const averageRating =
        reviewCount > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;
      console.log('completeJobAndPayout: Calculated stats:', {
        reviewCount,
        averageRating,
      });

      // Update provider's stats
      reviewee.completedJobs = (reviewee.completedJobs || 0) + 1;
      reviewee.averageRating = Math.round(averageRating * 10) / 10;
      reviewee.reviewCount = reviewCount;
      reviewee.earnings = (reviewee.earnings || 0) + netProvider;
      await reviewee.save();
      console.log('completeJobAndPayout: Saved reviewee:', reviewee);
    }

    // Bug 6: Add TODO comment about real payout
    // TODO: Integrate with actual payment gateway to release funds to provider
    // For now this is an internal wallet transfer only

    // 5. Create notifications for both parties
    const providerNotification = new Notification({
      userId: order.providerId,
      type: 'order',
      content: `Oppdraget er fullført! ${netProvider} kr er utbetalt til din konto.`,
      orderId: order._id,
      senderId: userId,
    });
    const customerNotification = new Notification({
      userId: order.customerId,
      type: 'order',
      content: `Oppdraget er fullført og beløpet på ${totalCustomer} kr er utbetalt.`,
      orderId: order._id,
      senderId: userId,
    });
    await Promise.all([providerNotification.save(), customerNotification.save()]);

    res.json({
      message: 'Oppdraget fullført og beløp utbetalt',
      order,
      payment,
    });
  } catch (err) {
    console.error('Error completing job:', err);
    res.status(500).json({ error: 'Serverfeil ved fullføring av oppdrag' });
  }
};

/**
 * GET /api/safepay/history/:userId
 * Get user's SafePay payment history with detailed breakdown
 */
exports.getSafePayHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate input ID (Bug 9)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Ugyldig userId' });
    }

    // Bug 2: Authorization check
    if (String(req.userId) !== String(userId)) {
      // Check if user is admin (optional, based on available role)
      const user = await User.findById(req.userId);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ error: 'Ikke autorisert' });
      }
    }

    // First check if we have any SafePayHistory records
    const safePayRecords = await SafePayHistory.find({
      $or: [{ providerId: userId }, { customerId: userId }],
    })
      .populate('customerId', 'name lastName avatarUrl')
      .populate('providerId', 'name lastName avatarUrl')
      .sort({ createdAt: -1 });

    // If we have SafePayHistory records, use those
    if (safePayRecords.length > 0) {
      // Calculate totals
      let totalEarned = 0;
      let totalSpent = 0;
      let totalFees = 0;
      let totalTax = 0;

      const history = safePayRecords.map((record) => {
        // Get IDs from populated objects or directly from record
        const recordProviderId = record.providerId?._id
          ? String(record.providerId._id)
          : String(record.providerId);
        const recordCustomerId = record.customerId?._id
          ? String(record.customerId._id)
          : String(record.customerId);
        const isProvider = recordProviderId === String(userId);

        if (isProvider) {
          totalEarned += record.amounts.netProvider;
          totalFees += record.amounts.fee;
        } else {
          totalSpent += record.amounts.totalCustomer;
          totalFees += record.amounts.fee;
        }
        totalTax += record.amounts.tax;

        return {
          id: record._id,
          orderId: record.orderId,
          serviceTitle: record.serviceTitle,
          customerName:
            `${record.customerId?.name || ''} ${record.customerId?.lastName || ''}`.trim(),
          providerName:
            `${record.providerId?.name || ''} ${record.providerId?.lastName || ''}`.trim(),
          isProvider,
          isCustomer: !isProvider,
          amounts: record.amounts,
          paymentDate: record.paymentDate || record.updatedAt,
          orderDate: record.createdAt,
          status: record.status,
          customerAvatar: record.customerId?.avatarUrl,
          providerAvatar: record.providerId?.avatarUrl,
          ratings: record.ratings,
          reviewComment: record.reviewComment,
        };
      });

      res.json({
        history,
        summary: {
          totalEarned: Math.abs(totalEarned),
          totalSpent: Math.abs(totalSpent),
          totalFees: Math.abs(totalFees),
          totalTax: Math.abs(totalTax),
          transactionCount: history.length,
        },
      });
    } else {
      // Fallback to old approach for existing orders
      // Find all orders where the user is either provider or customer
      const orders = await Order.find({
        $or: [{ providerId: userId }, { customerId: userId }],
        status: 'completed',
      })
        .populate('serviceId', 'title')
        .populate('customerId', 'name lastName avatarUrl')
        .populate('providerId', 'name lastName avatarUrl')
        .sort({ createdAt: -1 });

      // Get corresponding payments
      const orderIds = orders.map((o) => o._id);
      const payments = await Payment.find({
        orderId: { $in: orderIds },
        status: 'released',
      });

      // Calculate totals (Bug 8: Consistent fee calculation)
      let totalEarned = 0;
      let totalSpent = 0;
      let totalFees = 0;
      let totalTax = 0;

      // Combine orders and payments with detailed breakdown
      const history = orders.map((order) => {
        const payment = payments.find((p) => String(p.orderId) === String(order._id));
        // Get IDs from populated objects or directly from order
        const orderProviderId = order.providerId?._id
          ? String(order.providerId._id)
          : String(order.providerId);
        const isProvider = orderProviderId === String(userId);

        // Consistent fee calculation
        const fee = Math.round(order.agreedPrice * 0.03);
        const tax = Math.round(order.agreedPrice * 0); // 0% tax for now
        const netProvider = order.agreedPrice - fee;
        const totalCustomer = order.agreedPrice + fee;

        if (isProvider) {
          totalEarned += netProvider;
          totalFees += fee;
        } else {
          totalSpent += totalCustomer;
          totalFees += fee;
        }
        totalTax += tax;

        return {
          id: order._id,
          orderId: order._id,
          serviceTitle: order.serviceId?.title || 'Uten tittel',
          customerName:
            `${order.customerId?.name || ''} ${order.customerId?.lastName || ''}`.trim(),
          providerName:
            `${order.providerId?.name || ''} ${order.providerId?.lastName || ''}`.trim(),
          isProvider,
          isCustomer: !isProvider,
          amounts: {
            agreedPrice: order.agreedPrice,
            fee: fee,
            tax: tax,
            totalCustomer: totalCustomer,
            netProvider: netProvider,
          },
          paymentDate: payment?.createdAt || order.updatedAt,
          orderDate: order.createdAt,
          status: 'completed',
          customerAvatar: order.customerId?.avatarUrl,
          providerAvatar: order.providerId?.avatarUrl,
        };
      });

      res.json({
        history,
        summary: {
          totalEarned: Math.abs(totalEarned),
          totalSpent: Math.abs(totalSpent),
          totalFees: Math.abs(totalFees),
          totalTax: Math.abs(totalTax),
          transactionCount: history.length,
        },
      });
    }
  } catch (err) {
    console.error('Error fetching SafePay history:', err);
    res.status(500).json({ error: 'Serverfeil ved henting av SafePay-historikk' });
  }
};

/**
 * PUT /api/safepay/contract/:orderId/checklist/:itemId
 * Update checklist item (check/uncheck)
 */
exports.updateChecklistItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { checked } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    let order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    if (
      String(order.customerId) !== String(userId) &&
      String(order.providerId) !== String(userId)
    ) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    const checklistItemIndex = order.checklist.findIndex((item) => item.id === itemId);
    if (checklistItemIndex === -1) {
      return res.status(404).json({ error: 'Sjekklisteelement ble ikke funnet' });
    }

    const updateData = {
      [`checklist.${checklistItemIndex}.checked`]: checked,
    };

    if (checked) {
      updateData[`checklist.${checklistItemIndex}.checkedBy`] = userId;
      updateData[`checklist.${checklistItemIndex}.checkedAt`] = new Date();
    } else {
      updateData[`checklist.${checklistItemIndex}.checkedBy`] = null;
      updateData[`checklist.${checklistItemIndex}.checkedAt`] = null;
    }

    order = await Order.findByIdAndUpdate(orderId, { $set: updateData }, { new: true }).populate(
      'checklist.checkedBy',
      'name lastName avatarUrl'
    );

    res.json({ message: 'Sjekklisteelement oppdatert', order });
  } catch (err) {
    console.error('Error updating checklist item:', err);
    res.status(500).json({ error: 'Serverfeil ved oppdatering av sjekklisteelement' });
  }
};

/**
 * GET /api/safepay-checkout/details/:orderId (to maintain compatibility)
 * We'll add this function here for now
 */
exports.getCheckoutDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Ugyldig orderId' });
    }

    const order = await Order.findById(orderId)
      .populate('serviceId')
      .populate('customerId', 'name lastName avatarUrl')
      .populate('providerId', 'name lastName avatarUrl')
      .populate('checklist.checkedBy', 'name lastName avatarUrl');

    if (!order) {
      return res.status(404).json({ error: 'Kontrakten ble ikke funnet' });
    }

    if (
      String(order.customerId._id) !== String(req.userId) &&
      String(order.providerId._id) !== String(req.userId)
    ) {
      return res.status(403).json({ error: 'Ikke autorisert' });
    }

    // Calculate fee and net amount
    const fee = Math.round(order.agreedPrice * 0.03);
    const calculation = {
      basePrice: order.agreedPrice,
      fee,
      providerNet: order.agreedPrice - fee,
      totalCustomer: order.agreedPrice + fee,
    };

    res.json({ order, calculation });
  } catch (err) {
    console.error('Error fetching checkout details:', err);
    res.status(500).json({ error: 'Serverfeil ved henting av utbetalingsdetaljer' });
  }
};
