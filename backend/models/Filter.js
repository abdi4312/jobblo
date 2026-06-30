// models/Filter.js
const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // kan være anonym bruker (ikke innlogget)
  },

  // 📦 Valgte kategorier
  categories: [
    {
      type: String,
      trim: true,
    },
  ],

  // 💰 Prisintervall
  priceRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 10000 },
  },

  // 📍 Lokasjon og radius
  location: {
    city: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    radius: { type: Number, default: 10 }, // km
  },

  // ⏰ Tilgjengelighet
  availability: {
    startDate: { type: Date },
    endDate: { type: Date },
  },

  // ⚡ Andre filterflagg
  urgentOnly: { type: Boolean, default: false },
  verifiedProvidersOnly: { type: Boolean, default: false },

  // 🔍 Søkeord
  searchKeyword: { type: String, trim: true },

  // 📊 Sortering
  sortBy: {
    type: String,
    enum: ['newest', 'price_low', 'price_high', 'rating_high', 'nearby'],
    default: 'newest',
  },

  // 🕓 System
  createdAt: { type: Date, default: Date.now },
});

// Eksporter modellen
module.exports = mongoose.model('Filter', filterSchema);
