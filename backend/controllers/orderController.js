const Order = require('../models/Order');
const Service = require('../models/Service');
const mongoose = require('mongoose');

/**
 * GET /api/orders
 * Hent alle ordre relatert til bruker (både som kunde og tilbyder)
 */
exports.getAllOrders = async (req, res) => {
    try {
        const userId = req.userId;

        const orders = await Order.find({
            $or: [
                { customerId: userId },
                { providerId: userId }
            ]
        })
            .populate('serviceId')
            .populate('customerId', 'name email')
            .populate('providerId', 'name email')
            .populate('contractId')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};


/**
 * GET /api/orders/:id
 */
exports.getOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ error: 'Invalid order ID format' });

        const order = await Order.findById(orderId)
            .populate('serviceId')
            .populate('customerId', 'name')
            .populate('providerId', 'name')
            .populate('contractId');

        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Authorization
        if (
            order.customerId.toString() !== req.userId &&
            order.providerId?.toString() !== req.userId
        ) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};


/**
 * POST /api/orders
 * Opprett ny ordre
 */
exports.createOrder = async (req, res) => {
    try {
        const { serviceId, price } = req.body;
        const customerId = req.userId;

        if (!serviceId)
            return res.status(400).json({ error: 'Service ID is required' });

        if (!mongoose.Types.ObjectId.isValid(serviceId))
            return res.status(400).json({ error: 'Invalid service ID format' });

        const service = await Service.findById(serviceId);
        if (!service)
            return res.status(404).json({ error: 'Service not found' });

        const providerId = service.userId;

        if (providerId.toString() === customerId)
            return res.status(400).json({ error: 'Cannot order your own service' });

        const order = await Order.create({
            serviceId,
            customerId,
            providerId,
            price: price || service.price,
            status: 'pending'
        });

        await order.populate('serviceId');
        await order.populate('customerId', 'name');
        await order.populate('providerId', 'name');

        res.status(201).json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


/**
 * PATCH /api/orders/:id
 * Oppdater status eller pris (kun tillatte felter)
 */
exports.updateOrder = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ error: 'Invalid order ID format' });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Authorization
        if (
            order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId
        ) {
            return res.status(403).json({ error: 'Not authorized to update order' });
        }

        // TILLATTE FELTER
        const allowedFields = ['status', 'price'];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Valider statusflyt
        const validStatus = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (updates.status && !validStatus.includes(updates.status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        const updatedOrder = await Order.findByIdAndUpdate(orderId, updates, {
            new: true
        })
            .populate('serviceId')
            .populate('customerId', 'name')
            .populate('providerId', 'name');

        res.json(updatedOrder);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


/**
 * DELETE /api/orders/:id
 * Kunde eller tilbyder kan slette (avlyse) ordre
 */
exports.deleteOrder = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId))
            return res.status(400).json({ error: 'Invalid order ID format' });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Authorization
        if (
            order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId
        ) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Instead of hard delete → set status cancelled
        order.status = 'cancelled';
        await order.save();

        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
