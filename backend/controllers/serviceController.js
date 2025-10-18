const Service = require('../models/Service');
const mongoose = require('mongoose');

// ------------------- Standard CRUD -------------------
exports.getAllServices = async (req, res) => {
    try {
        const services = await Service.find().populate('userId', 'name');
        res.json(services);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getServiceById = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id).populate('userId', 'name');
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getServiceDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate service ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        // Get the main service with full user details
        const service = await Service.findById(id)
            .populate('userId', 'name email avatarUrl role subscription verified')
            .populate('categories', 'name description');

        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Calculate statistics for the service
        const Order = require('../models/Order');
        const orderStats = await Order.aggregate([
            { $match: { serviceId: new mongoose.Types.ObjectId(id) } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    }
                }
            }
        ]);

        const stats = {
            totalOrders: orderStats.length > 0 ? orderStats[0].totalOrders : 0,
            completedOrders: orderStats.length > 0 ? orderStats[0].completedOrders : 0
        };

        // Find similar services
        const similarServices = await findSimilarServices(service);

        // Return full details
        res.json({
            service: service,
            provider: service.userId,
            stats: stats,
            similarServices: similarServices
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Helper function to find similar services
async function findSimilarServices(service) {
    try {
        const query = {
            _id: { $ne: service._id }, // Exclude current service
            status: 'open' // Only open services
        };

        // Match by categories if available
        if (service.categories && service.categories.length > 0) {
            query.categories = { $in: service.categories };
        }

        // Price range (±30%)
        if (service.price) {
            const priceMin = service.price * 0.7;
            const priceMax = service.price * 1.3;
            query.price = { $gte: priceMin, $lte: priceMax };
        }

        // Find similar services
        let similarServices = await Service.find(query)
            .populate('userId', 'name avatarUrl verified')
            .populate('categories', 'name')
            .limit(6)
            .sort({ createdAt: -1 });

        // If location exists, prioritize nearby services
        if (service.location && service.location.coordinates && service.location.coordinates.length === 2) {
            const nearbyServices = await Service.find({
                ...query,
                location: {
                    $nearSphere: {
                        $geometry: {
                            type: 'Point',
                            coordinates: service.location.coordinates
                        },
                        $maxDistance: 50000 // 50km radius
                    }
                }
            })
                .populate('userId', 'name avatarUrl verified')
                .populate('categories', 'name')
                .limit(6);

            // Use nearby services if found, otherwise use the category-based results
            if (nearbyServices.length > 0) {
                similarServices = nearbyServices;
            }
        }

        return similarServices;
    } catch (err) {
        console.error('Error finding similar services:', err);
        return [];
    }
}

exports.createService = async (req, res) => {
    try {
        const { userId, ...serviceData } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId))
            return res.status(400).json({ error: 'Invalid user ID format' });

        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const service = await Service.create({ ...serviceData, userId });
        res.status(201).json(service);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        const serviceId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(serviceId))
            return res.status(400).json({ error: 'Invalid service ID format' });

        const existingService = await Service.findById(serviceId);
        if (!existingService) return res.status(404).json({ error: 'Service not found' });

        if (req.body.userId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.userId))
                return res.status(400).json({ error: 'Invalid user ID format' });

            const User = require('../models/User');
            const user = await User.findById(req.body.userId);
            if (!user) return res.status(404).json({ error: 'User not found' });
        }

        const service = await Service.findByIdAndUpdate(serviceId, { $set: req.body }, { new: true });
        res.json(service);
    } catch (err) {
        console.error(err);
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
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ------------------- Kart / GeoJSON -------------------
exports.updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, address } = req.body;

        const service = await Service.findByIdAndUpdate(
            id,
            { location: { type: 'Point', coordinates: [longitude, latitude], address } },
            { new: true }
        );
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Finn tjenester i radius uten å krasje hvis location mangler
exports.getNearbyServices = async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;

        if (!lat || !lng || !radius) {
            return res.status(400).json({ error: 'Missing lat, lng or radius' });
        }

        const services = await Service.find({
            location: { $exists: true, $ne: null },
            'location.coordinates': { $exists: true, $ne: [] },
            location: {
                $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        });

        res.json(services);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};


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
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ------------------- Tidsregistrering -------------------

// Legg til time entry
exports.addTimeEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, hours, date, note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId))
            return res.status(400).json({ error: 'Invalid user ID' });

        const service = await Service.findById(id);
        if (!service) return res.status(404).json({ error: 'Service not found' });

        const entry = { userId, hours, date, note };
        service.timeEntries.push(entry);
        await service.save();

        res.status(201).json(service.timeEntries.at(-1));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
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
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};


// Get all services posted by the authenticated user
// Authentication handled by middleware - req.userId available
exports.getMyPostedServices = async (req, res) => {
    try {
        // userId comes from authenticate middleware
        const userId = req.userId;

        // Find all services posted by this user
        const services = await Service.find({ userId: userId })
            .populate('categories')
            .populate('userId', 'name email')
            .sort({ _id: -1 });

        res.json(services);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
