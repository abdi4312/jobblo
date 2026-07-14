const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Status for hele oppdraget
    status: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'declined',
        'in_progress',
        'completed',
        'cancelled',
        'awaiting_payment',
        'paid',
        'disputed',
      ],
      default: 'pending',
    },

    // Pris og forhandling
    initialPrice: Number,
    agreedPrice: Number,
    priceNegotiation: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        proposedPrice: Number,
        timestamp: Date,
      },
    ],

    // Tid & varighet
    scheduledDate: Date,
    startTime: Date,
    endTime: Date,
    durationMinutes: Number,

    // Lokasjon
    location: {
      address: String,
      lat: Number,
      lng: Number,
    },

    // Chat / samtaleoversikt
    lastMessageAt: Date,

    // Betaling
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'refunded'],
      default: 'unpaid',
    },
    paymentId: String,

    // Checklist completion status (per order)
    checklist: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
        checked: { type: Boolean, default: false },
        checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        checkedAt: Date,
      },
    ],

    // Ratings & review
    review: {
      overall: { type: Number, min: 0, max: 5, default: 0 },
      punctuality: { type: Number, min: 0, max: 5, default: 0 },
      quality: { type: Number, min: 0, max: 5, default: 0 },
      communication: { type: Number, min: 0, max: 5, default: 0 },
      tidiness: { type: Number, min: 0, max: 5, default: 0 },
      comment: { type: String, default: '' },
    },

    // Hendelser (history)
    history: [
      {
        action: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: Date,
        data: mongoose.Schema.Types.Mixed,
      },
    ],

    // Before/After images
    beforeImages: [{ type: String }],
    afterImages: [{ type: String }],
    // Attachments
    attachments: [{ type: String }],
  },
  { timestamps: true }
);
module.exports = mongoose.model('Order', orderSchema);
