const User = require('../models/User');
const Chat = require('../models/ChatMessage');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Dispute = require('../models/Dispute');
const { getStripe } = require('../config/stripe');
const { resolveStripeCustomer } = require('../services/stripe/customers');
const mongoose = require('mongoose');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Ceiling for a negotiated price. Stripe rejects unit_amount above ~1e8 øre. */
const MAX_AGREED_PRICE = 1000000;

/** Longest single chat message. Guards the 16 MB per-document limit — see sendMessage. */
const MAX_MESSAGE_LENGTH = 5000;

exports.createOrGetChat = async (req, res) => {
  try {
    const { providerId, serviceId } = req.body;
    let { id } = req.user;

    if (!serviceId) {
      return res.status(400).json({ message: 'Service ID is required.' });
    }

    if (id === providerId) {
      return res.status(400).json({ message: 'You cannot create a chat with yourself.' });
    }

    const provider = await User.findById(providerId).select('role name');
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
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
    let chat = await Chat.findOne({
      serviceId,
      $or: [
        { clientId: id, providerId },
        { clientId: providerId, providerId: id },
      ],
    })
      .populate('clientId', 'name')
      .populate('providerId', 'name')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId');

    if (chat) {
      // If user previously deleted this chat, restore it by removing from deletedFor
      if (chat.deletedFor && chat.deletedFor.includes(id)) {
        await Chat.findByIdAndUpdate(chat._id, {
          $pull: { deletedFor: id },
        });
      }
      return res.status(200).json(chat);
    }

    chat = await Chat.create({
      clientId: id,
      providerId,
      serviceId,
      messages: [],
    });

    // Populate the newly created chat
    chat = await Chat.findById(chat._id)
      .populate('clientId', 'name')
      .populate('providerId', 'name')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId');

    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyChats = async (req, res) => {
  try {
    const { id } = req.user;

    // Get ALL chats where user is either client or provider, and not deleted by them
    const chats = await Chat.find({
      $or: [{ clientId: id }, { providerId: id }],
      deletedFor: { $ne: id },
    })
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

    const chat = await Chat.findById(chatId)
      .populate('clientId', 'name avatarUrl')
      .populate('providerId', 'name avatarUrl')
      .populate('serviceId', 'title description images price categories userId')
      .populate('orderId')
      .populate('messages.senderId', 'name avatarUrl');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // 🔒 Authorization check: user must be either client or provider of this chat
    if (chat.clientId._id.toString() !== id && chat.providerId._id.toString() !== id) {
      return res.status(403).json({ message: 'Unauthorized: You are not part of this chat.' });
    }

    res.json(chat);
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

    const message = {
      senderId: id,
      text,
      createdAt: new Date(),
      seenBy: [id],
    };

    chat.messages.push(message);
    chat.lastMessage = text;

    await chat.save();

    // Emit socket event to notify users in the chat room
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${chatId}`).emit('receive-message', {
        chatId,
        message,
      });
    }

    res.status(201).json(message);
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

    await Chat.findByIdAndDelete(chatId);

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
