const Service = require('../models/Service');
const mongoose = require('mongoose');

// ------------------- Standard CRUD (som du allerede har) -------------------
exports.getAllServices = async (req, res) => {
    try {
        const services = await Service.find().populate('userId', 'name');
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getServiceById = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id).populate('userId', 'name');
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createService = async (req, res) => {
    try {
        const { userId, ...serviceData } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: 'Invalid user ID format' });
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const service = await Service.create({ ...serviceData, userId });
        res.status(201).json(service);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        const serviceId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(serviceId)) return res.status(400).json({ error: 'Invalid service ID format' });

        const existingService = await Service.findById(serviceId);
        if (!existingService) return res.status(404).json({ error: 'Service not found' });

        if (req.body.userId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.userId)) return res.status(400).json({ error: 'Invalid user ID format' });
            const User = require('../models/User');
            const user = await User.findById(req.body.userId);
            if (!user) return res.status(404).json({ error: 'User not found' });
        }

        const service = await Service.findByIdAndUpdate(serviceId, { $set: req.body }, { new: true });
        res.json(service);
    } catch (err) {
        if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
        if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid data format' });
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json({ message: 'Service deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// ------------------- Kart-funksjonalitet -------------------

// Oppdater lokasjon
exports.updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, address } = req.body;

        const service = await Service.findByIdAndUpdate(
            id,
            {
                location: { type: 'Point', coordinates: [longitude, latitude], address }
            },
            { new: true }
        );
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Finn tjenester i radius
exports.getNearbyServices = async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        const services = await Service.find({
            location: {
                $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        });
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Finn tjenester innenfor bounding box
exports.getServicesInBox = async (req, res) => {
    try {
        const { neLat, neLng, swLat, swLng } = req.query;
        const polygon = {
            type: 'Polygon',
            coordinates: [[
                [parseFloat(swLng), parseFloat(swLat)],
                [parseFloat(neLng), parseFloat(swLat)],
                [parseFloat(neLng), parseFloat(neLat)],
                [parseFloat(swLng), parseFloat(neLat)],
                [parseFloat(swLng), parseFloat(swLat)]
            ]]
        };
        const services = await Service.find({
            location: { $geoWithin: { $geometry: polygon } }
        });
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ------------------- Tidsregistrering -------------------

// Legg til time entry
exports.addTimeEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { hours, date, note } = req.body;

        const service = await Service.findById(id);
        if (!service) return res.status(404).json({ error: 'Service not found' });

        const entry = { userId: req.user?.id || null, hours, date, note };
        service.timeEntries.push(entry);
        await service.save();

        res.status(201).json(service.timeEntries.at(-1));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Hent alle time entries for en service
exports.getTimeEntries = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await Service.findById(id);
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service.timeEntries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
