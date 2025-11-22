const Contract = require('../models/Contract');
const Order = require('../models/Order');
const mongoose = require('mongoose');

/**
 * GET /api/contracts/:id
 * Get contract by ID
 */
exports.getContractById = async (req, res) => {
    try {
        const contractId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(contractId)) {
            return res.status(400).json({ error: 'Invalid contract ID format' });
        }

        const contract = await Contract.findById(contractId)
            .populate('orderId');

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        // Authorization
        const order = contract.orderId;

        if (
            order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId
        ) {
            return res.status(403).json({ error: 'Not authorized to view this contract' });
        }

        res.json(contract);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * POST /api/contracts
 * Create a new contract for an order
 */
exports.createContract = async (req, res) => {
    try {
        const { orderId, content } = req.body;

        if (!orderId || !content) {
            return res.status(400).json({ error: 'orderId and content are required' });
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Only customer or provider can create a contract
        if (
            order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId
        ) {
            return res.status(403).json({ error: 'Not authorized to create contract for this order' });
        }

        // Prevent multiple contracts on the same order
        const existing = await Contract.findOne({ orderId });
        if (existing) {
            return res.status(400).json({ error: 'Contract already exists for this order' });
        }

        const contract = await Contract.create({
            orderId,
            content
        });

        await contract.populate('orderId');

        res.status(201).json(contract);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * PATCH /api/contracts/:id/sign
 * Sign contract (customer or provider)
 */
exports.signContract = async (req, res) => {
    try {
        const contractId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(contractId)) {
            return res.status(400).json({ error: 'Invalid contract ID format' });
        }

        const contract = await Contract.findById(contractId).populate('orderId');
        if (!contract) return res.status(404).json({ error: 'Contract not found' });

        const order = contract.orderId;

        let role = null;

        if (order.customerId.toString() === req.userId) {
            role = 'customer';
        } else if (order.providerId.toString() === req.userId) {
            role = 'provider';
        } else {
            return res.status(403).json({ error: 'Not authorized to sign this contract' });
        }

        // Apply signature
        if (role === 'customer') {
            if (contract.signedByCustomer) {
                return res.status(400).json({ error: 'Customer already signed' });
            }
            contract.signedByCustomer = true;
        }

        if (role === 'provider') {
            if (contract.signedByProvider) {
                return res.status(400).json({ error: 'Provider already signed' });
            }
            contract.signedByProvider = true;
        }

        await contract.save();

        res.json({
            success: true,
            message: `${role} signed the contract`,
            contract
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * DELETE /api/contracts/:id
 */
exports.deleteContract = async (req, res) => {
    try {
        const contractId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(contractId)) {
            return res.status(400).json({ error: 'Invalid contract ID format' });
        }

        const contract = await Contract.findById(contractId).populate('orderId');
        if (!contract) return res.status(404).json({ error: 'Contract not found' });

        const order = contract.orderId;

        // Authorization
        if (
            order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId
        ) {
            return res.status(403).json({ error: 'Not authorized to delete this contract' });
        }

        await Contract.findByIdAndDelete(contractId);

        res.status(204).end();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
