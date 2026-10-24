const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
      unique: true,
    },
    oldRefreshToken: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      required: true,
    },
    location: {
      type: String, // e.g. 'Oslo, Norway'
      default: 'Unknown',
    },
    userAgent: {
      type: String,
      required: true,
    },
    device: {
      type: String, // e.g. 'Windows Desktop'
      required: true,
    },
    // Model reported by the mobile app (X-Device-Name), e.g. 'iPhone 15 Pro'. Browsers
    // do not expose one, so web sessions keep this null. Display only, never trusted.
    deviceName: {
      type: String,
      default: null,
    },
    browser: {
      type: String, // e.g. 'Chrome'
      required: true,
    },
    os: {
      type: String, // e.g. 'Windows 10'
      required: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index for automatic cleanup
    },
    // Set when the authenticator code was checked on this session (superAdmin/developer only).
    mfaVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
