const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ['fcm'], default: 'fcm', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    deviceId: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushToken', pushTokenSchema);
