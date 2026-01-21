const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // e.g., 'message', 'order', 'system', etc.
    referenceId: {type: mongoose.Schema.Types.ObjectId,  ref: 'Order' },
    content: { type: String },
    read: { type: Boolean, default: false },

}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
