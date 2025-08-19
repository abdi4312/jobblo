const mongoose = require('mongoose');


const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, trim: true },    description: { type: String },
    icon: { type: String }, // optional, for UI
    isActive: { type: Boolean, default: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' } // for subcategories
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
