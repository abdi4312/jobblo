const User = require("../models/User");
const Service = require("../models/Service");
const Favorite = require("../models/Favorite");
const mongoose = require("mongoose");

// GET /api/feed/following
exports.getFollowingFeed = async (req, res) => {
  try {
    const userId = req.userId; // Always authenticated user

    // Fetch only fields needed to reduce payload + speed up query
    const user = await User.findById(userId).select("following");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Empty feed if user follows no one
    if (!user.following || user.following.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const services = await Service.find({
      userId: { $in: user.following },
      status: "open",
    })
      .populate("userId", "name avatarUrl verified")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error("FOLLOWING FEED ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/feed/discover
exports.getDiscoverFeed = async (req, res) => {
  try {
    // Simple: Get latest open services, maybe random in future
    const services = await Service.find({ status: "open" })
      .populate("userId", "name avatarUrl verified")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error("DISCOVER FEED ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/feed/peoples
exports.getPeoplesFeed = async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Trending: Most favorited in last 24 hours
    const trendingFavorites = await Favorite.aggregate([
      { $match: { createdAt: { $gte: last24h } } },
      { $group: { _id: "$service", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);

    const trendingServiceIds = trendingFavorites.map((f) => f._id);

    // 2. Most Liked: Sort by length of likes array
    // 3. Paid Promotion: Services with promoted: true
    const services = await Service.find({
      $or: [
        { _id: { $in: trendingServiceIds } },
        { promoted: true },
        { status: "open" },
      ],
      status: "open",
    })
      .populate("userId", "name avatarUrl verified")
      .lean();

    // Calculate a score for sorting
    const scoredServices = services.map((service) => {
      let score = 0;

      // Priority 1: Trending in last 24h
      if (
        trendingServiceIds.some(
          (id) => id.toString() === service._id.toString(),
        )
      ) {
        score += 100;
      }

      // Priority 2: Likes
      score += (service.likes?.length || 0) * 2;

      // Priority 3: Paid/Promoted
      if (service.promoted) score += 50;

      return { ...service, score };
    });

    // Sort by score
    scoredServices.sort((a, b) => b.score - a.score);

    // Return top 50
    const result = scoredServices.slice(0, 50);

    return res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("PEOPLES FEED ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/feed/favorites
exports.getFavoritesFeed = async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Aggregate favorites to find most favorited in last 24 hours
    const topFavorites = await Favorite.aggregate([
      { $match: { createdAt: { $gte: last24h } } },
      { $group: { _id: "$service", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]);

    const serviceIds = topFavorites.map((f) => f._id);

    // Fetch the services
    const services = await Service.find({
      _id: { $in: serviceIds },
      status: "open",
    }).populate("userId", "name avatarUrl verified");

    // Maintain sorting order based on favorite count
    const sortedServices = serviceIds
      .map((id) => services.find((s) => s._id.toString() === id.toString()))
      .filter(Boolean);

    return res.json({
      success: true,
      count: sortedServices.length,
      data: sortedServices,
    });
  } catch (error) {
    console.error("FAVORITES FEED ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
