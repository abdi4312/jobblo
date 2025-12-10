const Contract = require('../models/Contract');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: check if authenticated user is either customer or provider
const getUserRole = (order, userId) => {
    if (order.customerId.toString() === userId) return "customer";
    if (order.providerId.toString() === userId) return "provider";
    return null;
};

/**
 * GET /api/contracts/:id
 * Retrieve contract by ID
 */
exports.getContractById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid contract ID format" });
        }

        const contract = await Contract.findById(id).populate("orderId");
        if (!contract) return res.status(404).json({ error: "Contract not found" });

        const order = contract.orderId;
        const role = getUserRole(order, req.userId);

        if (!role) {
            return res.status(403).json({ error: "Not authorized to view this contract" });
        }

        return res.json({
            success: true,
            contract
        });

    } catch (error) {
        console.error("GET CONTRACT ERROR:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * POST /api/contracts
 * Create a contract for an order
 */
exports.createContract = async (req, res) => {
    try {
        const { orderId, content } = req.body;

        if (!orderId || !content) {
            return res.status(400).json({ error: "orderId and content are required" });
        }

        if (!isValidId(orderId)) {
            return res.status(400).json({ error: "Invalid order ID format" });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: "Order not found" });

        const role = getUserRole(order, req.userId);
        if (!role) {
            return res.status(403).json({ error: "Not authorized to create a contract for this order" });
        }

        // Ensure only one contract per order
        const existing = await Contract.findOne({ orderId });
        if (existing) {
            return res.status(400).json({ error: "Contract already exists for this order" });
        }

        const contract = await Contract.create({ orderId, content });
        await contract.populate("orderId");

        return res.status(201).json({
            success: true,
            message: "Contract created successfully",
            contract
        });

    } catch (error) {
        console.error("CREATE CONTRACT ERROR:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * PATCH /api/contracts/:id/sign
 * Sign the contract (customer or provider)
 */
exports.signContract = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid contract ID format" });
        }

        const contract = await Contract.findById(id).populate("orderId");
        if (!contract) return res.status(404).json({ error: "Contract not found" });

        const order = contract.orderId;
        const role = getUserRole(order, req.userId);

        if (!role) {
            return res.status(403).json({ error: "Not authorized to sign this contract" });
        }

        // Role-based signing rules
        if (role === "customer") {
            if (contract.signedByCustomer) {
                return res.status(400).json({ error: "Customer already signed" });
            }
            contract.signedByCustomer = true;
        }

        if (role === "provider") {
            if (contract.signedByProvider) {
                return res.status(400).json({ error: "Provider already signed" });
            }
            contract.signedByProvider = true;
        }

        await contract.save();

        return res.json({
            success: true,
            message: `${role} signed the contract successfully`,
            contract
        });

    } catch (error) {
        console.error("SIGN CONTRACT ERROR:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * DELETE /api/contracts/:id
 * Remove contract (allowed for customer or provider)
 */
exports.deleteContract = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid contract ID format" });
        }

        const contract = await Contract.findById(id).populate("orderId");
        if (!contract) return res.status(404).json({ error: "Contract not found" });

        const order = contract.orderId;
        const role = getUserRole(order, req.userId);

        if (!role) {
            return res.status(403).json({ error: "Not authorized to delete this contract" });
        }

        await Contract.findByIdAndDelete(id);

        return res.status(204).end();

    } catch (error) {
        console.error("DELETE CONTRACT ERROR:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
