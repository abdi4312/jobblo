const mongoose = require('mongoose');



const jobSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, min: 0 },
    location: { type: String },
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
    needTools: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
