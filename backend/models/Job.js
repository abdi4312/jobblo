const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    price: { type: Number, required: true },
    location: { type: String },
    imageUrl: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
