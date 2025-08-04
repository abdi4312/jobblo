const mongoose = require('mongoose');


const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['free', 'basic', 'plus', 'premium'], required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    renewalDate: { type: Date },
    autoRenew: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive', 'cancelled', 'expired'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
