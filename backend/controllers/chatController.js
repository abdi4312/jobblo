const User = require('../models/User');
const Chat = require('../models/ChatMessage');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Dispute = require('../models/Dispute');
const JobRequest = require('../models/JobRequest');
const { getStripe } = require('../config/stripe');
const { resolveStripeCustomer } = require('../services/stripe/customers');
const mongoose = require('mongoose');
const { sendPushToUser } = require('../services/pushNotifications');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Ceiling for a negotiated price. Stripe rejects unit_amount above ~1e8 øre. */
const MAX_AGREED_PRICE = 1000000;

/** Longest single chat message. Guards the 16 MB per-document limit — see sendMessage. */
const MAX_MESSAGE_LENGTH = 5000;

/** Ceiling on how many messages one request may pull from a thread. */
const MAX_MESSAGE_PAGE = 200;

exports.createOrGetChat = async (req, res) => {
  try {
    const { providerId, serviceId } = req.body;
    let { id } = req.user;

    if (!serviceId) {
      return res.status(400).json({ message: 'Service ID is required.' });
    }

    // Unvalidated ids reached findById and threw a CastError → 500 instead of 400.
    if (!isValidId(serviceId) || !isValidId(providerId)) {
      return res.status(400).json({ message: 'Invalid ID format.' });
    }

    if (id === providerId) {
      return res.status(400).json({ message: 'You cannot create a chat with yourself.' });
    }

    const provider = await User.findById(providerId).select('role name');
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    // Both people must have a real relationship to this job.
    //
    // The only checks here used to be "not yourself" and "the other user exists" —
    // nothing tied either party to the service. Any authenticated user could therefore
    // open a conversation with any other user by supplying a scraped user id and any
    // service id, and it arrived in the victim's inbox looking like a legitimate job
    // conversation. That is a direct spam and harassment channel, and it also let a
    // stranger seed a chat they could later try to create a contract from.
    //
    // A conversation about a job is between its owner and someone who applied to it.
    const service = await Service.findById(serviceId).select('userId');
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const ownerId = String(service.userId);
    const callerIsOwner = ownerId === String(id);
    const targetIsOwner = ownerId === String(providerId);

    if (!callerIsOwner && !targetIsOwner) {
      return res.status(403).json({
        message: 'Du kan bare starte en samtale om et oppdrag du eier eller har søkt på.',
        code: 'not_related_to_service',
      });
    }

    // The non-owner side must actually have applied.
    const applicantId = callerIsOwner ? providerId : id;
    const application = await JobRequest.findOne({
      serviceId,
      customerId: applicantId, // JobRequest.customerId is the applicant
    }).select('_id');

    if (!application) {
      return res.status(403).json({
        message: 'Det finnes ingen søknad som knytter dere til dette oppdraget.',
        code: 'no_application_between_parties',
      });
    }

    // Direction-agnostic: match the PAIR, not the slots.
    //
    // Applying to a job creates the chat as { clientId: applicant, providerId: owner }
    // (orderController.createJobRequest). When the owner then pressed "Send melding"
    // this looked for { clientId: owner, providerId: applicant } — the same two people
    // the other way round — found nothing, and created a SECOND conversation for the
    // same pair and the same job. The duplicate also put the owner in the clientId
    // slot, which every role-aware view reads as "the applicant", so the owner
    // appeared to have applied to their own listing.
    const pairFilter = {
      serviceId,
      $or: [
        { clientId: id, providerId },
        { clientId: providerId, providerId: id },
      ],
    };

    // One atomic operation rather than find-then-create.
    //
    // Reading first and inserting afterwards is a check-then-act race: two requests for the
    // same pair — a double-clicked button, or the applicant and the owner opening the
    // conversation at the same moment — both read "no chat here" before either has written,
    // so both insert. `findOneAndUpdate ... upsert` collapses that into a single matched
    // write, and `$setOnInsert` means an existing conversation is never overwritten by the
    // second caller's slot order.
    //
    // `$pull` on the same call restores the thread for someone who had deleted it, which
    // used to be a second round trip.
    const result = await Chat.findOneAndUpdate(
      pairFilter,
      {
        $setOnInsert: { clientId: id, providerId, serviceId, messages: [] },
        $pull: { deletedFor: new mongoose.Types.ObjectId(id) },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        // Tells us whether this call created the conversation, so the status code stays
        // honest — the client distinguishes 200 from 201.
        includeResultMetadata: true,
      }
    );

    const created = !result.lastErrorObject?.updatedExisting;

    const chat = await Chat.findById(result.value._id)
      .populate('clientId', 'name')
      .populate('providerId', 'name')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId');

    res.status(created ? 201 : 200).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyChats = async (req, res) => {
  try {
    const { id } = req.user;

    // The inbox needs the last message, not every message ever sent.
    //
    // This returned each chat's FULL history, and the client invalidates the chats
    // query on every inbound message and every read receipt — so a user with a few
    // long-running conversations re-downloaded the entire corpus on each event. The
    // unread indicator only ever inspects the most recent message, so `$slice: -1`
    // gives the UI exactly what it reads.
    const chats = await Chat.find({
      $or: [{ clientId: id }, { providerId: id }],
      deletedFor: { $ne: id },
    })
      .select({ messages: { $slice: -1 } })
      .populate('clientId', 'name role avatarUrl')
      .populate('providerId', 'name role avatarUrl')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId')
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId } = req.params;

    if (!isValidId(chatId)) return res.status(400).json({ error: 'Invalid chat ID format' });

    // Paginate the thread. It used to return every message with each sender populated,
    // so a long-running job's conversation grew into a large response on every open —
    // and the client refetches this whenever a message or read receipt arrives.
    //
    // `offset` counts backwards from the newest message, so offset=0 is the most recent
    // page and the client raises it to walk further back. Messages stay in chronological
    // order within the page, which is how the thread renders.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_MESSAGE_PAGE);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // Authorize before reading the messages at all.
    const meta = await Chat.findById(chatId).select('clientId providerId messages');
    if (!meta) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    if (String(meta.clientId) !== String(id) && String(meta.providerId) !== String(id)) {
      return res.status(403).json({ message: 'Unauthorized: You are not part of this chat.' });
    }

    const totalMessages = meta.messages?.length || 0;

    const chat = await Chat.findById(chatId)
      .select({ messages: { $slice: [-(offset + limit), limit] } })
      .populate('clientId', 'name avatarUrl')
      .populate('providerId', 'name avatarUrl')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId')
      .populate('messages.senderId', 'name avatarUrl');

    const payload = chat.toObject();
    payload.messagePage = {
      total: totalMessages,
      limit,
      offset,
      // True when older messages remain to be fetched.
      hasMore: offset + limit < totalMessages,
    };

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const { id } = req.user;
    const { chatId } = req.params;

    if (!isValidId(chatId)) return res.status(400).json({ error: 'Invalid chat ID format' });

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // 🔒 Authorization check: user must be either client or provider of this chat
    if (chat.clientId._id.toString() !== id && chat.providerId._id.toString() !== id) {
      return res.status(403).json({ message: 'Unauthorized: You are not part of this chat.' });
    }

    // `text` was stored with no validation at all. Two consequences: an empty body
    // wrote a message with `text: undefined` and set `lastMessage: undefined`, showing
    // a blank unread row in the inbox; and with no length cap, the 12 MB JSON body
    // limit meant two messages could push the chat document past MongoDB's 16 MB
    // ceiling — after which every save on that conversation fails, permanently
    // breaking messaging, contract creation and payment confirmation for that job.
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Meldingen kan ikke være tom.' });
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({ message: `Meldingen er for lang (maks ${MAX_MESSAGE_LENGTH} tegn).` });
    }

    const trimmed = text.trim();
    const message = {
      senderId: id,
      text: trimmed,
      createdAt: new Date(),
      seenBy: [id],
    };

    chat.messages.push(message);
    const savedMessage = chat.messages[chat.messages.length - 1];
    chat.lastMessage = trimmed;
    // A new message brings the conversation back for anyone who had hidden it —
    // otherwise a reply landed in an inbox the recipient could no longer see, and the
    // chat stayed invisible to them forever.
    chat.deletedFor = [];

    await chat.save();

    const messagePayload = typeof savedMessage.toObject === 'function'
      ? savedMessage.toObject()
      : savedMessage;

    // Emit socket event to notify users in the chat room
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${chatId}`).emit('receive-message', {
        chatId,
        message: messagePayload,
      });
    }

    const recipientId = chat.clientId.toString() === id
      ? chat.providerId.toString()
      : chat.clientId.toString();
    void sendPushToUser(recipientId, {
      title: 'Ny melding på Jobblo',
      body: trimmed,
      data: { type: 'chat_message', chatId },
    });

    res.status(201).json(messagePayload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/chat/:id/delete-for-me
 */

exports.deleteForMe = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { id } = req.user;

    if (!isValidId(chatId)) return res.status(400).json({ error: 'Invalid chat ID format' });

    // There was no authorization here at all: any authenticated user could append their
    // id to ANY chat's `deletedFor`, on a document they have no relationship to, with
    // no bound on the array. Only a participant may hide their own copy.
    const chat = await Chat.findById(chatId).select('clientId providerId');
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (String(chat.clientId) !== String(id) && String(chat.providerId) !== String(id)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await Chat.findByIdAndUpdate(chatId, {
      $addToSet: { deletedFor: id },
    });

    res.json({ success: true, message: 'Chat hidden' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/chat/:id
 * Permanent delete — only for sender
 */
exports.createPaymentSession = async (req, res) => {
  try {
    const stripe = await getStripe();
    const { id } = req.user;
    const { chatId } = req.params;

    if (!isValidId(chatId)) return res.status(400).json({ error: 'Invalid chat ID format' });

    const chat = await Chat.findById(chatId).populate('serviceId').populate('orderId');

    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // 🔒 Authorization check
    if (chat.clientId._id.toString() !== id && chat.providerId._id.toString() !== id)
      return res.status(403).json({ error: 'Not allowed' });

    // Check if there's an existing order
    let order = chat.orderId;
    if (!order) {
      return res
        .status(400)
        .json({ error: 'No order exists for this chat. Please create a contract first.' });
    }

    // Only the payer may start the checkout.
    //
    // The participant check above let the WORKER open a payment session. The session's
    // metadata.userId then carried the worker's id, and confirmPaidSession rejects a
    // session whose customer does not match the order (session_customer_mismatch) — so
    // the card was charged, Stripe held the money, and the order was never marked paid
    // and never refunded. Silent loss with no recovery path.
    if (String(order.customerId) !== String(id)) {
      return res.status(403).json({
        error: 'Bare oppdragsgiveren kan betale for dette oppdraget.',
        code: 'not_the_payer',
      });
    }

    // Do not open a second checkout for an order that is already paid or under way.
    // createSafePaySession guards this; this route did not, so paying twice was one
    // button press away and the second payment was silently dropped by
    // confirmPaidSession's already-confirmed branch.
    const PAYABLE_STATUSES = ['awaiting_payment', 'pending', 'accepted'];
    if (order.paymentStatus === 'paid' || !PAYABLE_STATUSES.includes(order.status)) {
      return res.status(409).json({
        error: 'Dette oppdraget er allerede betalt eller i gang.',
        code: 'order_not_payable',
      });
    }

    // Create Stripe checkout session
    const fee = Math.round((chat.agreedPrice || order.agreedPrice || chat.serviceId.price) * 0.03);
    const total = (chat.agreedPrice || order.agreedPrice || chat.serviceId.price) + fee;

    if (total < 3) {
      return res.status(400).json({ error: 'Minimum amount for payment is 3 kr including fee.' });
    }

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5174';
    const user = await User.findById(id);

    // Was passing user.stripeCustomerId straight through — undefined for anyone who
    // had never bought before, and a foreign-mode id for anyone who had. Both reach
    // Stripe as an error rather than a checkout page.
    const stripeCustomerId = await resolveStripeCustomer(stripe, user);

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nok',
            product_data: {
              name: `SafePay: ${chat.serviceId.title}`,
              description: `Chat: ${chat._id.toString().substring(0, 8).toUpperCase()}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/safepay/success?session_id={CHECKOUT_SESSION_ID}&chatId=${chatId}`,
      cancel_url: `${frontendUrl}/chats/${chatId}`,
      metadata: {
        userId: id,
        chatId: chatId.toString(),
        orderId: order._id.toString(),
        type: 'safepay_payment',
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating payment session:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createContract = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId } = req.params;
    const { agreedPrice } = req.body;

    if (!isValidId(chatId)) return res.status(400).json({ error: 'Invalid chat ID format' });

    const chat = await Chat.findById(chatId).populate('serviceId');
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // 🔒 Authorization check — participant in the conversation.
    if (chat.clientId._id.toString() !== id && chat.providerId._id.toString() !== id)
      return res.status(403).json({ error: 'Not allowed' });

    // 🔒 Awarding the job is the SERVICE OWNER's decision, not any participant's.
    //
    // Participation was the only check here. In an owner-initiated chat the applicant
    // occupies chat.providerId, so the applicant could award themselves the contract —
    // at a price of their own choosing, taken from the request body below — and the
    // owner would then find a contract they never created, unable to make the real
    // one. The web UI already gates this button behind isServiceOwner; the server did
    // not, which is the half that matters.
    if (!chat.serviceId?.userId || String(chat.serviceId.userId) !== String(id)) {
      return res.status(403).json({
        error: 'Bare oppdragsgiveren kan opprette kontrakten',
      });
    }

    // Check if contract/order already exists
    if (chat.orderId) {
      return res.status(400).json({ error: 'Contract already exists for this chat' });
    }

    // The same "any order at all" check safepayController makes, for the same reason:
    // without it the two contract paths can both produce an order for one service.
    const blockingOrder = await Order.findOne({
      serviceId: chat.serviceId._id,
      status: {
        $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'disputed', 'completed'],
      },
    });
    if (blockingOrder) {
      return res.status(400).json({ error: 'Kontrakt finnes allerede for dette oppdraget' });
    }

    // Create order (contract)
    const checklist = (chat.serviceId.checklist || []).map((item) => ({
      id: item.id,
      text: item.text,
      checked: false,
    }));

    // Price comes from the negotiated value on the chat or the listing — never
    // straight from this request body. `agreedPrice` was accepted verbatim, so
    // whoever called this endpoint set the contract price unilaterally.
    const price = chat.agreedPrice || chat.serviceId.price;

    // Who pays and who gets paid is decided by the SERVICE, not by the chat slots.
    //
    // These used to be `chat.clientId` → customerId and `chat.providerId` → providerId.
    // A chat created by the applicant applying stores { clientId: applicant,
    // providerId: owner }, so creating the contract from that conversation produced an
    // order with the applicant as the payer and the owner as the payee — the money
    // pointing the wrong way. The owner sees the "Opprett kontrakt" button in either
    // conversation (it keys off service ownership), so that path was reachable.
    //
    // The job owner always pays; the other participant always does the work. This
    // matches safepayController.createContract, which is the primary award path.
    const serviceOwnerId = String(chat.serviceId.userId);
    const participants = [String(chat.clientId._id), String(chat.providerId._id)];
    const workerId = participants.find((p) => p !== serviceOwnerId);

    if (!workerId) {
      return res.status(400).json({ error: 'Fant ikke motparten i denne samtalen.' });
    }

    const order = new Order({
      chatId: chat._id,
      serviceId: chat.serviceId._id,
      customerId: serviceOwnerId,
      providerId: workerId,
      status: 'awaiting_payment',
      initialPrice: chat.serviceId.price,
      agreedPrice: price,
      checklist,
      history: [
        {
          action: 'contract_created',
          userId: id,
          timestamp: new Date(),
          data: { message: 'SafePay contract created' },
        },
      ],
    });

    await order.save();

    // Update chat
    chat.orderId = order._id;
    chat.status = 'contracted';
    chat.agreedPrice = price;

    // Add system message
    chat.messages.push({
      type: 'system_contract',
      systemData: { orderId: order._id, agreedPrice: price },
      text: `Kontrakt opprettet med pris på ${price} kr`,
      createdAt: new Date(),
    });

    await chat.save();

    // Update service status to awaiting_payment (contract created, waiting for payment)
    await Service.findByIdAndUpdate(chat.serviceId._id, { status: 'awaiting_payment' });

    // Populate chat for response
    const updatedChat = await Chat.findById(chatId)
      .populate('clientId', 'name avatarUrl')
      .populate('providerId', 'name avatarUrl')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId')
      .populate('messages.senderId', 'name avatarUrl');

    res.status(201).json(updatedChat);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateAgreedPrice = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId } = req.params;
    const { agreedPrice } = req.body;

    if (!isValidId(chatId)) return res.status(400).json({ error: 'Invalid chat ID format' });

    // `agreedPrice >= 0` allowed 0, which is falsy — so `chat.agreedPrice || price`
    // in createContract and createPaymentSession silently fell back to the listing
    // price while the chat displayed "Pris avtalt: 0 kr". And there was no ceiling, so
    // a huge number overflowed Stripe's maximum unit_amount and 500'd at checkout.
    if (typeof agreedPrice !== 'number' || !Number.isFinite(agreedPrice) || agreedPrice <= 0) {
      return res.status(400).json({ error: 'Prisen må være et positivt beløp.' });
    }
    if (agreedPrice > MAX_AGREED_PRICE) {
      return res
        .status(400)
        .json({ error: `Prisen kan ikke overstige ${MAX_AGREED_PRICE} kr.` });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // Authorization check: user must be part of the chat
    if (chat.clientId.toString() !== id && chat.providerId.toString() !== id)
      return res.status(403).json({ error: 'Not allowed' });

    // Once a contract exists the price is settled — the Order carries it, and escrow
    // is calculated from it.
    //
    // Without this, either party could renegotiate the chat price AFTER the contract
    // and then start checkout, which prefers the chat value: agree 5000, set the chat
    // to 3, pay 3 kr, and confirmPaidSession still flips the 5000 kr order to fully
    // paid — the provider is later released `order.agreedPrice - fee` that the
    // platform never collected. The UI hides the edit control once an order exists;
    // this is the server-side half of that rule.
    if (chat.orderId) {
      return res.status(409).json({
        error: 'Prisen kan ikke endres etter at kontrakten er opprettet.',
        code: 'price_locked_by_contract',
      });
    }

    // Update chat
    chat.agreedPrice = agreedPrice;
    // Only advance the badge from a pre-contract state. Overwriting unconditionally
    // dragged a live job's chat back to "agreed" from paid/in_progress.
    if (!chat.status || ['requested', 'agreed'].includes(chat.status)) {
      chat.status = 'agreed';
    }

    // Add system message
    chat.messages.push({
      type: 'system_status',
      systemData: { agreedPrice },
      text: `Pris avtalt: ${agreedPrice} kr`,
      createdAt: new Date(),
    });

    await chat.save();

    // Populate chat for response
    const updatedChat = await Chat.findById(chatId)
      .populate('clientId', 'name avatarUrl')
      .populate('providerId', 'name avatarUrl')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId')
      .populate('messages.senderId', 'name avatarUrl');

    res.json(updatedChat);
  } catch (error) {
    console.error('Error updating agreed price:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const { id } = req.user;
    if (!id) return res.status(401).json({ error: 'Unauthorized' });

    const { chatId } = req.params;

    if (!isValidId(chatId)) return res.status(400).json({ error: 'Invalid chat ID format' });

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    if (chat.clientId.toString() !== id && chat.providerId.toString() !== id)
      return res.status(403).json({ error: 'Not allowed' });

    // A conversation attached to money — or to an open dispute — is the record an
    // adjudication rests on. This was a hard delete available to EITHER party at any
    // order state, which meant the accused could destroy the evidence, along with the
    // contract and payment system messages. `deleteForMe` still hides it from their
    // own list without removing it for anyone else.
    if (chat.orderId) {
      const order = await Order.findById(chat.orderId).select('status paymentStatus').lean();
      const PROTECTED_ORDER_STATUSES = [
        'awaiting_payment',
        'paid',
        'in_progress',
        'ready_for_review',
        'disputed',
      ];
      if (order && (PROTECTED_ORDER_STATUSES.includes(order.status) || order.paymentStatus === 'paid')) {
        return res.status(409).json({
          error:
            'Samtalen er knyttet til et aktivt oppdrag med betaling og kan ikke slettes. Du kan skjule den for deg selv i stedet.',
          code: 'chat_locked_by_order',
        });
      }

      const activeDispute = await Dispute.findOne({
        orderId: chat.orderId,
        status: { $nin: ['resolved', 'closed', 'cancelled'] },
      }).select('_id');
      if (activeDispute) {
        return res.status(409).json({
          error: 'Samtalen er bevis i en aktiv tvist og kan ikke slettes.',
          code: 'chat_locked_by_dispute',
        });
      }
    }

    // An abuse report points at this conversation, and the common harassment /
    // off-platform-payment case has NO order — so the order guard above did not cover
    // it. The reported user could delete the thread and leave the admin opening a
    // report that resolves to null.
    const ChatReport = require('../models/ChatReport');
    const openReport = await ChatReport.findOne({
      chatId,
      status: { $nin: ['resolved', 'dismissed', 'closed'] },
    }).select('_id');
    if (openReport) {
      return res.status(409).json({
        error: 'Samtalen er under vurdering etter en rapport og kan ikke slettes.',
        code: 'chat_locked_by_report',
      });
    }

    await Chat.findByIdAndDelete(chatId);

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
