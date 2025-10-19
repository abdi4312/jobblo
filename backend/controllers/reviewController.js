const Review = require('../models/Review');
const Service = require('../models/Service');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.createReview = async (req, res) => {
    try {
        const serviceId = req.params.id;
        const { reviewerId, rating, comment } = req.body;

        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        if (!mongoose.Types.ObjectId.isValid(reviewerId)) {
            return res.status(400).json({ error: 'Invalid reviewer ID format' });
        }

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        const reviewer = await User.findById(reviewerId);
        if (!reviewer) {
            return res.status(404).json({ error: 'Reviewer not found' });
        }

        const review = await Review.create({
            serviceId,
            reviewerId,
            rating,
            comment
        });

        const populatedReview = await Review.findById(review._id)
            .populate('reviewerId', 'name avatarUrl')
            .populate('serviceId', 'title');

        res.status(201).json(populatedReview);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'User has already reviewed this service' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getServiceReviews = async (req, res) => {
    try {
        const serviceId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        const reviews = await Review.find({ serviceId })
            .populate('reviewerId', 'name avatarUrl');

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
                totalReviews
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find({})
            .populate('reviewerId', 'name avatarUrl')
            .populate('serviceId', 'title');

        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const reviewId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID format' });
        }

        const review = await Review.findByIdAndDelete(reviewId);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json({ message: 'Review deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all reviews for services owned by a specific user
exports.getUserReviews = async (req, res) => {
    try {
        const userId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find all services owned by this user
        const userServices = await Service.find({ userId: userId }).select('_id');
        const serviceIds = userServices.map(service => service._id);

        // Find all reviews for these services
        const reviews = await Review.find({ serviceId: { $in: serviceIds } })
            .populate('reviewerId', 'name avatarUrl')
            .populate('serviceId', 'title')
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
                totalReviews
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};