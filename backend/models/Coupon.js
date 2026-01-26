const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // Uppercase ensure karega
    amount: { type: Number, required: true },
    active: { type: Boolean, default: true },
    activeDate: { type: Date, default: Date.now }, 
    expiresDate: { type: Date, required: true },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);