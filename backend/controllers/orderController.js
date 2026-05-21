const Order = require("../models/Order");
const Service = require("../models/Service");
const mongoose = require("mongoose");
const Chat = require("../models/ChatMessage");
const Contract = require("../models/Contract");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
const JobRequest = require("../models/JobRequest");

const User = require("../models/User");
const { calculatePointsFromService } = require("../utils/points");

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
 * POST /api/orders/request
 * Opprett ny jobb-forespørsel (Application)
 */
exports.createJobRequest = async (req, res) => {
  try {
    const { serviceId } = req.body;
    const customerId = req.userId;

    if (!serviceId)
      return res.status(400).json({ error: "Service ID is required" });

    if (!isValidId(serviceId))
      return res.status(400).json({ error: "Invalid service ID format" });

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const providerId = service.userId;

    if (providerId.toString() === customerId)
      return res.status(400).json({ error: "Cannot request your own service" });

    // --- CHECK APPLICATION LIMIT ---
    if (service.maxApplicants > 0) {
      const applicantCount = await JobRequest.countDocuments({
        serviceId,
        status: { $in: ["pending", "accepted"] }
      });

      if (applicantCount >= service.maxApplicants) {
        return res.status(400).json({ 
          error: "Søknadsfristen er nådd. Dette oppdraget tar ikke imot flere søknader.",
          limitReached: true 
        });
      }
    }
    // -------------------------------

    // Check if a request already exists
    const existingRequest = await JobRequest.findOne({
      serviceId,
      customerId,
      status: "pending",
    });
    if (existingRequest) {
      return res.status(400).json({
        error: "Du har allerede sendt en forespørsel på dette oppdraget",
      });
    }

    const jobRequest = await JobRequest.create({
      serviceId,
      customerId,
      providerId,
    });

    // --- INCREMENT CONTACT USAGE ---
    if (!req.isFreeContact) {
      await User.findByIdAndUpdate(customerId, {
        $inc: { monthlyContactUsage: 1 },
      });
    }
    // -------------------------------

    await jobRequest.populate("serviceId");
    await jobRequest.populate("customerId", "name");

    // Send notification to provider
    const notification = await Notification.create({
      userId: providerId,
      senderId: customerId,
      requestId: jobRequest._id,
      type: "order",
      content: `Ny forespørsel: ${jobRequest.customerId.name} ønsker å søke på "${jobRequest.serviceId.title}"`,
    });

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${providerId}`).emit("new_notification", notification);
      io.to(`user_${providerId}`).emit("new_job_request", jobRequest);
    }

    res.status(201).json(jobRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /api/orders/request/:id
 * Godkjenn eller avvis forespørsel
 */
exports.updateJobRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.userId;

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const jobRequest = await JobRequest.findById(id);
    if (!jobRequest) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (jobRequest.providerId.toString() !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // 🔒 Prevent multiple status changes
    if (jobRequest.status !== "pending") {
      return res.status(400).json({
        error: `Forespørselen er allerede ${jobRequest.status === "accepted" ? "godkjent" : "avvist"}`,
      });
    }

    jobRequest.status = status;
    await jobRequest.save();

    if (status === "accepted") {
      // 1. Create Chat
      let chat = await Chat.findOne({
        clientId: jobRequest.customerId,
        providerId: jobRequest.providerId,
        serviceId: jobRequest.serviceId,
      });

      if (!chat) {
        chat = await Chat.create({
          clientId: jobRequest.customerId,
          providerId: jobRequest.providerId,
          serviceId: jobRequest.serviceId,
          messages: [
            {
              senderId: jobRequest.providerId,
              text: "Forespørsel godkjent! Vi kan nå starte samtalen.",
            },
          ],
        });
      }

      // 2. Create automatic Contract (DRAFT)
      const service = await Service.findById(jobRequest.serviceId);
      const customer = await User.findById(jobRequest.customerId);
      const provider = await User.findById(jobRequest.providerId);

      const contract = await Contract.create({
        serviceId: jobRequest.serviceId,
        clientId: jobRequest.customerId,
        providerId: jobRequest.providerId,
        price: service.price || 0,
        content: `Standard kontrakt for ${service.title}`,
        status: "pending_signatures",
        useSafePay: false,
        serviceSnapshot: {
          title: service.title,
          description: service.description,
          category: service.category,
        },
        customerSnapshot: {
          userId: customer._id,
          name: customer.name,
        },
        providerSnapshot: {
          userId: provider._id,
          name: provider.name,
        },
      });

      // 3. Notify Customer
      const notification = await Notification.create({
        userId: jobRequest.customerId,
        senderId: jobRequest.providerId,
        requestId: jobRequest._id,
        type: "order",
        content: `Din forespørsel for "${service.title}" er godkjent! Kontrakt er opprettet.`,
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`user_${jobRequest.customerId}`).emit(
          "new_notification",
          notification,
        );
        io.to(`user_${jobRequest.customerId}`).emit("order_approved", {
          requestId: jobRequest._id,
          chatId: chat._id,
        });
      }
    } else {
      // Notify Rejection
      await jobRequest.populate("serviceId");
      const notification = await Notification.create({
        userId: jobRequest.customerId,
        senderId: jobRequest.providerId,
        requestId: jobRequest._id,
        type: "order",
        content: `Din forespørsel for "${jobRequest.serviceId.title}" ble avvist.`,
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`user_${jobRequest.customerId}`).emit(
          "new_notification",
          notification,
        );
      }
    }

    res.json(jobRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/orders/requests/my
 */
exports.getMyJobRequests = async (req, res) => {
  try {
    const userId = req.userId;
    const requests = await JobRequest.find({
      $or: [{ customerId: userId }, { providerId: userId }],
    })
      .populate("serviceId")
      .populate("customerId", "name")
      .populate("providerId", "name")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/orders
 * Hent alle ordre relatert til bruker (både som kunde og tilbyder)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const userId = req.userId;

    const orders = await Order.find({
      $or: [{ customerId: userId }, { providerId: userId }],
    })
      .populate("serviceId")
      .populate("customerId", "name email")
      .populate("providerId", "name email")
      .populate("contractId")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/orders/:id
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id))
      return res.status(400).json({ error: "Invalid order ID format" });

    const order = await Order.findById(id)
      .populate("serviceId")
      .populate("customerId", "name")
      .populate("providerId", "name")
      .populate("contractId");

    if (!order) return res.status(404).json({ error: "Order not found" });

    // Authorization
    if (!authorizeOrderAction(req, order)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/orders
 * Opprett ny ordre
 */
exports.createOrder = async (req, res) => {
  try {
    const { serviceId } = req.body;
    const customerId = req.userId;

    if (!serviceId)
      return res.status(400).json({ error: "Service ID is required" });

    if (!isValidId(serviceId))
      return res.status(400).json({ error: "Invalid service ID format" });

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const providerId = service.userId;

    if (providerId.toString() === customerId)
      return res.status(400).json({ error: "Cannot order your own service" });

    // Check if an order already exists for this service and customer
    const existingOrder = await Order.findOne({ serviceId, customerId });
    if (existingOrder) {
      return res.status(400).json({
        error: "Du har allerede sendt en forespørsel på dette oppdraget",
      });
    }

    const order = await Order.create({
      serviceId,
      customerId,
      providerId,
      price: service.price,
      status: "pending",
    });

    await order.populate("serviceId");
    await order.populate("customerId", "name");
    await order.populate("providerId", "name");

    // Send notification to provider
    const notification = await Notification.create({
      userId: providerId,
      senderId: customerId,
      orderId: order._id,
      type: "order",
      content: `Ny forespørsel: ${order.customerId.name} ønsker å søke på "${order.serviceId.title}"`,
    });

    // Emit socket event for real-time alert
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${providerId}`).emit("new_notification", notification);
      io.to(`user_${providerId}`).emit("new_order_request", order);
    }

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
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // 🔐 Authorization
    if (!authorizeOrderAction(req, order)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // 🔒 COMPLETED = FINAL STATE
    if (order.status === "completed") {
      return res.status(400).json({
        error: "Completed order cannot be modified",
      });
    }

    // Allowed fields
    const allowedFields = ["status", "price"];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No valid fields provided for update",
      });
    }

    if (updates.price !== undefined && typeof updates.price !== "number") {
      return res.status(400).json({
        error: "Price must be a number",
      });
    }

    // ✅ Valid status values
    const validStatus = [
      "pending",
      "accepted",
      "declined",
      "in_progress",
      "completed",
      "cancelled",
      "awaiting_payment",
      "paid",
    ];
    if (updates.status && !validStatus.includes(updates.status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // 🔁 STRICT STATUS FLOW
    const statusFlow = {
      pending: ["accepted", "declined", "completed", "cancelled"],
      accepted: ["in_progress", "completed", "cancelled"],
      in_progress: ["completed", "cancelled"],
      cancelled: [],
      declined: [],
      awaiting_payment: ["paid", "cancelled"],
      paid: ["completed"],
    };

    if (updates.status) {
      const allowedNext = statusFlow[order.status] || [];
      if (!allowedNext.includes(updates.status)) {
        return res.status(400).json({
          error: `Cannot change status from ${order.status} to ${updates.status}`,
        });
      }

      // 🚀 Handle APPROVAL logic
      if (updates.status === "accepted" && order.status === "pending") {
        // 1. Create Chat if it doesn't exist
        let chat = await Chat.findOne({
          clientId: order.customerId,
          providerId: order.providerId,
          serviceId: order.serviceId,
        });

        if (!chat) {
          chat = await Chat.create({
            clientId: order.customerId,
            providerId: order.providerId,
            serviceId: order.serviceId,
            messages: [
              {
                senderId: order.providerId,
                text: "Forespørsel godkjent! Vi kan nå starte samtalen.",
              },
            ],
          });
        }

        // 2. Create automatic Contract
        await order.populate("serviceId");
        await order.populate("customerId", "name");
        await order.populate("providerId", "name");

        const contract = await Contract.create({
          serviceId: order.serviceId._id,
          clientId: order.customerId._id,
          providerId: order.providerId._id,
          price: order.price || order.serviceId.price || 0,
          content: `Standard kontrakt for ${order.serviceId.title}`,
          status: "pending_signatures",
          useSafePay: true,
          serviceSnapshot: {
            title: order.serviceId.title,
            description: order.serviceId.description,
            category: order.serviceId.category,
          },
          customerSnapshot: {
            userId: order.customerId._id,
            name: order.customerId.name,
          },
          providerSnapshot: {
            userId: order.providerId._id,
            name: order.providerId.name,
          },
        });

        updates.contractId = contract._id;

        // 🚀 3. Start SafePay (optional/pending)
        await Payment.create({
          orderId: order._id,
          amount: contract.price,
          status: "pending", // Escrow status
        });

        // 4. Notify Customer
        const notification = await Notification.create({
          userId: order.customerId._id,
          senderId: order.providerId._id,
          orderId: order._id,
          type: "order",
          content: `Din forespørsel for "${order.serviceId.title}" er godkjent! Chat er nå åpen.`,
        });

        const io = req.app.get("io");
        if (io) {
          io.to(`user_${order.customerId._id}`).emit(
            "new_notification",
            notification,
          );
          io.to(`user_${order.customerId._id}`).emit("order_approved", {
            orderId: order._id,
            chatId: chat._id,
          });
        }
      }

      // ❌ Handle REJECTION logic
      if (updates.status === "declined" && order.status === "pending") {
        await order.populate("serviceId");
        await order.populate("providerId", "name");

        const notification = await Notification.create({
          userId: order.customerId,
          senderId: order.providerId._id,
          orderId: order._id,
          type: "order",
          content: `Din forespørsel for "${order.serviceId.title}" ble dessverre avvist.`,
        });

        const io = req.app.get("io");
        if (io) {
          io.to(`user_${order.customerId}`).emit(
            "new_notification",
            notification,
          );
        }
      }
    }

    // 🪙 POINTS & PORTFOLIO – SIRF EK DAFA
    if (updates.status === "completed" && order.status !== "completed") {
      await order.populate("serviceId");

      const service = order.serviceId;
      const points = calculatePointsFromService(service);

      // 1. Give points to customer
      await User.findByIdAndUpdate(order.customerId, {
        $inc: { pointsBalance: points },
        $push: {
          pointsHistory: {
            points,
            reason: "Job completed",
            orderId: order._id,
            serviceId: service._id,
          },
        },
      });

      updates.completedAt = new Date(); // optional but useful
    }

    const updatedOrder = await Order.findByIdAndUpdate(id, updates, {
      new: true,
    })
      .populate("serviceId")
      .populate("customerId", "name")
      .populate("providerId", "name");

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
      return res.status(400).json({ error: "Invalid order ID format" });

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Authorization
    if (!authorizeOrderAction(req, order)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Instead of hard delete → set status cancelled
    order.status = "cancelled";
    await order.save();

    res.status(200).json({ message: "Order cancelled successfully", order });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
