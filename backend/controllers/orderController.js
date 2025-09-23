const Order = require('../models/Order');

// Get all orders
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
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
        const order = await Order.create(req.body);
        res.status(201).json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update an order
exports.updateOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ message: 'Order deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
