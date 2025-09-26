const Category = require('../models/Category');
const mongoose = require('mongoose');

exports.createCategory = async (req, res) => {
    try {
        const { name, description, icon } = req.body;
        
        // Generate slug from name
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
        
        const category = await Category.create({
            name,
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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid category ID format' });
        }
        
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid category ID format' });
        }
        
        // Filter out Swagger placeholder values and undefined fields
        const updateData = {};
        Object.keys(req.body).forEach(key => {
            const value = req.body[key];
            if (value !== undefined && value !== 'string' && value !== '') {
                updateData[key] = value;
            }
        });
        
        // If name is being updated, regenerate slug
        if (updateData.name) {
            updateData.slug = updateData.name.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .trim('-');
        }
        
        const category = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid category ID format' });
        }
        
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};