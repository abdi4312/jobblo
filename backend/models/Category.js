const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true }
);

// Any write — from the public or the admin category routes — clears the cached category list
// (utils/cache). One hook here instead of one call per writer.
const clearCategoryCache = () => require('../utils/cache').invalidate('categories');
for (const op of ['save', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany', 'updateOne', 'updateMany', 'insertMany']) {
  categorySchema.post(op, () => void clearCategoryCache());
}

module.exports = mongoose.model('Category', categorySchema);
