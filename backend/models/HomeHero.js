const mongoose = require('mongoose');

const homeHeroSchema = new mongoose.Schema(
  {
    mediaUrl: { type: String, required: true },
    mediaPublicId: { type: String, required: true },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HomeHero', homeHeroSchema);
