// models/Upload.js
const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // URL til Azure Blob Storage
    url: {
        type: String,
        required: true
    },

    // Hva er filen brukt til?
    purpose: {
        type: String,
        enum: [
            'profile_image',
            'job_image',
            'message_image',
            'document'
        ],
        required: true
    },

    // Ekstra referanser, avhengig av hva bildet tilhører
    jobId: {               // hvis bildet brukes i en jobb/service
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: null
    },

    messageId: {           // hvis bildet brukes i en melding
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },

    // Metadata
    fileName: String,
    fileType: String,
    fileSize: Number,

    // Azure blob name (for sletting)
    blobName: {
        type: String,
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);
