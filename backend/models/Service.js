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

    // Lokasjon — nå med separat adresse og by
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], index: '2dsphere' },
        address: { type: String },   // eks. "Karl Johans gate 12"
        city: { type: String }       // eks. "Oslo"
    },

    // Nå faktiske kategorinavn i stedet for ObjectId
    categories: [{ type: String }],  // f.eks. ["Maling", "Flytting"]

    images: [{ type: String }],
    urgent: { type: Boolean, default: false },
    status: { type: String, enum: ['open', 'closed', 'in_progress'], default: 'open' },

    // Tags brukes fortsatt som søkeord / filtre
    tags: [{ type: String }],

    // Varighet
    duration: {
        value: { type: Number, min: 0 },
        unit: { type: String, enum: ['minutes', 'hours', 'days'], default: 'hours' }
    },

    // Nytt feltnavn for datoer (fra–til)
    fromDate: { type: Date },  // Startdato jobben skal gjøres
    toDate: { type: Date },    // Sluttdato jobben skal gjøres

    // Utstyrstatus – oppgradert fra boolean til enum
    equipment: {
        type: String,
        enum: ['utstyrfri', 'delvis utstyr', 'trengs utstyr'],
        default: 'utstyrfri'
    },

    // Favorittstatus for visning i UI (kan evt. styres via egen relasjon)
    isFavorited: { type: Boolean, default: false },

    // Timeføring
    timeEntries: [timeEntrySchema]

}, { timestamps: true });

serviceSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Service', serviceSchema);
