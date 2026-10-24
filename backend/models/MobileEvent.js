const mongoose = require('mongoose');

/**
 * Telemetry from the mobile app's lightweight reporter (jobblo-app/src/monitoring).
 * One row per event: an app session start, a JS error/crash, or a failed/slow API call.
 * Kept 30 days.
 */
const mobileEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['session', 'error', 'api'], required: true },
    at: { type: Date, required: true },
    installId: { type: String, required: true },
    sessionId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    platform: { type: String, default: null }, // ios | android
    osVersion: { type: String, default: null },
    appVersion: { type: String, default: null },
    build: { type: String, default: null },
    device: { type: String, default: null },
    screen: { type: String, default: null },

    // error
    name: { type: String, default: null },
    message: { type: String, default: null },
    stack: { type: String, default: null },
    fatal: { type: Boolean, default: false },
    kind: { type: String, default: null }, // js | render | promise
    fingerprint: { type: String, default: null },

    // api
    method: { type: String, default: null },
    path: { type: String, default: null }, // ids replaced with :id by the app
    status: { type: Number, default: null }, // 0 = network error / timeout
    ms: { type: Number, default: null },
  },
  { versionKey: false }
);

mobileEventSchema.index({ type: 1, at: -1 });
mobileEventSchema.index({ fingerprint: 1, at: -1 });
mobileEventSchema.index({ installId: 1, at: -1 });
mobileEventSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('MobileEvent', mobileEventSchema);
