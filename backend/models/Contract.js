const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    content: { type: String },
    signedByCustomer: { type: Boolean, default: false },
    signedByProvider: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);
