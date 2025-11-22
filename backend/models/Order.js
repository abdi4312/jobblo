const orderSchema = new mongoose.Schema({
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Status for hele oppdraget
    status: {
        type: String,
        enum: [
            'pending',
            'accepted',
            'declined',
            'in_progress',
            'completed',
            'cancelled',
            'awaiting_payment',
            'paid'
        ],
        default: 'pending'
    },

    // Pris og forhandling
    initialPrice: Number,
    agreedPrice: Number,
    priceNegotiation: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        proposedPrice: Number,
        timestamp: Date
    }],

    // Tid & varighet
    scheduledDate: Date,
    startTime: Date,
    endTime: Date,
    durationMinutes: Number,

    // Lokasjon
    location: {
        address: String,
        lat: Number,
        lng: Number
    },

    // Chat / samtaleoversikt
    lastMessageAt: Date,

    // Betaling
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'pending', 'paid', 'refunded'],
        default: 'unpaid'
    },
    paymentId: String,

    // Kontrakt
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },

    // Hendelser (history)
    history: [{
        action: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: Date,
        data: mongoose.Schema.Types.Mixed
    }]

}, { timestamps: true });
module.exports = mongoose.model('Order', orderSchema);
