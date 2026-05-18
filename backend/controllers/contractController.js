const Notification = require("../models/Notification");

const Order = require("../models/Order");
const Contract = require("../models/Contract");
const Service = require("../models/Service");
const Payment = require("../models/Payment");
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
 * GET /api/contracts
 * Retrieve all contracts where user is either client or provider
 */
exports.getAllMyContracts = async (req, res) => {
  try {
    const userId = req.userId;

    const contracts = await Contract.find({
      $or: [{ clientId: userId }, { providerId: userId }],
    })
      .populate("serviceId")
      .populate("clientId", "name email")
      .populate("providerId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: contracts.length,
      contracts,
    });
  } catch (error) {
    console.error("GET ALL MY CONTRACTS ERROR:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
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
      return res
        .status(400)
        .json({ success: false, message: "ServiceId is required" });
    }

    const contracts = await Contract.find({
      serviceId,
      $or: [{ clientId: userId }, { providerId: userId }],
    }).sort({ createdAt: -1 });

    const io = req.app.get("io");
    io.to(`service_${serviceId}`).emit("contracts_updated", {
      contracts,
    });
    if (!contracts || contracts.length === 0) {
      return res.status(200).json({
        message: "No contracts found for this service",
      });
    }

    return res.status(200).json({
      success: true,
      count: contracts.length,
      contracts,
    });
  } catch (error) {
    console.error("GET MY CONTRACTS ERROR:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
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
      customerSnapshot: { userId },
      providerSnapshot: { userId: service.userId },
    });

    // --- SOCKET EMIT ---
    const io = req.app.get("io");
    io.to(`service_${serviceId}`).emit("contract_created", { contract });

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
    const { useSafePay } = req.body; // 👈 Get preference from sign request
    const userId = req.userId;

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid contract ID format" });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    // Update SafePay preference if provided (only if not already signed)
    if (useSafePay !== undefined) {
      contract.useSafePay = useSafePay === true;
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

      const service = await Service.findById(contract.serviceId);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      // 🚀 CREATE ORDER NOW
      const order = await Order.create({
        serviceId: contract.serviceId,
        customerId: contract.clientId,
        providerId: contract.providerId,
        price: contract.price,
        contractId: contract._id,
        scheduledDate: contract.scheduledDate,
        status: "accepted", // Since both signed the contract
        location: { address: contract.address || service?.location?.address },
      });

      // 🚀 START SAFEPAY (Payment entry)
      if (contract.useSafePay) {
        await Payment.create({
          orderId: order._id,
          amount: contract.price,
          status: "pending",
        });
      }

      // Detailed Notifications
      await Notification.insertMany([
        {
          userId: contract.clientId,
          type: "order",
          referenceId: order._id,
          content: `Kontrakten for ${service.title} er nå fullstendig signert aur ordren create ho gayi hai!`,
        },
        {
          userId: contract.providerId,
          type: "order",
          referenceId: order._id,
          content: `Kontrakten for ${service.title} er nå fullstendig signert aur ordren create ho gayi hai!`,
        },
      ]);

      // Notify both parties via Socket
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${contract.clientId}`).emit("order_created", order);
        io.to(`user_${contract.providerId}`).emit("order_created", order);
        io.to(`user_${contract.clientId}`).emit("new_notification", {
          content: `Kontrakten for ${service.title} er nå fullstendig signert aur ordren create ho gayi hai!`,
          type: "order",
        });
        io.to(`user_${contract.providerId}`).emit("new_notification", {
          content: `Kontrakten for ${service.title} er nå fullstendig signert aur ordren create ho gayi hai!`,
          type: "order",
        });
      }
    } else {
      contract.status = "pending_signatures";
    }

    // --- REALTIME NOTIFICATIONS & ALERTS ---
    const io = req.app.get("io");

    if (contract.status === "pending_signatures") {
      if (isClient) {
        // Client signed, notify provider
        await Notification.create({
          userId: contract.providerId,
          type: "alert",
          referenceId: contract._id,
          content: `Klienten har signert kontrakten. Det venter nå på din signatur.`,
        });
        io.to(`user_${contract.providerId}`).emit("new_notification", {
          content: `Klienten har signert kontrakten. Det venter nå på din signatur.`,
          type: "alert",
        });
      } else if (isProvider) {
        // Provider signed, notify client
        await Notification.create({
          userId: contract.clientId,
          type: "alert",
          referenceId: contract._id,
          content: `Tilbyderen har signert kontrakten. Det venter nå på din signatur.`,
        });
        io.to(`user_${contract.clientId}`).emit("new_notification", {
          content: `Tilbyderen har signert kontrakten. Det venter nå på din signatur.`,
          type: "alert",
        });
      }
    }

    await contract.save();

    // --- SOCKET EMIT ---
    io.to(`service_${contract.serviceId}`).emit("contract_signed", {
      contract,
    });
    // Also emit globally for the contracts page
    io.emit("contract_updated", { contractId: contract._id });

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
 * PATCH /api/contracts/:id
 * Update contract content (max 3 times)
 */
exports.updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, price, scheduledDate, address } = req.body;
    const userId = req.userId;

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid contract ID format" });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    // Authorization
    const isClient = contract.clientId.toString() === userId;
    const isProvider = contract.providerId.toString() === userId;

    if (!isClient && !isProvider) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check edit count
    if (contract.editCount >= 3) {
      return res.status(400).json({
        error: "Kontrakten kan ikke endres mer enn 3 ganger.",
      });
    }

    // Cannot edit if already signed by both
    if (contract.status === "signed") {
      return res.status(400).json({
        error: "Signert kontrakt kan ikke endres.",
      });
    }

    // Save previous version
    contract.previousVersions.push({
      content: contract.content,
      timestamp: new Date(),
    });

    // Update fields
    if (content) contract.content = content;
    if (price) contract.price = price;
    if (scheduledDate) contract.scheduledDate = scheduledDate;
    if (address) contract.address = address;

    // Reset signatures and increment edit count
    contract.signedByCustomer = false;
    contract.signedByProvider = false;
    contract.signedByCustomerAt = undefined;
    contract.signedByProviderAt = undefined;
    contract.editCount += 1;
    contract.status = "pending_signatures";

    await contract.save();

    // Notify other party
    const recipientId = isClient ? contract.providerId : contract.clientId;
    const io = req.app.get("io");
    if (io) {
      const notification = await Notification.create({
        userId: recipientId,
        type: "alert",
        referenceId: contract._id,
        content: `Kontrakten har blitt endret av motparten. Vennligst se gjennom og signer på nytt.`,
      });
      io.to(`user_${recipientId}`).emit("new_notification", notification);
      io.to(`service_${contract.serviceId}`).emit("contract_updated", {
        contract,
      });
    }

    res.json({
      success: true,
      message: "Contract updated successfully",
      contract,
    });
  } catch (err) {
    console.error("UPDATE CONTRACT ERROR:", err);
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
      return res
        .status(403)
        .json({ error: "You are not authorized to delete this contract" });
    }

    await Contract.findByIdAndDelete(id);

    // --- SOCKET EMIT ---
    const io = req.app.get("io");
    io.to(`service_${contract.serviceId}`).emit("contract_deleted", {
      contractId: contract._id,
    });

    return res.status(200).json({
      success: true,
      message: "Contract deleted successfully",
    });
  } catch (error) {
    console.error("DELETE CONTRACT ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
