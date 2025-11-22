const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
    },

    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },

    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    message: { type: String },

    images: [{ type: String }],

    attachments: [{
        url: String,
        fileName: String,
        fileType: String,
        size: Number,
    }],

    type: {
        type: String,
        enum: ['text', 'image', 'system', 'attachment'],
        default: 'text'
    },

    systemData: {
        type: mongoose.Schema.Types.Mixed
    },

    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },

    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },

    readReceipts: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date }
    }],

    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
