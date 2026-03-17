const UpcomingFeature = require('../models/UpcomingFeature');

// Get all features
exports.getAllFeatures = async (req, res) => {
    try {
        const features = await UpcomingFeature.find().sort({ createdAt: -1 });
        res.json(features);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create a new feature (Admin only usually, but for now open or protected by middleware)
exports.createFeature = async (req, res) => {
    try {
        const feature = new UpcomingFeature(req.body);
        await feature.save();
        res.status(201).json(feature);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update a feature
exports.updateFeature = async (req, res) => {
    try {
        const { id } = req.params;
        const feature = await UpcomingFeature.findByIdAndUpdate(id, req.body, { new: true });
        if (!feature) return res.status(404).json({ error: 'Feature not found' });
        res.json(feature);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete a feature
exports.deleteFeature = async (req, res) => {
    try {
        const { id } = req.params;
        const feature = await UpcomingFeature.findByIdAndDelete(id);
        if (!feature) return res.status(404).json({ error: 'Feature not found' });
        res.json({ message: 'Feature deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
