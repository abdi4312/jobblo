const Order = require('../models/Order');
const Service = require('../models/Service');
const mongoose = require('mongoose');
const Chat = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const JobRequest = require('../models/JobRequest');

const User = require('../models/User');
const { calculatePointsFromService } = require('../utils/points');
const { notify } = require('../services/notifications');

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
    // Direction-agnostic: match the pair, not the slots. If the owner messaged the
    // applicant first, the chat exists as { clientId: owner, providerId: applicant },
    // and a slot-specific lookup here would miss it and open a second conversation for
    // the same pair and job.
    let chat = await Chat.findOne({
      serviceId,
      $or: [
        { clientId: customerId, providerId }, // applicant applied first
        { clientId: providerId, providerId: customerId }, // owner messaged first
      ],
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

    // Tell the job owner someone applied. `notify` creates and delivers in one call, so
    // this can never again end up written to the database but not sent.
    await notify({
      userId: providerId,
      senderId: customerId,
      requestId: jobRequest._id,
      type: 'application',
      content: `${jobRequest.customerId.name} har søkt på "${jobRequest.serviceId.title}"`,
      event: 'new_job_request',
      payload: jobRequest,
    });

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
      // Same direction-agnostic match as createJobRequest — otherwise accepting a
      // request opens a duplicate conversation whenever the owner messaged first.
      let chat = await Chat.findOne({
        serviceId: jobRequest.serviceId,
        $or: [
          { clientId: jobRequest.customerId, providerId: jobRequest.providerId },
          { clientId: jobRequest.providerId, providerId: jobRequest.customerId },
        ],
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

      // 3. Notify the applicant
      await notify({
        userId: jobRequest.customerId,
        senderId: jobRequest.providerId,
        requestId: jobRequest._id,
        type: 'application',
        content: `Søknaden din på "${service.title}" er godkjent`,
        event: 'order_approved',
        payload: { requestId: jobRequest._id, chatId: chat._id },
      });
    } else {
      // Notify Rejection
      await jobRequest.populate('serviceId');
      await notify({
        userId: jobRequest.customerId,
        senderId: jobRequest.providerId,
        requestId: jobRequest._id,
        type: 'application',
        content: `Søknaden din på "${jobRequest.serviceId.title}" ble ikke valgt denne gangen`,
        event: 'request_declined',
        payload: { requestId: jobRequest._id },
      });
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
 * REMOVED: POST /api/orders (createOrder)
 *
 * Two problems, either of which is disqualifying:
 *
 *  1. It built the Order with the roles INVERTED. Every other path treats the job
 *     owner as the payer (safepayController: "Service owner is the customer"), but
 *     this set customerId to the CALLER and providerId to the service owner. The
 *     resulting order sat at status 'pending', which confirmPaidSession accepts, so
 *     it was fully payable — a second account could order a stranger's 1 kr listing,
 *     pay it, complete it, and inflate the listing owner's completedJobs and earnings.
 *
 *  2. It required no application, no ownership and no service-status check.
 *
 * No component called it (the useCreateOrderMutation hook existed but was unused).
 * Orders are created by the award flow: POST /api/safepay/create-contract, or
 * POST /api/chats/:chatId/contracts — both of which verify service ownership and
 * derive payer/payee from the service.
 */


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
    // Order.customerId is the job OWNER and Order.providerId is the worker, but the
    // chat created by applying stores them the other way round — so this slot-specific
    // lookup returned null for every apply-created conversation and the completed-job
    // view showed no message history at all. Prefer the chat the order already points
    // at; fall back to a direction-agnostic pair match for older orders.
    const chat = order.chatId
      ? await ChatMessage.findById(order.chatId)
      : await ChatMessage.findOne({
          serviceId: order.serviceId._id,
          $or: [
            { clientId: order.customerId._id, providerId: order.providerId._id },
            { clientId: order.providerId._id, providerId: order.customerId._id },
          ],
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

