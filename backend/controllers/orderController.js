const Order = require('../models/Order');
const Service = require('../models/Service');
const mongoose = require('mongoose');

const User = require('../models/User');
const { calculatePointsFromService } = require('../utils/points');


// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper to authorize order actions
function authorizeOrderAction(req, order) {
    if (!order.customerId || !order.providerId) return false;

    return (
        order.customerId.toString() === req.userId ||
        order.providerId.toString() === req.userId
    );
}

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
        const { id } = req.params;

        if (!isValidId(id))
            return res.status(400).json({ error: 'Invalid order ID format' });

        const order = await Order.findById(id)
            .populate('serviceId')
            .populate('customerId', 'name')
            .populate('providerId', 'name')
            .populate('contractId');

        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Authorization
        if (!authorizeOrderAction(req, order)){
           return res.status(403).json({ error: "Not authorized" });         
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
        const { serviceId} = req.body;
        const customerId = req.userId;

        if (!serviceId)
            return res.status(400).json({ error: 'Service ID is required' });

        if (!isValidId(serviceId))
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
            price:service.price,
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
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // 🔐 Authorization
    if (!authorizeOrderAction(req, order)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 🔒 COMPLETED = FINAL STATE
    if (order.status === 'completed') {
      return res.status(400).json({
        error: 'Completed order cannot be modified'
      });
    }

    // Allowed fields
    const allowedFields = ['status', 'price'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided for update'
      });
    }

    if (updates.price !== undefined && typeof updates.price !== 'number') {
      return res.status(400).json({
        error: 'Price must be a number'
      });
    }

    // ✅ Valid status values
    const validStatus = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (updates.status && !validStatus.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // 🔁 STRICT STATUS FLOW
    const statusFlow = {
      pending: ['confirmed', 'completed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      cancelled: []
    };

    if (updates.status) {
      const allowedNext = statusFlow[order.status] || [];
      if (!allowedNext.includes(updates.status)) {
        return res.status(400).json({
          error: `Cannot change status from ${order.status} to ${updates.status}`
        });
      }
    }

    // 🪙 POINTS – SIRF EK DAFA
    if (
      updates.status === 'completed' &&
      order.status !== 'completed'
    ) {
      await order.populate('serviceId');

      const service = order.serviceId;
      const points = calculatePointsFromService(service);

      await User.findByIdAndUpdate(order.customerId, {
        $inc: { pointsBalance: points },
        $push: {
          pointsHistory: {
            points,
            reason: 'Job completed',
            orderId: order._id,
            serviceId: service._id
          }
        }
      });

      updates.completedAt = new Date(); // optional but useful
    }

    const updatedOrder = await Order.findByIdAndUpdate(id, updates, {
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
        const { id } = req.params;

        if (!isValidId(id))
            return res.status(400).json({ error: 'Invalid order ID format' });

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Authorization
        if (!authorizeOrderAction(req, order)){
            return res.status(403).json({ error: "Not authorized" })         
        }

        // Instead of hard delete → set status cancelled
        order.status = 'cancelled';
        await order.save();

        res.status(200).json({ message: "Order cancelled successfully", order });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
