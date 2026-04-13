const User = require("../models/User");
const Service = require("../models/Service");
const Favorite = require("../models/Favorite");
const List = require("../models/List");
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

    // 1. Aggregate from specific Favorite collection (last 24h)
    const favoriteTrending = await Favorite.aggregate([
      { $match: { createdAt: { $gte: last24h } } },
      { $group: { _id: "$service", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // 2. Aggregate from List model (services added to lists in last 24h)
    // Since List stores services in an array, we unwind them
    const listTrending = await List.aggregate([
      { $match: { updatedAt: { $gte: last24h } } }, // updatedAt gives a hint about recent activity
      { $unwind: "$services" },
      { $group: { _id: "$services", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Combine both results
    const combinedResults = [...favoriteTrending, ...listTrending];

    // Sum up counts for same service IDs
    const scoreMap = {};
    combinedResults.forEach((item) => {
      const id = item._id.toString();
      scoreMap[id] = (scoreMap[id] || 0) + item.count;
    });

    // Sort service IDs by their total "favorite" count
    const sortedServiceIds = Object.keys(scoreMap)
      .sort((a, b) => scoreMap[b] - scoreMap[a])
      .slice(0, 30);

    // Fetch the services
    const services = await Service.find({
      _id: { $in: sortedServiceIds },
      status: "open",
    }).populate("userId", "name avatarUrl verified");

    // Maintain sorting order and add favCount
    const finalData = sortedServiceIds
      .map((id) => {
        const service = services.find((s) => s._id.toString() === id);
        if (!service) return null;

        // Convert to object and add the count from our scoreMap
        const serviceObj = service.toObject();
        return {
          ...serviceObj,
          favCount: scoreMap[id] || 0,
        };
      })
      .filter(Boolean);

    return res.json({
      success: true,
      count: finalData.length,
      data: finalData,
    });
  } catch (error) {
    console.error("FAVORITES FEED ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
