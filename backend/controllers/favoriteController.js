const Favorite = require("../models/Favorite");
const Service = require("../models/Service");
const mongoose = require("mongoose");

// Helper function for ObjectId validation
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ------------------------------------
// GET FAVORITES
// ------------------------------------
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.userId; // Always authenticated user

    const favorites = await Favorite.find({ user: userId })
      .populate("service")
      .populate("user", "name avatarUrl");

    return res.json({
      success: true,
      count: favorites.length,
      data: favorites,
    });
  } catch (error) {
    console.error("GET FAVORITES ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ------------------------------------
// ADD FAVORITE
// ------------------------------------
exports.addFavorite = async (req, res) => {
  try {
    const userId = req.userId; // Always authenticated user
    const { serviceId } = req.params;

    if (!isValidId(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID format" });
    }

    // Check service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Prevent duplicates
    const existing = await Favorite.findOne({ user: userId, service: serviceId });
    if (existing) {
      return res.status(400).json({ error: "Already favorited" });
    }

    // Create favorite
    const favorite = await Favorite.create({ user: userId, service: serviceId });
    const populated = await favorite.populate("service user", "name avatarUrl");

    return res.status(201).json({
      success: true,
      message: "Favorite added",
      data: populated,
    });
  } catch (error) {
    console.error("ADD FAVORITE ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ------------------------------------
// REMOVE FAVORITE
// ------------------------------------
exports.removeFavorite = async (req, res) => {
  try {
    const userId = req.userId; // Always authenticated user
    const { serviceId } = req.params;

    if (!isValidId(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID format" });
    }

    const deleted = await Favorite.findOneAndDelete({
      user: userId,
      service: serviceId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Favorite removed",
    });
  } catch (error) {
    console.error("REMOVE FAVORITE ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};
