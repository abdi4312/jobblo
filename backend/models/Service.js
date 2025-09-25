const mongoose = require('mongoose');

// Subschema for time entries
const timeEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hours: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    note: { type: String }
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, min: 0 },

    // ✅ GeoJSON location (brukes til kartfunksjon)
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], index: '2dsphere' }, // [lng, lat]
        address: { type: String }
    },

    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    images: [{ type: String }],
    urgent: { type: Boolean, default: false },
    status: { type: String, enum: ['open', 'closed', 'in_progress'], default: 'open' },
    tags: [{ type: String }],

    duration: {
        value: { type: Number, min: 0 },
        unit: { type: String, enum: ['minutes', 'hours', 'days'], default: 'hours' }
    },

    fromDate: { type: Date },
    toDate: { type: Date },
    needTools: { type: Boolean, default: false },

    // ✅ tidsregistreringer
    timeEntries: [timeEntrySchema]

}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
