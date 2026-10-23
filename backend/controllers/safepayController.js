const mongoose = require('mongoose');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const User = require('../models/User');
const SafePayHistory = require('../models/SafePayHistory');
const StripeTransferRecord = require('../models/StripeTransferRecord');
const Payout = require('../models/Payout');
const Review = require('../models/Review');
const { notify } = require('../services/notifications');
const { ensureProviderConnectReady } = require('../middleware/requireProviderConnect');
const { acquireServiceContractLock } = require('../services/order/contractLock');

/**
 * POST /api/safepay/create-contract
 * Create a contract (Order) between a client and a selected applicant
 */
exports.createContract = async (req, res) => {
  try {
    const { serviceId, applicantId, requestId } = req.body;
    const userId = req.userId;


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
    if (!service) {
      return res.status(404).json({ error: 'Oppdraget ble ikke funnet' });
    }

    if (String(service.userId) !== String(userId)) {
      return res.status(403).json({
        error: 'Ikke autorisert til å velge søker for dette oppdraget',
      });
    }

    // Bug 11: Check service/order status
    if (service.status === 'completed' || service.status === 'closed') {
      return res.status(400).json({ error: 'Denne tjenesten er ikke lenger tilgjengelig' });
    }

    // Bug 10: Validate applicant actually applied
    // In JobRequest: customerId is the applicant (person who wants to do the work), providerId is service owner (person who posted the job)
    // The application must still be live.
    //
    // Neither branch checked `status`, so a DECLINED applicant could still be awarded
    // the contract — and the update further down flips their request from `declined`
    // back to `accepted`. That also meant the whole field auto-declined by an earlier
    // award stayed awardable indefinitely.
    const AWARDABLE_STATUSES = ['pending', 'accepted'];

    const applicationQuery = requestId
      ? { _id: requestId, serviceId, customerId: applicantId, providerId: userId }
      : { serviceId, customerId: applicantId, providerId: userId };

    const jobRequest = await JobRequest.findOne(applicationQuery);
    if (!jobRequest) {
      return res.status(400).json({
        error: requestId ? 'Ugyldig søknad' : 'Søker har ikke søkt på denne tjenesten',
      });
    }
    if (!AWARDABLE_STATUSES.includes(jobRequest.status)) {
      return res.status(400).json({
        error: 'Denne søknaden er ikke lenger aktiv og kan ikke velges.',
        code: 'application_not_awardable',
        status: jobRequest.status,
      });
    }

    if (!(await ensureProviderConnectReady(req, res, applicantId))) return;

    // Prevent duplicate contract.
    //
    // This used to match ANY order for the service in ANY status, which made it a
    // denial-of-service on every listing: POST /api/orders creates a `pending` order
    // against someone else's service, and from then on the real owner could never
    // create their contract — permanently, with no path that cleared it. It also
    // meant that cancelling a contract before payment bricked the job for good.
    //
    // Only an order that actually holds the service should block a new one.
    const BLOCKING_ORDER_STATUSES = [
      'awaiting_payment',
      'paid',
      'in_progress',
      'ready_for_review',
      'disputed',
      'completed',
    ];
    const Chat = require('../models/ChatMessage');
    const pairChatFilter = {
      serviceId: serviceId,
      $or: [
        { clientId: userId, providerId: applicantId },
        { clientId: applicantId, providerId: userId },
      ],
    };

    // The check below and order.save() were not atomic: two concurrent awards both saw
    // "no order" and created two contracts for one job.
    const lock = await acquireServiceContractLock(serviceId);
    if (!lock) {
      return res.status(409).json({ error: 'Kontrakten opprettes allerede. Prøv igjen om litt.' });
    }
    let order;
    let price;
    try {
      const existingOrder = await Order.findOne({
        serviceId,
        status: { $in: BLOCKING_ORDER_STATUSES },
      });
      if (existingOrder) {
        return res.status(400).json({ error: 'Kontrakt finnes allerede' });
      }

      // The price both parties agreed in the conversation, as the chat contract path
      // already uses. This path ignored it, created the order at the listing price and
      // then overwrote the chat's agreed price with the listing price.
      const pairChat = await Chat.findOne(pairChatFilter).select('agreedPrice orderId').lean();
      price = (!pairChat?.orderId && pairChat?.agreedPrice) || service.price;

      // 2. Create the Order (Contract) with checklist initialized from service
      const checklist = (service.checklist || []).map((item) => ({
        id: item.id,
        text: item.text,
        checked: false,
      }));

      order = new Order({
        serviceId,
        customerId: userId, // Service owner is the customer (person who pays)
        providerId: applicantId, // Applicant is the provider (person who does the work)
        status: 'awaiting_payment',
        initialPrice: service.price,
        agreedPrice: price,
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
    } finally {
      await lock.release();
    }

    // Link chat to order and vice versa
    // Direction-agnostic. This is the PRIMARY award path, and it looked only for
    // { clientId: owner, providerId: applicant } — while applying creates the chat the
    // other way round. So on the normal flow (applicant applies, owner awards) this
    // matched nothing: Order.chatId was never set, the "Kontrakt er opprettet!" message
    // never appeared, chat.status never became 'contracted', and because startJob and
    // markReadyForReview both guard on `if (order.chatId)`, their system messages never
    // posted either. The whole conversation timeline went silent the moment a job was
    // awarded.
    const chat = await Chat.findOneAndUpdate(
      pairChatFilter,
      { orderId: order._id, status: 'contracted', agreedPrice: price },
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

    // Update service status to awaiting_payment (contract created, waiting for payment)
    await Service.findByIdAndUpdate(serviceId, { status: 'awaiting_payment' });

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
    await notify({
      userId: applicantId,
      type: 'order',
      content: `Du er valgt til oppdraget "${service.title}" — venter på betaling.`,
      orderId: order._id,
      senderId: userId,
      event: 'worker_selected',
      payload: { orderId: String(order._id) },
    });

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

    if (String(order.providerId) === String(userId)) {
      if (!(await ensureProviderConnectReady(req, res, order.providerId))) return;
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
    await notify({
      userId: otherUserId,
      type: 'order',
      content: 'Oppdraget er startet.',
      orderId: order._id,
      senderId: userId,
      event: 'order_started',
      payload: { orderId: String(order._id) },
    });

    res.json({ message: 'Oppdraget startet', order });
  } catch (err) {
    console.error('Error starting job:', err);
    res.status(500).json({ error: 'Serverfeil ved start av oppdrag' });
  }
};

/**
 * GET /api/safepay/history/:userId
 * Get user's SafePay payment history with detailed breakdown
 */
exports.getSafePayHistory = async (req, res) => {
  try {
    const userId = req.params.userId || req.userId;

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

      const providerOrderIds = safePayRecords
        .filter((record) => String(record.providerId?._id || record.providerId) === String(userId))
        .map((record) => record.orderId);
      const [payouts, verifiedTransfers] = providerOrderIds.length
        ? await Promise.all([
            Payout.find({ orderId: { $in: providerOrderIds }, providerId: userId }).lean(),
            StripeTransferRecord.find({
              orderId: { $in: providerOrderIds },
              providerId: userId,
              normalizedStatus: { $in: ['transferred', 'partially_reversed', 'fully_reversed'] },
              lastVerifiedAt: { $ne: null },
            }).lean(),
          ])
        : [[], []];
      const payoutByOrder = new Map(payouts.map((payout) => [String(payout.orderId), payout]));
      const historyByOrder = new Map(
        safePayRecords.map((record) => [String(record.orderId), record])
      );
      const transferByOrder = new Map();
      for (const transfer of verifiedTransfers) {
        const key = String(transfer.orderId);
        const historyRecord = historyByOrder.get(key);
        const payout = payoutByOrder.get(key);
        const expectedMode = typeof historyRecord?.stripeLivemode === 'boolean'
          ? historyRecord.stripeLivemode
          : payout?.stripeLivemode;
        if (typeof expectedMode !== 'boolean' || transfer.livemode !== expectedMode) continue;
        const current = transferByOrder.get(key) || {
          amountMinor: 0,
          grossMinor: 0,
          stripeTransferId: null,
          transferDate: null,
        };
        const netAmountMinor = Math.max(
          0,
          Number(transfer.amount || 0) - Number(transfer.amountReversed || 0)
        );
        transferByOrder.set(
          key,
          {
            amountMinor: current.amountMinor + netAmountMinor,
            grossMinor: current.grossMinor + Number(transfer.amount || 0),
            stripeTransferId: netAmountMinor > 0
              ? transfer.stripeObjectId
              : current.stripeTransferId,
            transferDate: netAmountMinor > 0
              ? transfer.stripeCreatedAt || transfer.lastVerifiedAt
              : current.transferDate,
            reversed: current.reversed || (
              Number(transfer.amount || 0) > 0 &&
              Number(transfer.amountReversed || 0) >= Number(transfer.amount || 0)
            ),
          }
        );
      }

      const history = safePayRecords.map((record) => {
        // Get IDs from populated objects or directly from record
        const recordProviderId = record.providerId?._id
          ? String(record.providerId._id)
          : String(record.providerId);
        const recordCustomerId = record.customerId?._id
          ? String(record.customerId._id)
          : String(record.customerId);
        const isProvider = recordProviderId === String(userId);

        const originalPayment = Number.isSafeInteger(record.originalPaymentAmountMinor)
          ? record.originalPaymentAmountMinor / 100
          : record.amounts.totalCustomer;
        const recordedRefund = (record.refundedAmountMinor || 0) / 100;
        const refundedAmount =
          record.refundStatus === 'succeeded'
            ? Math.min(originalPayment, recordedRefund)
            : 0;
        const remainingPayment = Math.max(0, originalPayment - refundedAmount);
        const transfer = transferByOrder.get(String(record.orderId)) || {
          amountMinor: 0,
          grossMinor: 0,
          stripeTransferId: null,
          transferDate: null,
          reversed: false,
        };
        const payout = payoutByOrder.get(String(record.orderId));
        const transferredAmountMinor = transfer.amountMinor;
        const refundConfirmed =
          record.refundStatus === 'succeeded' ||
          ['refunded', 'automatically_cancelled'].includes(record.status);
        const countsAsEarnings = !refundConfirmed && transferredAmountMinor > 0;
        if (isProvider) {
          if (countsAsEarnings) totalEarned += transferredAmountMinor / 100;
          if (countsAsEarnings) totalFees += record.amounts.fee;
        } else {
          totalSpent += remainingPayment;
          totalFees += Math.max(0, record.amounts.fee - Math.min(record.amounts.fee, refundedAmount));
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
          paymentDate: record.paymentDate || record.createdAt,
          orderDate: record.createdAt,
          status: record.status,
          providerConnectStatus: record.providerConnectStatus,
          originalPaymentAmountMinor: record.originalPaymentAmountMinor,
          refundAmountMinor: record.refundAmountMinor || 0,
          refundedAmountMinor: record.refundedAmountMinor || 0,
          refundStatus: record.refundStatus || 'none',
          refundReason: record.refundReason,
          cancellationReason: record.cancellationReason,
          stripePaymentIntentId: record.stripePaymentIntentId,
          stripeRefundId: record.stripeRefundId,
          ...(typeof record.paymentMethodBrand === 'string'
            ? { paymentMethodBrand: record.paymentMethodBrand }
            : {}),
          ...(typeof record.paymentMethodLast4 === 'string' && /^\d{4}$/.test(record.paymentMethodLast4)
            ? { paymentMethodLast4: record.paymentMethodLast4 }
            : {}),
          stripeLivemode: record.stripeLivemode,
          providerTransferAmountMinor: transferredAmountMinor,
          hasVerifiedProviderTransfer: transfer.grossMinor > 0,
          providerTransferReversed: transfer.reversed,
          payoutStartedAt: payout?.transferInitiatedAt || payout?.lastAttemptedAt || null,
          payoutStatus: payout?.status === 'transferred' && transfer.grossMinor === 0
            ? 'reconciliation_required'
            : payout?.status,
          payoutFailureCode: payout?.failureCode || null,
          payoutFailureMessage: ['PAYOUT_SETUP_REQUIRED', 'PAYOUT_NOT_ENABLED'].includes(payout?.failureCode)
            ? 'Fullfør Stripe Connect-oppsettet for å kunne motta utbetaling.'
            : payout?.failureCode
              ? 'Utbetalingen kunne ikke fullføres. Kontakt kundestøtte hvis problemet vedvarer.'
              : null,
          stripeTransferId: transfer.stripeTransferId,
          transferDate: transfer.transferDate,
          transferLivemode: typeof record.stripeLivemode === 'boolean'
            ? record.stripeLivemode
            : payout?.stripeLivemode,
          payoutAmountMinor: Number.isFinite(payout?.netProviderAmount)
            ? Math.round(payout.netProviderAmount * 100)
            : Math.round(Number(record.amounts.netProvider || 0) * 100),
          refundCompletedAt: record.refundCompletedAt,
          refundFailedAt: record.refundFailedAt,
          providerConnectDeadlineAt: record.providerConnectDeadlineAt,
          transactionId: record.transactionId,
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
      const [payouts, verifiedTransfers] = orderIds.length
        ? await Promise.all([
            Payout.find({ orderId: { $in: orderIds }, providerId: userId }).lean(),
            StripeTransferRecord.find({
              orderId: { $in: orderIds },
              providerId: userId,
              normalizedStatus: { $in: ['transferred', 'partially_reversed', 'fully_reversed'] },
              lastVerifiedAt: { $ne: null },
            }).lean(),
          ])
        : [[], []];
      const payoutByOrder = new Map(payouts.map((payout) => [String(payout.orderId), payout]));
      const paymentByOrder = new Map(payments.map((payment) => [String(payment.orderId), payment]));
      const transferByOrder = new Map();
      for (const transfer of verifiedTransfers) {
        const key = String(transfer.orderId);
        const expectedMode = paymentByOrder.get(key)?.stripeLivemode ??
          payoutByOrder.get(key)?.stripeLivemode;
        if (typeof expectedMode !== 'boolean' || transfer.livemode !== expectedMode) continue;
        const current = transferByOrder.get(key) || {
          amountMinor: 0,
          grossMinor: 0,
          stripeTransferId: null,
          transferDate: null,
          reversed: false,
        };
        const netAmountMinor = Math.max(
          0,
          Number(transfer.amount || 0) - Number(transfer.amountReversed || 0)
        );
        transferByOrder.set(key, {
          amountMinor: current.amountMinor + netAmountMinor,
          grossMinor: current.grossMinor + Number(transfer.amount || 0),
          stripeTransferId: netAmountMinor > 0 ? transfer.stripeObjectId : current.stripeTransferId,
          transferDate: netAmountMinor > 0
            ? transfer.stripeCreatedAt || transfer.lastVerifiedAt
            : current.transferDate,
          reversed: current.reversed ||
            (Number(transfer.amount || 0) > 0 && Number(transfer.amountReversed || 0) >= Number(transfer.amount || 0)),
        });
      }

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
        const transfer = transferByOrder.get(String(order._id)) || {
          amountMinor: 0,
          grossMinor: 0,
          stripeTransferId: null,
          transferDate: null,
          reversed: false,
        };
        const payout = payoutByOrder.get(String(order._id));
        const transferredAmountMinor = transfer.amountMinor;

        if (isProvider) {
          totalEarned += transferredAmountMinor / 100;
          if (transfer.grossMinor > 0) totalFees += fee;
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
          providerTransferAmountMinor: transferredAmountMinor,
          hasVerifiedProviderTransfer: transfer.grossMinor > 0,
          providerTransferReversed: transfer.reversed,
          payoutAmountMinor: Math.round((payout?.netProviderAmount ?? netProvider) * 100),
          payoutStatus: payout?.status === 'transferred' && transfer.grossMinor === 0
            ? 'reconciliation_required'
            : payout?.status,
          payoutFailureCode: payout?.failureCode || null,
          payoutFailureMessage: ['PAYOUT_SETUP_REQUIRED', 'PAYOUT_NOT_ENABLED'].includes(payout?.failureCode)
            ? 'Fullfør Stripe Connect-oppsettet for å kunne motta utbetaling.'
            : payout?.failureCode
              ? 'Utbetalingen kunne ikke fullføres. Kontakt kundestøtte hvis problemet vedvarer.'
              : null,
          stripeTransferId: transfer.stripeTransferId,
          transferDate: transfer.transferDate,
          hasVerifiedProviderTransfer: transfer.grossMinor > 0,
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

    // The checklist is the record a dispute admin adjudicates from, and it is what the
    // customer approved against. There was no status guard at all, so after a job was
    // completed — or while a dispute was open and the money frozen — either party could
    // still flip items on and off, and be stamped into `checkedBy` doing it. Freeze it
    // once the work is no longer in flight.
    const EDITABLE_ORDER_STATUSES = ['paid', 'in_progress', 'ready_for_review'];
    if (!EDITABLE_ORDER_STATUSES.includes(order.status)) {
      return res.status(409).json({
        error: 'Sjekklisten kan ikke endres for dette oppdraget nå.',
        code: 'checklist_locked',
        status: order.status,
      });
    }

    const activeDispute = await Dispute.findOne({
      orderId: order._id,
      status: { $nin: ['resolved', 'closed', 'cancelled'] },
    }).select('_id');
    if (activeDispute) {
      return res.status(409).json({
        error: 'Sjekklisten er låst mens tvisten behandles.',
        code: 'checklist_locked_by_dispute',
      });
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
