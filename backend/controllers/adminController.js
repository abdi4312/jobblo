const Hero = require("../models/Hero");
const bcrypt = require("bcryptjs");
const Service = require("../models/Service");
const User = require("../models/User");
const Order = require("../models/Order");
const Notification = require("../models/Notification");

// Authentication handled by middleware - req.user and req.userId available
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // --- Filter Logic ---
    let query = {};
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }
    if (req.query.role) {
      query.role = req.query.role;
    }

    // --- Current Month Logic ---
    const startOfMonth = new Date();
    startOfMonth.setDate(1); // Mahine ki 1st date
    startOfMonth.setHours(0, 0, 0, 0); // Time reset taaki exact start se count ho

    // Parallel Queries for better performance
    const [totalUsers, activeThisMonth, users] = await Promise.all([
      User.countDocuments(query), // Filtered total users
      User.countDocuments({ createdAt: { $gte: startOfMonth } }), // Is mahine ke new users
      User.find(query)
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
    ]);

    res.json({
      users,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
      totalUsers,
      activeThisMonth, // Yeh naya field frontend ke liye
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const newUser = new User({
      name,
      email,
      phone,
      password: hashed,
      role: role || "user",
    });

    await newUser.save();
    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Failed to create user", error });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customerId", "name email")
      .populate("providerId", "name email")
      .populate("serviceId", "title");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalServices = await Service.countDocuments();
    const services = await Service.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      services,
      totalPages: Math.ceil(totalServices / limit),
      currentPage: page,
      totalResults: totalServices,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Admin control for viewing broadcast history
exports.getSystemNotificationsHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Filter: Sirf system-wide alerts (global broadcasts)
        const query = { userId: null, isSystem: true };

        const total = await Notification.countDocuments(query);
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 }) // Latest first
            .skip(skip)
            .limit(parseInt(limit));
        
        res.json({
            success: true,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            data: notifications
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllHeroItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const total = await Hero.countDocuments();
    const heroItems = await Hero.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      heroes: heroItems,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (err) {
    // Yeh line aapko terminal mein batayegi ke error kya hai
    console.error("GET HERO ERROR:", err.message);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

exports.UpdateHero = async (req, res) => {
  try {
    const hero = await Hero.findById(req.params.id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // Update text fields
    hero.title = req.body.title ?? hero.title;
    hero.subtitle = req.body.subtitle ?? hero.subtitle;
    hero.description = req.body.description ?? hero.description;

    // Image URL update (Agar frontend se naya URL aaye)
    hero.image = req.body.image ?? hero.image;

    // Date Fields Update
    hero.activeFrom = req.body.activeFrom ?? hero.activeFrom;
    hero.expireAt = req.body.expireAt ?? hero.expireAt;

    await hero.save();
    res.status(200).json(hero);
  } catch (err) {
    console.error("Update hero error:", err);
    res.status(500).json({ error: "Kunne ikke oppdatere hero" });
  }
};

/**
 * DELETE HERO
 */
exports.DeleteHero = async (req, res) => {
  try {
    const hero = await Hero.findById(req.params.id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // Sirf database se delete karein kyunki image external URL hai
    await hero.deleteOne();
    res.status(200).json({ message: "Hero slettet" });
  } catch (err) {
    console.error("Delete hero error:", err);
    res.status(500).json({ error: "Kunne ikke slette hero" });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true },
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
