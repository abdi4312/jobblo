const Service = require('../models/Service');
const mongoose = require('mongoose');

// ------------------- Get All Services -------------------

exports.getAllServices = async (req, res) => {
    try {
        const services = await Service.find()
            .populate('userId', 'name');
        res.json(services);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ------------------- Get Service By ID -------------------

exports.getServiceById = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id)
            .populate('userId', 'name');
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ------------------- Full Service Details -------------------

exports.getServiceDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ error: 'Invalid service ID format' });

        const service = await Service.findById(id)
            .populate('userId', 'name email avatarUrl role subscription verified')
            .populate('categories', 'name description');

        if (!service)
            return res.status(404).json({ error: 'Service not found' });

        // Stats
        const Order = require('../models/Order');
        const orderStats = await Order.aggregate([
            { $match: { serviceId: new mongoose.Types.ObjectId(id) } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
                }
            }
        ]);

        const stats = {
            totalOrders: orderStats[0]?.totalOrders || 0,
            completedOrders: orderStats[0]?.completedOrders || 0
        };

        // Similar services
        const similarServices = await findSimilarServices(service);

        res.json({
            service,
            provider: service.userId,
            stats,
            similarServices
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Helper: Find similar services
async function findSimilarServices(service) {
    try {
        const query = {
            _id: { $ne: service._id },
            status: 'open'
        };

        if (service.categories?.length > 0) {
            query.categories = { $in: service.categories };
        }

        if (service.price) {
            const min = service.price * 0.7;
            const max = service.price * 1.3;
            query.price = { $gte: min, $lte: max };
        }

        let similar = await Service.find(query)
            .limit(6)
            .populate('userId', 'name avatarUrl verified')
            .populate('categories', 'name')
            .sort({ createdAt: -1 });

        if (service.location?.coordinates?.length === 2) {
            const nearby = await Service.find({
                ...query,
                location: {
                    $nearSphere: {
                        $geometry: { type: 'Point', coordinates: service.location.coordinates },
                        $maxDistance: 50000
                    }
                }
            })
                .limit(6)
                .populate('userId', 'name avatarUrl verified')
                .populate('categories', 'name');

            if (nearby.length > 0) similar = nearby;
        }

        return similar;

    } catch (err) {
        console.error('Similar services error:', err);
        return [];
    }
}

// ------------------- Create Service -------------------

exports.createService = async (req, res) => {
    try {
        const userId = req.userId;
        const { images, imageMetadata, ...serviceData } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId))
            return res.status(400).json({ error: 'Invalid user ID format' });

        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Normalize address
        if (serviceData.location?.address && !serviceData.location.city) {
            const [addr, city] = serviceData.location.address.split(',').map(s => s.trim());
            serviceData.location.address = addr || '';
            serviceData.location.city = city || '';
        }

        // defaults
        serviceData.status = serviceData.status || 'open';
        serviceData.equipment = serviceData.equipment || 'utstyrfri';

        // Add images
        if (images) serviceData.images = images;
        if (imageMetadata) serviceData.imageMetadata = imageMetadata;

        const service = await Service.create({ ...serviceData, userId });

        res.status(201).json(service);

    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};

// ------------------- Update Service -------------------

exports.updateService = async (req, res) => {
    try {
        const id = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ error: 'Invalid service ID format' });

        const service = await Service.findById(id);
        if (!service)
            return res.status(404).json({ error: 'Service not found' });

        if (service.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Split "address, city"
        if (req.body.location?.address && !req.body.location.city) {
            const [addr, city] = req.body.location.address.split(',').map(s => s.trim());
            req.body.location.address = addr || '';
            req.body.location.city = city || '';
        }

        // ⭐ MERGE existing + new images
        if (req.body.images) {
            service.images = [...service.images, ...req.body.images];
        }

        // ⭐ MERGE image metadata
        if (req.body.imageMetadata) {
            service.imageMetadata = [...service.imageMetadata, ...req.body.imageMetadata];
        }

        // Update other fields
        Object.assign(service, req.body);

        await service.save();

        res.json(service);

    } catch (err) {
        console.error(err);
        if (err.name === 'ValidationError')
            return res.status(400).json({ error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
};

// ------------------- Delete Service -------------------

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ error: 'Invalid service ID format' });

        const service = await Service.findById(id);
        if (!service) return res.status(404).json({ error: 'Service not found' });

        if (service.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await service.deleteOne();

        res.json({ message: 'Service deleted' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ------------------- GeoJSON Endpoints -------------------

exports.updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, address, city } = req.body;

        const service = await Service.findByIdAndUpdate(
            id,
            {
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                    address,
                    city
                }
            },
            { new: true }
        );

        if (!service) return res.status(404).json({ error: 'Service not found' });

        res.json(service);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getNearbyServices = async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;

        if (!lat || !lng || !radius)
            return res.status(400).json({ error: 'Missing lat, lng or radius' });

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

// ------------------- Time Entries -------------------

exports.addTimeEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, hours, date, note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId))
            return res.status(400).json({ error: 'Invalid user ID' });

        const service = await Service.findById(id);
        if (!service) return res.status(404).json({ error: 'Service not found' });

        service.timeEntries.push({ userId, hours, date, note });
        await service.save();

        res.status(201).json(service.timeEntries.at(-1));

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

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

// ------------------- My Services -------------------

exports.getMyPostedServices = async (req, res) => {
    try {
        const services = await Service.find({ userId: req.userId })
            .populate('categories')
            .populate('userId', 'name email')
            .sort({ _id: -1 });

        res.json(services);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
