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
      $or: [
        { clientId: userId },
        { providerId: userId }
      ]
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      contracts
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
    console.log(serviceId, content, price, scheduledDate, address);
    if (!serviceId || !content || !price) {
      return res
        .status(400)
        .json({
          error:
            "serviceId, content, and price are required",
        });
    }

    if (!isValidId(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID format" });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    // const role = getUserRole(service, req.userId);
    // if (!role) {
    //     return res.status(403).json({ error: "Not authorized to create a contract for this service" });
    // }

    // Ensure only one contract per service
    const existing = await Contract.findOne({ serviceId });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Contract already exists for this service" });
    }

    const contract = await Contract.create({
      clientId: userId,
      providerId: service.userId,
      serviceId,
      content,
      price,
      scheduledDate,
      address,
    });
    await contract.populate("serviceId");

    return res.status(201).json({
      success: true,
      message: "Contract created successfully",
      contract,
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
      return res.status(403).json({
        error: "You are not authorized to sign this contract",
      });
    }

    // CLIENT SIGN
    if (isClient) {
      if (contract.signedByCustomer) {
        return res.status(400).json({
          error: "Client has already signed this contract",
        });
      }
      contract.signedByCustomer = true;
    }

    // PROVIDER SIGN
    if (isProvider) {
      if (contract.signedByProvider) {
        return res.status(400).json({
          error: "Provider has already signed this contract",
        });
      }
      contract.signedByProvider = true;
    }

    // If both signed → update status
    if (contract.signedByCustomer && contract.signedByProvider) {
      contract.status = "signed";
    }

    await contract.save();

    return res.status(200).json({
      success: true,
      message: "Contract signed successfully",
      contract,
    });

  } catch (error) {
    console.error("SIGN CONTRACT ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * DELETE /api/contracts/:id
 * Remove contract (allowed only for client or provider)
 */
exports.deleteContract = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // Auth middleware se aata hai

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
