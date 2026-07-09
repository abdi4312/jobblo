const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  text: {
    type: String,
  },
  attachments: [{ type: String }],
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  },
  seenBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  type: {
    type: String,
    enum: ['text', 'image', 'system_payment', 'system_contract', 'system_status', 'attachment'],
    default: 'text',
  },
  systemData: {
    type: mongoose.Schema.Types.Mixed,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const chatSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    status: {
      type: String,
      enum: ['requested', 'agreed', 'paid', 'contracted', 'completed', 'cancelled'],
      default: 'requested',
    },
    agreedPrice: {
      type: Number,
    },

    messages: [messageSchema],

    lastMessage: {
      type: String,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', chatSchema);
