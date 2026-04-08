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
      enum: ['message', 'order', 'system', 'promotion','alert','system_update','general', 'follow'],
    },

    content: {
      type: String,
      required: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

module.exports = mongoose.model('Notification', notificationSchema);
