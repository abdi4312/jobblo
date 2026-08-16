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
      enum: ['requested', 'agreed', 'paid', 'contracted', 'in_progress', 'completed', 'disputed', 'cancelled', 'restricted'],
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

/**
 * The pair lookup — "is there already a conversation between these two about this job?" —
 * runs on every apply, every request approval and every "Send melding". It had no index, so
 * each one was a collection scan, and a slow lookup is exactly what widens the window in
 * which a second request can slip in and create a duplicate.
 *
 * Both directions are covered by the same index: the query is an $or over the two slot
 * orders, and the planner uses this index for both branches.
 */
chatSchema.index({ serviceId: 1, clientId: 1, providerId: 1 });

/** getMyChats: everything I am part of, newest first. Two indexes for the two slots. */
chatSchema.index({ clientId: 1, updatedAt: -1 });
chatSchema.index({ providerId: 1, updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
