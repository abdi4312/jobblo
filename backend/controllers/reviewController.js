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
    const { orderId, serviceId, revieweeId, revieweeRole, rating, comment } =
      req.body;
    const reviewerId = req.userId;

    // Validate IDs
    if (!isValidId(revieweeId)) {
      return res.status(400).json({ error: "Invalid reviewee ID format" });
    }

    // Validate rating
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: "Rating must be a number between 1 and 5" });
    }

    const review = await Review.create({
      orderId,
      serviceId,
      reviewerId,
      revieweeId,
      revieweeRole,
      rating,
      comment,
    });

    // Update reviewee stats
    const allReviews = await Review.find({ revieweeId, revieweeRole });
    const reviewCount = allReviews.length;
    const averageRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;

    // We might want separate stats for seeker vs poster in the future,
    // but for now we update the main user stats
    await User.findByIdAndUpdate(revieweeId, {
      reviewCount,
      averageRating: Math.round(averageRating * 10) / 10,
    });

    const populatedReview = await Review.findById(review._id)
      .populate("reviewerId", "name username avatarUrl")
      .populate("serviceId", "title");

    res.status(201).json(populatedReview);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ error: "Du har allerede gitt vurdering for dette oppdraget" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query; // 'seeker' or 'poster'

    const query = { revieweeId: userId };
    if (role) {
      query.revieweeRole = role;
    }

    const reviews = await Review.find(query)
      .populate("reviewerId", "name username avatarUrl")
      .populate("serviceId", "title")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getReviewByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { role } = req.query; // 'seeker' or 'poster'
    const reviewerId = req.userId;

    const query = { orderId, reviewerId };
    if (role) {
      query.revieweeRole = role;
    }

    const review = await Review.findOne(query)
      .populate("reviewerId", "name username avatarUrl")
      .populate("serviceId", "title");

    res.json(review);
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

    // Update reviewee stats
    const allReviews = await Review.find({
      revieweeId: review.revieweeId,
      revieweeRole: review.revieweeRole,
    });
    const reviewCount = allReviews.length;
    const averageRating =
      reviewCount > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;

    await User.findByIdAndUpdate(review.revieweeId, {
      reviewCount,
      averageRating: Math.round(averageRating * 10) / 10,
    });

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
