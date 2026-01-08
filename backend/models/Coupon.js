const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required:true},
    code: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    active: { type: Boolean, default: true },
    activeDate: { type: Date, default: Date.now }, 
    expiresDate: { type: Date },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// ⚠️ Dette er den viktige linjen du mangler
module.exports = mongoose.model('Coupon', couponSchema);
