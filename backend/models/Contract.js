const contractSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },

    // selve kontrakten
    content: { type: String, required: true },
    version: { type: Number, default: 1 },
    previousVersions: [{
        content: String,
        timestamp: Date,
    }],

    // snapshots for juridisk bevis
    serviceSnapshot: {
        title: String,
        description: String,
        category: String
    },

    orderSnapshot: {
        price: Number,
        scheduledDate: Date,
        address: String
    },

    customerSnapshot: {
        userId: String,
        name: String
    },

    providerSnapshot: {
        userId: String,
        name: String
    },

    // signering
    signedByCustomer: { type: Boolean, default: false },
    signedByProvider: { type: Boolean, default: false },
    signedByCustomerAt: Date,
    signedByProviderAt: Date,
    customerSignature: String,
    providerSignature: String,

    customerIp: String,
    providerIp: String,

    // status
    status: {
        type: String,
        enum: ['draft', 'pending_signatures', 'signed', 'cancelled'],
        default: 'draft'
    },

    // PDF-versjon
    pdfUrl: String,

}, { timestamps: true });
module.exports = mongoose.model('Contract', contractSchema);
