const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    category: String,
    price: { type: Number, required: true },
    location: String,
    imageUrl: String,
    user: { type: String, required: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Job', jobSchema);
