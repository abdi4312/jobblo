const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    permissions: [{ type: String }], // ['users', 'orders', 'moderation']
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);