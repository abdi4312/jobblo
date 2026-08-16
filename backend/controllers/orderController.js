const Order = require('../models/Order');
const Service = require('../models/Service');
const mongoose = require('mongoose');
const Chat = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const JobRequest = require('../models/JobRequest');

const User = require('../models/User');
const { calculatePointsFromService } = require('../utils/points');

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * The id behind an order reference, whether or not it has been populated.
 *
 * `getOrderById` populates `customerId` and `providerId` before authorising, so the ref
 * is a Mongoose document by the time it is checked and `.toString()` returns the whole
 * document rendered as a string — never an id. The comparison could not match, so the
 * endpoint answered 403 to the customer and the provider alike on every order.
 */
const refId = (ref) => {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return String(ref._id ?? ref);
};

// Helper to authorize order actions
function authorizeOrderAction(req, order) {
  const customerId = refId(order.customerId);
  const providerId = refId(order.providerId);
  if (!customerId || !providerId) return false;

  const userId = String(req.userId);
  return customerId === userId || providerId === userId;
}

/**
 * POST /api/orders/request
 * Opprett ny jobb-forespørsel (Application)
 */
exports.createJobRequest = async (req, res) => {
  try {
    const { serviceId, message } = req.body;
    const customerId = req.userId;

    if (!serviceId) return res.status(400).json({ error: 'Service ID is required' });

    if (!isValidId(serviceId)) return res.status(400).json({ error: 'Invalid service ID format' });

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ── Block applications on non-open services ───────────────────────────────
    const BLOCKED_STATUSES = [
      'completed', 'in_progress', 'closed', 'cancelled',
      'expired', 'draft', 'waiting_for_approval',
    ];
    if (BLOCKED_STATUSES.includes(service.status)) {
      const STATUS_MESSAGES = {
        completed:            'Dette oppdraget er allerede fullført.',
        in_progress:          'Dette oppdraget er under arbeid og tar ikke imot nye søknader.',
        closed:               'Dette oppdraget er lukket.',
        cancelled:            'Dette oppdraget er kansellert.',
        expired:              'Dette oppdraget har utløpt.',
        draft:                'Dette oppdraget er ikke publisert ennå.',
        waiting_for_approval: 'Dette oppdraget venter på godkjenning.',
      };
      return res.status(400).json({
        error: STATUS_MESSAGES[service.status] || 'Dette oppdraget er ikke tilgjengelig.',
        serviceStatus: service.status,
      });
    }

    // Block if an active order/contract already exists for this service
    const activeOrder = await Order.findOne({
      serviceId,
      status: { $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'disputed'] },
    });
    if (activeOrder) {
      return res.status(400).json({
        error: 'En utfører er allerede valgt for dette oppdraget.',
        serviceStatus: service.status,
      });
    }

    const providerId = service.userId;

    if (providerId.toString() === customerId)
      return res.status(400).json({ error: 'Cannot request your own service' });

    // --- CHECK APPLICATION LIMIT (HIDDEN FOR NOW) ---
    // if (service.maxApplicants > 0) {
    //   const applicantCount = await JobRequest.countDocuments({
    //     serviceId,
    //     status: { $in: ['pending', 'accepted'] },
    //   });

    //   if (applicantCount >= service.maxApplicants) {
    //     return res.status(400).json({
    //       error: 'Søknadsfristen er nådd. Dette oppdraget tar ikke imot flere søknader.',
    //       limitReached: true,
    //     });
    //   }
    // }
    // -------------------------------

    // Check if a request already exists
    const existingRequest = await JobRequest.findOne({
      serviceId,
      customerId,
      status: 'pending',
    });
    if (existingRequest) {
      return res.status(400).json({
        error: 'Du har allerede sendt en forespørsel på dette oppdraget',
      });
    }

    const jobRequest = await JobRequest.create({
      serviceId,
      customerId,
      providerId,
      ...(message && { message }),
    });

    // --- INCREMENT CONTACT USAGE ---
    if (!req.isFreeContact) {
      await User.findByIdAndUpdate(customerId, {
        $inc: { monthlyContactUsage: 1 },
      });
    }
    // -------------------------------

    await jobRequest.populate('serviceId');
    await jobRequest.populate('customerId', 'name');

    // ── Create or get Chat so it appears in "Forespørsler Sendt" ──────────────
    const Chat = require('../models/ChatMessage');
    let chat = await Chat.findOne({
      clientId: customerId,   // applicant
      providerId: providerId, // job owner
      serviceId,
    });

    if (!chat) {
      const initialMessages = [];
      // Add the application message as first chat message if provided
      if (req.body.message) {
        initialMessages.push({
          senderId: customerId,
          text: req.body.message,
          createdAt: new Date(),
          seenBy: [customerId],
        });
      }
      // Add system message about the application
      initialMessages.push({
        type: 'system_status',
        systemData: { event: 'application_submitted', requestId: jobRequest._id },
        text: `Forespørsel sendt for "${service.title}"`,
        createdAt: new Date(),
      });

      chat = await Chat.create({
        clientId: customerId,
        providerId: providerId,
        serviceId,
        messages: initialMessages,
        lastMessage: req.body.message || `Forespørsel sendt for "${service.title}"`,
        status: 'requested',
      });
    }

    // Send notification to provider
    const notification = await Notification.create({
      userId: providerId,
      senderId: customerId,
      requestId: jobRequest._id,
      type: 'order',
      content: `Ny forespørsel: ${jobRequest.customerId.name} ønsker å søke på "${jobRequest.serviceId.title}"`,
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${providerId}`).emit('new_notification', notification);
      io.to(`user_${providerId}`).emit('new_job_request', jobRequest);
    }

    res.status(201).json({ ...jobRequest.toObject(), chatId: chat._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /api/orders/request/:id
 * Godkjenn eller avvis forespørsel
 */
exports.updateJobRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.userId;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const jobRequest = await JobRequest.findById(id);
    if (!jobRequest) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (jobRequest.providerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 🔒 Prevent multiple status changes
    if (jobRequest.status !== 'pending') {
      return res.status(400).json({
        error: `Forespørselen er allerede ${jobRequest.status === 'accepted' ? 'godkjent' : 'avvist'}`,
      });
    }

    jobRequest.status = status;
    await jobRequest.save();

    if (status === 'accepted') {
      // 1. Create Chat
      let chat = await Chat.findOne({
        clientId: jobRequest.customerId,
        providerId: jobRequest.providerId,
        serviceId: jobRequest.serviceId,
      });

      if (!chat) {
        chat = await Chat.create({
          clientId: jobRequest.customerId,
          providerId: jobRequest.providerId,
          serviceId: jobRequest.serviceId,
          messages: [
            {
              senderId: jobRequest.providerId,
              text: 'Forespørsel godkjent! Vi kan nå starte samtalen.',
            },
          ],
        });
      }

      const service = await Service.findById(jobRequest.serviceId);

      // 3. Notify Customer
      const notification = await Notification.create({
        userId: jobRequest.customerId,
        senderId: jobRequest.providerId,
        requestId: jobRequest._id,
        type: 'order',
        content: `Din forespørsel for "${service.title}" er godkjent!`,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${jobRequest.customerId}`).emit('new_notification', notification);
        io.to(`user_${jobRequest.customerId}`).emit('order_approved', {
          requestId: jobRequest._id,
          chatId: chat._id,
        });
      }
    } else {
      // Notify Rejection
      await jobRequest.populate('serviceId');
      const notification = await Notification.create({
        userId: jobRequest.customerId,
        senderId: jobRequest.providerId,
        requestId: jobRequest._id,
        type: 'order',
        content: `Din forespørsel for "${jobRequest.serviceId.title}" ble avvist.`,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${jobRequest.customerId}`).emit('new_notification', notification);
      }
    }

    res.json(jobRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/orders/requests/my
 */
exports.getMyJobRequests = async (req, res) => {
  try {
    const userId = req.userId;
    const requests = await JobRequest.find({
      $or: [{ customerId: userId }, { providerId: userId }],
    })
      .populate('serviceId')
      .populate('customerId', 'name')
      .populate('providerId', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/orders
 * Hent alle ordre relatert til bruker (både som kunde og tilbyder)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const userId = req.userId;

    const orders = await Order.find({
      $or: [{ customerId: userId }, { providerId: userId }],
    })
      .populate('serviceId')
      .populate('customerId', 'name avatarUrl')
      .populate('providerId', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .lean();

    // Email is contact information, and an Order exists from the moment the job is
    // awarded — before any money moves. Populating 'name email' here handed both
    // parties each other's address at `awaiting_payment`, which is precisely the
    // point at which they can agree to settle off-platform. Released only once the
    // payment is confirmed, which is when they legitimately need to reach each other.
    const paidOrderIds = orders
      .filter((o) => o.paymentStatus === 'paid')
      .map((o) => o._id);

    if (paidOrderIds.length > 0) {
      const contactIds = new Set();
      for (const o of orders) {
        if (o.paymentStatus !== 'paid') continue;
        if (o.customerId?._id) contactIds.add(String(o.customerId._id));
        if (o.providerId?._id) contactIds.add(String(o.providerId._id));
      }
      const contacts = await User.find({ _id: { $in: [...contactIds] } })
        .select('email')
        .lean();
      const emailById = new Map(contacts.map((u) => [String(u._id), u.email]));

      for (const o of orders) {
        if (o.paymentStatus !== 'paid') continue;
        if (o.customerId?._id) o.customerId.email = emailById.get(String(o.customerId._id));
        if (o.providerId?._id) o.providerId.email = emailById.get(String(o.providerId._id));
      }
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/orders/:id
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid order ID format' });

    const order = await Order.findById(id)
      .populate('serviceId')
      .populate('customerId', 'name')
      .populate('providerId', 'name');

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Authorization
    if (!authorizeOrderAction(req, order)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/orders
 * Opprett ny ordre
 */
exports.createOrder = async (req, res) => {
  try {
    const { serviceId } = req.body;
    const customerId = req.userId;

    if (!serviceId) return res.status(400).json({ error: 'Service ID is required' });

    if (!isValidId(serviceId)) return res.status(400).json({ error: 'Invalid service ID format' });

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const providerId = service.userId;

    if (providerId.toString() === customerId)
      return res.status(400).json({ error: 'Cannot order your own service' });

    // Check if an order already exists for this service and customer
    const existingOrder = await Order.findOne({ serviceId, customerId });
    if (existingOrder) {
      return res.status(400).json({
        error: 'Du har allerede sendt en forespørsel på dette oppdraget',
      });
    }

    const order = await Order.create({
      serviceId,
      customerId,
      providerId,
      price: service.price,
      status: 'pending',
    });

    await order.populate('serviceId');
    await order.populate('customerId', 'name');
    await order.populate('providerId', 'name');

    // Send notification to provider
    const notification = await Notification.create({
      userId: providerId,
      senderId: customerId,
      orderId: order._id,
      type: 'order',
      content: `Ny forespørsel: ${order.customerId.name} ønsker å søke på "${order.serviceId.title}"`,
    });

    // Emit socket event for real-time alert
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${providerId}`).emit('new_notification', notification);
      io.to(`user_${providerId}`).emit('new_order_request', order);
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * REMOVED: PATCH /api/orders/:id (updateOrder)
 *
 * Its private statusFlow declared `paid: ['completed']` and authorizeOrderAction
 * accepts EITHER party, so a provider could complete their own paid order: past
 * review, past evidence, and past releasePayoutToProvider. approveAndPayout then
 * refused the customer''s approval as "already completed" and the escrowed money
 * had no remaining route out.
 *
 * Order transitions now go through services/order/orderState.js, which owns the
 * one legality table and refuses any terminal state that would leave captured
 * money unaccounted for. The supported paths are the SafePay flow and the admin
 * routes under /api/admin/orders.
 */


/**
 * GET /api/orders/:id/completed-details
 * Get detailed information for a completed job (order, service, payment, chat, etc.)
 */
exports.getCompletedJobDetails = async (req, res) => {
  try {
    const { id } = req.params; // id is orderId

    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid order ID format' });

    const order = await Order.findById(id)
      .populate('serviceId')
      .populate('customerId', 'name email avatarUrl')
      .populate('providerId', 'name email avatarUrl');

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Authorization
    if (!authorizeOrderAction(req, order)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get payment
    const payment = await Payment.findOne({ orderId: id });

    // Get chat messages
    const ChatMessage = require('../models/ChatMessage');
    const chat = await ChatMessage.findOne({
      clientId: order.customerId._id,
      providerId: order.providerId._id,
      serviceId: order.serviceId._id,
    });

    // Get all transactions (optional, from Transaction model if exists)
    let transactions = [];
    try {
      const Transaction = require('../models/Transaction');
      transactions = await Transaction.find({ orderId: id }).sort({
        createdAt: -1,
      });
    } catch (e) {
      // Transaction model might not exist, ignore
    }

    res.json({
      order,
      service: order.serviceId,
      customer: order.customerId,
      provider: order.providerId,
      payment,
      chat,
      transactions,
      timeline: order.history,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * REMOVED: DELETE /api/orders/:id (deleteOrder)
 *
 * Set status to cancelled from ANY state — including paid, in_progress and
 * ready_for_review — with no refund, no payout and no dispute check, available to
 * either party. Cancelling a paid order is now only reachable through the dispute
 * resolution flow, which records where the money went.
 */

