const mongoose = require('mongoose');

/** One-time code for step-up authentication before sensitive developer actions. Hashed; expires in 10 min. */
const stepUpOtpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

stepUpOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('StepUpOtp', stepUpOtpSchema);
