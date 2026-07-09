const User = require('../models/User');
const Chat = require('../models/ChatMessage');
const Order = require('../models/Order');
const Service = require('../models/Service');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mongoose = require('mongoose');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

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

    let chat = await Chat.findOne({
      clientId: id,
      providerId,
      serviceId,
    })
      .populate('clientId', 'name')
      .populate('providerId', 'name')
      .populate('serviceId', 'title description images price categories')
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
      .populate('serviceId', 'title description images price categories')
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
      .populate('serviceId', 'title description images price categories')
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
      .populate('serviceId', 'title description images price categories')
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

    // Create Stripe checkout session
    const fee = Math.round((chat.agreedPrice || order.agreedPrice || chat.serviceId.price) * 0.03);
    const total = (chat.agreedPrice || order.agreedPrice || chat.serviceId.price) + fee;

    if (total < 3) {
      return res.status(400).json({ error: 'Minimum amount for payment is 3 kr including fee.' });
    }

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5174';
    const user = await User.findById(id);

    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
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

    // 🔒 Authorization check
    if (chat.clientId._id.toString() !== id && chat.providerId._id.toString() !== id)
      return res.status(403).json({ error: 'Not allowed' });

    // Check if contract/order already exists
    if (chat.orderId) {
      return res.status(400).json({ error: 'Contract already exists for this chat' });
    }

    // Create order (contract)
    const checklist = (chat.serviceId.checklist || []).map((item) => ({
      id: item.id,
      text: item.text,
      checked: false,
    }));

    const price = agreedPrice || chat.agreedPrice || chat.serviceId.price;

    const order = new Order({
      chatId: chat._id,
      serviceId: chat.serviceId._id,
      customerId: chat.clientId._id,
      providerId: chat.providerId._id,
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

    // Update service status
    await Service.findByIdAndUpdate(chat.serviceId._id, { status: 'in_progress' });

    // Populate chat for response
    const updatedChat = await Chat.findById(chatId)
      .populate('clientId', 'name avatarUrl')
      .populate('providerId', 'name avatarUrl')
      .populate('serviceId', 'title description images price categories')
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
    if (typeof agreedPrice !== 'number' || agreedPrice < 0) {
      return res.status(400).json({ error: 'Invalid agreedPrice value' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // Authorization check: user must be part of the chat
    if (chat.clientId.toString() !== id && chat.providerId.toString() !== id)
      return res.status(403).json({ error: 'Not allowed' });

    // Update chat
    chat.agreedPrice = agreedPrice;
    chat.status = 'agreed';

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
      .populate('serviceId', 'title description images price categories')
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

    await Chat.findByIdAndDelete(chatId);

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
