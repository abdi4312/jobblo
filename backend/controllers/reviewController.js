const Review = require("../models/Review");
const Service = require("../models/Service");
const User = require("../models/User");
const mongoose = require("mongoose");

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function authorizeReviewAction(req, review) {
  const isAdmin = req.user.role === "admin";
  const isOwner = review.reviewerId.toString() === String(req.userId);

  // Only admin OR the review owner can proceed
  return isAdmin || isOwner;
}

exports.createReview = async (req, res) => {
  try {
    const serviceId = "6942e7a1b439fa0cee4e8690"; // fixed for design
    const { rating, comment } = req.body;
    const reviewerId = req.userId;

    if (!isValidId(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID format" });
    }

    // Validate rating
    if (typeof rating !== "number" || rating < 0 || rating > 5) {
      return res
        .status(400)
        .json({ error: "Rating must be a number between 0 and 5" });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const review = await Review.create({
      serviceId,
      reviewerId,
      rating,
      comment,
    });

    const userReviews = await Review.find({ reviewerId }); 
    const reviewCount = userReviews.length;
    const avgRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;
    await User.findByIdAndUpdate(reviewerId, { reviewCount, averageRating: avgRating, });

    const populatedReview = await Review.findById(review._id)
      .populate("reviewerId", "name avatarUrl")
      .populate("serviceId", "title");

    res.status(201).json(populatedReview);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ error: "User has already reviewed this service" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Server error" });
  }
};

exports.getServiceReviews = async (req, res) => {
  try {
    const serviceId = "6942e7a1b439fa0cee4e8690"; // fixed for design

    if (!isValidId(serviceId)) {
      return res.status(400).json({ error: "Invalid service ID format" });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const reviews = await Review.find({ serviceId }).populate(
      "reviewerId",
      "name avatarUrl"
    );

    const totalReviews = reviews.length;
    let averageRating = 0;
    if (totalReviews > 0) {
      const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
      averageRating = Math.round((sum / totalReviews) * 10) / 10;
    }

    res.json({
      reviews,
      stats: {
        averageRating,
        totalReviews,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({})
      .populate("reviewerId", "name avatarUrl")
      .populate("serviceId", "title");

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid review ID format" });
    }

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Authorization check
    if (!authorizeReviewAction(req, review)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Delete review
    await Review.findByIdAndDelete(id);

    const userReviews = await Review.find(id); 
    const reviewCount = userReviews.length;
    const avgRating = reviewCount > 0 ? userReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;
    await User.findByIdAndUpdate(review.reviewerId, { reviewCount, averageRating: avgRating, });

    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get latest reviews across the platform
exports.getLatestReviews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5; // Default 5 reviews

    const reviews = await Review.find()
      .sort({ _id: -1 }) // Sort by newest first
      .limit(limit)
      .populate("reviewerId", "name avatarUrl")
      .populate("serviceId", "title userId")
      .populate({
        path: "serviceId",
        populate: {
          path: "userId",
          select: "name avatarUrl",
        },
      });

    res.json({
      reviews,
      count: reviews.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all reviews for services owned by a specific user
exports.getUserReviews = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!isValidId(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Find all services owned by this user
    const userServices = await Service.find({ userId: userId }).select("_id");
    console.log(userServices);
    const serviceIds = userServices.map((service) => service._id);
    console.log(serviceIds);
    // Find all reviews for these services
    const reviews = await Review.find({ serviceId: { $in: serviceIds } })
      .populate("reviewerId", "name avatarUrl")
      .populate("serviceId", "title")
      .sort({ _id: -1 });

    // Calculate stats
    const totalReviews = reviews.length;
    let averageRating = 0;
    if (totalReviews > 0) {
      const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
      averageRating = Math.round((sum / totalReviews) * 10) / 10;
    }

    res.json({
      reviews,
      stats: {
        averageRating,
        totalReviews,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};