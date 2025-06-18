const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    content: { type: String, required: true },
    conversationId: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
