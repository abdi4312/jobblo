
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true }, 
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
    price: { type: Number },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
