const Category = require('../models/Category');
const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.createCategory = async (req, res) => {
    try {
        const { name, description, icon } = req.body;

        // ✅ Validate name
        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Category name is required'
            });
        }

        // Generate slug from name
        const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        const category = await Category.create({
            name : name.trim(),
            slug,
            description,
            icon
        });
        
        res.status(201).json(category);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Category name or slug already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid category ID format" });
        }
        
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        let { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid category ID format" });
        }
        
        // Filter out Swagger placeholder values and undefined fields
         const updateData = {};
        for (const [key, value] of Object.entries(req.body)) {
            if (value !== undefined && value !== null) {
                if (typeof value === 'string') {
                    if (value.trim() !== '') updateData[key] = value.trim();
                } else {
                    updateData[key] = value;
                }
            }
        }
        
        // If name is being updated, regenerate slug
        if (updateData.name) {
            updateData.slug = updateData.name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }

        //No fields to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                error: 'No valid fields provided for update'
            });
        
        }
        const category = await Category.findByIdAndUpdate(id, updateData, { new: true });
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        
        res.json(category);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Category name or slug already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        let { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid category ID format" });
        }
        
        const category = await Category.findByIdAndDelete(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });   
        }
        
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};