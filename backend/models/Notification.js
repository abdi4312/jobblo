const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // 👈 system notification ke liye null
    },

    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        'message',
        'order',
        'system',
        'promotion',
        'alert',
        'system_update',
        'general',
        'follow',
        'favorite',
        'application',
        'payment',
        'review',
        'job_update',
      ],
    },

    content: {
      type: String,
      required: true,
    },

    read: {
      type: Boolean,
      default: false,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobRequest',
      default: null,
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ], // 👈 kis kis ne read ki
  },
  { timestamps: true }
);

/**
 * The tray query is `find({ userId }).sort({ createdAt: -1 })` and the badge query is
 * `countDocuments({ userId, read: false })` — the second one now runs on every delivered
 * notification as well as on every page load. Neither had an index, so both were full
 * collection scans that got slower for everybody as the collection grew.
 */
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
