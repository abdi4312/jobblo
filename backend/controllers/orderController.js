const Order = require('../models/Order');
const Service = require('../models/Service');
const mongoose = require('mongoose');

// Get all orders for authenticated user
exports.getAllOrders = async (req, res) => {
    try {
        const userId = req.userId; // Get from authenticated user

        // Find all orders where user is customer or provider
        const orders = await Order.find({
            $or: [
                { customerId: userId },
                { providerId: userId }
            ]
        })
            .populate('serviceId')
            .populate('customerId', 'name')
            .populate('providerId', 'name')
            .populate('contractId');

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get a single order by ID
exports.getOrderById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        const order = await Order.findById(req.params.id)
            .populate('serviceId')
            .populate('customerId', 'name')
            .populate('providerId', 'name')
            .populate('contractId');
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Create a new order
exports.createOrder = async (req, res) => {
    try {
        const { serviceId, price } = req.body;
        const customerId = req.userId; // Get from authenticated user

        // Validate required fields
        if (!serviceId) {
            return res.status(400).json({ error: 'Service ID is required' });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        // Check if service exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Get providerId from service (service.userId is the provider)
        const providerId = service.userId;

        // Ensure customer is not creating order for their own service
        if (customerId.toString() === providerId.toString()) {
            return res.status(400).json({ error: 'Cannot create order for your own service' });
        }

        // Create order with automatic providerId assignment
        const order = await Order.create({
            serviceId,
            customerId,
            providerId,
            price: price || service.price,
            status: 'pending'
        });

        // Populate response
        await order.populate('serviceId');
        await order.populate('customerId', 'name');
        await order.populate('providerId', 'name');

        res.status(201).json(order);
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};

// Update an order
exports.updateOrder = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Authorization: only customer or provider can update
        if (order.customerId.toString() !== req.userId && order.providerId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Not authorized to update this order' });
        }

        // Only allow status updates (prevent changing customerId/providerId)
        const allowedUpdates = ['status', 'price'];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (field in req.body) {
                updates[field] = req.body[field];
            }
        });

        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, updates, { new: true })
            .populate('serviceId')
            .populate('customerId', 'name')
            .populate('providerId', 'name');

        res.json(updatedOrder);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Authorization: only customer or provider can delete
        if (order.customerId.toString() !== req.userId && order.providerId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Not authorized to delete this order' });
        }

        await Order.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
