const mongoose = require('mongoose');

/**
 * Support requests from the Kundesenter form.
 *
 * The form used to call nothing and then report "Saken din er sendt", so
 * customers with a payment or dispute problem believed they had reached support
 * and waited. This gives the message somewhere to actually land.
 */
const supportTicketSchema = new mongoose.Schema(
  {
    // Null for logged-out visitors — they supply an e-mail instead.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    // Set when the request arrives from a specific order, so support has context.
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
