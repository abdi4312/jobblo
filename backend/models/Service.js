const mongoose = require('mongoose');

// Subschema for time entries
const timeEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hours: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    note: { type: String },
  },
  { timestamps: true }
);

const serviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, min: 0, required: true },
    hourlyRate: { type: Number, min: 0 },
    paymentType: { type: String },

    // Lokasjon
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' },
      address: { type: String },
      city: { type: String },
    },

    // Contact details from step 4 of the job form. `select: false` keeps them out
    // of every public read by default — the job listing is served unauthenticated,
    // and the poster's phone number has no business being in that payload. The
    // owner-scoped route (/api/services/my-posted) opts back in explicitly.
    contactPhone: { type: String, select: false },
    contactEmail: { type: String, select: false },

    // Norway location codes
    countyCode: { type: String, index: true },
    municipalityCode: { type: String, index: true },
    areaCode: { type: String, index: true },

    // Faktiske kategorinavn
    categories: [{ type: String, required: true }],

    // Liste over bilde-URLer (Azure URLs)
    images: [{ type: String }],

    // Utvidet metadata for bedre kontroll
    imageMetadata: [
      {
        url: String,
        blobName: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    urgent: { type: Boolean, default: false },
    promoted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        'open',
        'closed',
        'awaiting_payment',
        'paid',
        'in_progress',
        'completed',
        'pending',
        'waiting_for_approval',
        'cancelled',
        'expired',
        'draft',
      ],
      default: 'open',
    },

    tags: [{ type: String }],

    duration: {
      value: { type: Number, min: 0 },
      unit: {
        type: String,
        enum: ['minutes', 'hours', 'days', 'timer', 'minutter', 'dager'],
        default: 'hours',
      },
    },

    fromDate: { type: Date },
    toDate: { type: Date },

    equipment: {
      type: String,
      enum: ['utstyrfri', 'delvis utstyr', 'trengs utstyr'],
      default: 'utstyrfri',
    },

    views: { type: Number, default: 0 },
    maxApplicants: { type: Number, default: 0 }, // 0 means unlimited
    timeEntries: [timeEntrySchema],

    // Dynamic checklist for the job
    checklist: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
        checked: { type: Boolean, default: false },
        checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        checkedAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

serviceSchema.index({ location: '2dsphere' });
serviceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Service', serviceSchema);
