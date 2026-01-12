const Order = require("../models/Order");
const Contract = require("../models/Contract");
const Service = require("../models/Service");
const mongoose = require("mongoose");

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: check if authenticated user is either customer or provider
const getUserRole = (order, userId) => {
  if (order.customerId.toString() === userId) return "customer";
  if (order.providerId.toString() === userId) return "provider";
  return null;
};

/**
 * GET /api/contracts/:serviceId
 * Retrieve contract by ID
 */
exports.getMyContracts = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const userId = req.userId;

    if (!serviceId) {
      return res.status(400).json({ message: "ServiceId is required" });
    }

    const contracts = await Contract.find({
      serviceId,
      $or: [{ clientId: userId }, { providerId: userId }],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      contracts,
    });
  } catch (error) {
    console.error("GET MY CONTRACTS ERROR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/contracts
 * Create a contract for an order
 */
exports.createContract = async (req, res) => {
  try {
    const { serviceId, content, price, scheduledDate, address } = req.body;
    const userId = req.userId;

    if (!serviceId || !content || !price) {
      return res.status(400).json({
        error: "serviceId, content, and price are required",
      });
    }

    if (!isValidId(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID format" });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.userId) {
      return res.status(404).json({ error: "Service not found" });
    }

    if (userId === service.userId.toString()) {
      return res.status(400).json({
        error: "Providers cannot create contracts for themselves",
      });
    }

    const existing = await Contract.findOne({ serviceId });
    if (existing) {
      return res.status(400).json({
        error: "Contract already exists for this service",
      });
    }

    const contract = await Contract.create({
      serviceId,
      clientId: userId,
      providerId: service.userId,
      content,
      price,
      scheduledDate,
      address,
      status: "draft",

      serviceSnapshot: {
        title: service.title,
        description: service.description,
        category: service.category,
      },

      customerSnapshot: {
        userId,
      },
      providerSnapshot: {
        userId: service.userId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Contract created successfully",
      contract,
    });
  } catch (err) {
    console.error("CREATE CONTRACT ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * PATCH /api/contracts/:id/sign
 * Sign the contract (customer or provider)
 */
exports.signContract = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid contract ID format" });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const isClient = contract.clientId.toString() === userId;
    const isProvider = contract.providerId.toString() === userId;

    if (!isClient && !isProvider) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (isClient) {
      if (contract.signedByCustomer) {
        return res.status(400).json({ error: "Client already signed" });
      }
      contract.signedByCustomer = true;
      contract.signedByCustomerAt = new Date();
    }

    if (isProvider) {
      if (contract.signedByProvider) {
        return res.status(400).json({ error: "Provider already signed" });
      }
      contract.signedByProvider = true;
      contract.signedByProviderAt = new Date();
    }

    // ✅ STATUS FLOW
    if (contract.signedByCustomer && contract.signedByProvider) {
      contract.status = "signed";
    } else {
      contract.status = "pending_signatures";
    }

    if (contract.status === "signed") {
      const order = await Order.findOne({ contractId: contract._id });
      if (order) {
        return res.status(400).json({ error: "Order already exists" });
      }

      const service = await Service.findById(contract.serviceId);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      await Order.create({
        serviceId: contract.serviceId,
        customerId: contract.clientId,
        providerId: contract.providerId,
        contractId: contract._id,
        scheduledDate: contract.scheduledDate,
        price: contract.price,
        status: "pending",
        location: {
          address: contract.address || service?.location?.address,
        },
      });
    }

    await contract.save();

    res.json({
      success: true,
      message: "Contract signed successfully",
      contract,
    });
  } catch (err) {
    console.error("SIGN CONTRACT ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * DELETE /api/contracts/:id
 * Remove contract (allowed only for client or provider)
 */
exports.deleteContract = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Validate ID
    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid contract ID format" });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    // Check if user is either client or provider of this contract
    const isClient = contract.clientId.toString() === userId;
    const isProvider = contract.providerId.toString() === userId;

    if (!isClient && !isProvider) {
      return res.status(403).json({
        error: "You are not authorized to delete this contract",
      });
    }

    // Delete the contract
    await Contract.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Contract deleted successfully",
    });
  } catch (error) {
    console.error("DELETE CONTRACT ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
