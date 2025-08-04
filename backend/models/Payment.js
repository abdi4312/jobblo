const mongoose = require('mongoose');


const paymentSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    status: { type: String, enum: ['pending', 'completed', 'disputed', 'released'], default: 'pending' },
    amount: { type: Number, required: true, min: 0 },
    paymentProviderId: { type: String },
    transactionId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
