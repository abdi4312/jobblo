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
      return res
        .status(403)
        .json({ error: "Not authorized to view this contract" });
    }

    return res.json({
      success: true,
      contract,
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
    const { serviceId, content, price, ScheduledDate, address } = req.body;
    const userId = req.userId;
    console.log(serviceId, content, price, ScheduledDate, address);
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
      ScheduledDate,
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

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid contract ID format" });
    }

    const contract = await Contract.findById(id).populate("orderId");
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    const order = contract.orderId;
    const role = getUserRole(order, req.userId);

    if (!role) {
      return res
        .status(403)
        .json({ error: "Not authorized to sign this contract" });
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
      contract,
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
      return res
        .status(403)
        .json({ error: "Not authorized to delete this contract" });
    }

    await Contract.findByIdAndDelete(id);

    return res.status(204).end();
  } catch (error) {
    console.error("DELETE CONTRACT ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
