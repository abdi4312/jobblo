const Review = require('../models/Review');
const Service = require('../models/Service');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function authorizeReviewAction(req, review) {
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superAdmin';
  const isOwner = review.reviewerId.toString() === String(req.userId);

  // Only admin OR the review owner can proceed
  return isAdmin || isOwner;
}

exports.createReview = async (req, res) => {
  try {
    const {
      orderId,
      serviceId,
      revieweeId,
      revieweeRole,
      rating,
      comment,
      photos,
      recommendWorker,
    } = req.body;
    const reviewerId = req.userId;

    // Validate IDs
    if (!isValidId(revieweeId)) {
      return res.status(400).json({ error: 'Invalid reviewee ID format' });
    }

    // Validate rating
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }

    // ── Eligibility (F-34) ────────────────────────────────────────────────────
    // This endpoint previously validated only the reviewee id and the rating, so any
    // authenticated account could post a 1-star review against any user and move their
    // public averageRating. A review is only legitimate when the reviewer took part in
    // a completed order and is rating the other party in that same order.
    if (!isValidId(orderId)) {
      return res.status(400).json({ error: 'Vurderinger må knyttes til et oppdrag.' });
    }

    const order = await Order.findById(orderId).select('customerId providerId serviceId status');
    if (!order) {
      return res.status(404).json({ error: 'Oppdraget ble ikke funnet.' });
    }

    const isCustomer = String(order.customerId) === String(reviewerId);
    const isProvider = String(order.providerId) === String(reviewerId);
    if (!isCustomer && !isProvider) {
      return res.status(403).json({ error: 'Du kan bare vurdere oppdrag du selv har deltatt i.' });
    }

    if (order.status !== 'completed') {
      return res
        .status(400)
        .json({ error: 'Oppdraget må være fullført før du kan gi en vurdering.' });
    }

    const counterpartyId = isCustomer ? order.providerId : order.customerId;
    if (!counterpartyId || String(revieweeId) !== String(counterpartyId)) {
      return res
        .status(400)
        .json({ error: 'Du kan bare vurdere den andre parten i oppdraget.' });
    }

    const review = await Review.create({
      orderId,
      // Derived from the order, not the request body — the client must not be able to
      // attach a review to an unrelated service.
      serviceId: order.serviceId,
      reviewerId,
      revieweeId,
      revieweeRole,
      rating,
      comment,
      photos: photos || [],
      recommendWorker: recommendWorker || false,
    });

    // Update reviewee stats
    const allReviews = await Review.find({ revieweeId });
    const reviewCount = allReviews.length;
    const averageRating = reviewCount > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

    // Update the main user stats
    const updatedUser = await User.findByIdAndUpdate(
      revieweeId,
      {
        reviewCount,
        averageRating: Math.round(averageRating * 10) / 10,
      },
      { new: true }
    );

    const populatedReview = await Review.findById(review._id)
      .populate('reviewerId', 'name lastName username avatarUrl')
      .populate('serviceId', 'title');

    res.status(201).json(populatedReview);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Du har allerede gitt vurdering for dette oppdraget' });
    }
    console.error('createReview Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, photos, recommendWorker } = req.body;
    const userId = req.userId;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid review ID format' });
    }

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Authorization check
    if (!authorizeReviewAction(req, review)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update review fields
    if (rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment;
    }

    if (photos !== undefined) {
      review.photos = photos;
    }

    if (recommendWorker !== undefined) {
      review.recommendWorker = recommendWorker;
    }

    await review.save();

    // Update reviewee stats
    const allReviews = await Review.find({ revieweeId: review.revieweeId });
    const reviewCount = allReviews.length;
    const averageRating = reviewCount > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

    await User.findByIdAndUpdate(review.revieweeId, {
      reviewCount,
      averageRating: Math.round(averageRating * 10) / 10,
    });

    const populatedReview = await Review.findById(review._id)
      .populate('reviewerId', 'name lastName username avatarUrl')
      .populate('serviceId', 'title');

    res.json(populatedReview);
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).json({ error: 'Server error' });
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
      .populate('reviewerId', 'name lastName username avatarUrl')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    console.error('getUserReviews Error:', err);
    res.status(500).json({ error: 'Server error' });
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
      .populate('reviewerId', 'name lastName username avatarUrl')
      .populate('serviceId', 'title');

    res.json(review);
  } catch (err) {
    console.error('getReviewByOrder Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getReviewByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    // (F-34) This route was unauthenticated and populated both parties' names and
    // avatars, so anyone holding an order id could deanonymise the pair. Restricted to
    // the two participants — public reputation is served by GET /users/:userId/reviews.
    if (!isValidId(orderId)) {
      return res.status(400).json({ error: 'Ugyldig ordre-ID' });
    }

    const order = await Order.findById(orderId).select('customerId providerId');
    if (!order) {
      return res.status(404).json({ error: 'Oppdraget ble ikke funnet.' });
    }

    const isParticipant =
      String(order.customerId) === String(req.userId) ||
      String(order.providerId) === String(req.userId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Ikke tilgang.' });
    }

    const reviews = await Review.find({ orderId })
      .populate('reviewerId', 'name lastName username avatarUrl')
      .populate('revieweeId', 'name lastName username avatarUrl')
      .populate('serviceId', 'title');

    res.json(reviews);
  } catch (err) {
    console.error('getReviewByOrderId Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({})
      .populate('reviewerId', 'name lastName avatarUrl')
      .populate('serviceId', 'title');

    res.json(reviews);
  } catch (err) {
    console.error('getAllReviews Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid review ID format' });
    }

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Authorization check
    if (!authorizeReviewAction(req, review)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete review
    await Review.findByIdAndDelete(id);

    // Update reviewee stats
    const allReviews = await Review.find({ revieweeId: review.revieweeId });
    const reviewCount = allReviews.length;
    const averageRating = reviewCount > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

    await User.findByIdAndUpdate(review.revieweeId, {
      reviewCount,
      averageRating: Math.round(averageRating * 10) / 10,
    });

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('deleteReview Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get latest reviews across the platform
exports.getLatestReviews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5; // Default 5 reviews

    const reviews = await Review.find()
      .sort({ _id: -1 }) // Sort by newest first
      .limit(limit)
      .populate('reviewerId', 'name lastName avatarUrl')
      .populate({
        path: 'serviceId',
        select: 'title userId',
        populate: {
          path: 'userId',
          select: 'name lastName avatarUrl',
        },
      });

    res.json({
      reviews,
      count: reviews.length,
    });
  } catch (err) {
    console.error('getLatestReviews Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
