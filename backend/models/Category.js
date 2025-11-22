const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, trim: true },
    description: { type: String },

    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    icon: { type: String },
    image: { type: String },

    keywords: [{ type: String }],

    sortOrder: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },

    metaTitle: String,
    metaDescription: String,

}, { timestamps: true });

// ⚠️ Dette er den viktige linjen du mangler
module.exports = mongoose.model('Category', categorySchema);
