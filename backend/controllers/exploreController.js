const Service = require('../models/Service');
const User = require('../models/User');
const Order = require('../models/Order');

/**
 * GET /api/explore/favorites
 * Returns trending jobs, popular providers, verified businesses, most viewed, and popular demand
 */
exports.getFeaturedFavourites = async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Top 12 Posts (Last 24 hours engagement or recently created)
    // First, get service IDs with most orders in last 24h
    const recentOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
      { $group: { _id: '$serviceId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]);

    const orderServiceIds = recentOrders.map((o) => o._id);

    // Fetch services: either they have recent orders, OR they were created in last 24h
    let topJobs = await Service.find({
      $or: [{ _id: { $in: orderServiceIds } }, { createdAt: { $gte: twentyFourHoursAgo } }],
      status: { $in: ['open', 'active'] },
    })
      .sort({ views: -1, createdAt: -1 })
      .limit(12)
      .populate('userId', 'name lastName avatarUrl');

    // Fallback/Fill: If we don't have 12 jobs yet, fill with top viewed jobs overall
    if (topJobs.length < 12) {
      const existingIds = topJobs.map((j) => j._id);
      const moreJobs = await Service.find({
        _id: { $not: { $in: existingIds } },
        status: { $in: ['open', 'active'] },
      })
        .sort({ views: -1, createdAt: -1 })
        .limit(12 - topJobs.length)
        .populate('userId', 'name lastName avatarUrl');

      topJobs = [...topJobs, ...moreJobs];
    }

    // 2. Top 6 Rated Verified Users
    const topRatedUsers = await User.find({
      verified: true,
      accountStatus: { $in: ['active', 'verified'] },
    })
      .sort({ averageRating: -1, reviewCount: -1 })
      .limit(6);

    // If still no verified users, fallback to top rated providers
    let finalUsers = topRatedUsers;
    if (finalUsers.length === 0) {
      finalUsers = await User.find({
        role: 'provider',
        accountStatus: { $in: ['active', 'verified'] },
      })
        .sort({ averageRating: -1, reviewCount: -1 })
        .limit(6);
    }

    // Combine and format for the frontend Favourites component
    const combinedData = [];

    // Map Top Jobs
    topJobs.forEach((job) => {
      combinedData.push({
        id: `job-${job._id}`,
        title: job.title,
        image:
          job.images && job.images.length > 0
            ? job.images[0]
            : 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2',
        badge: job.urgent ? 'Urgent' : job.createdAt >= twentyFourHoursAgo ? 'New' : 'Trending',
        type: 'job',
        originalId: job._id,
      });
    });

    // Map Users
    finalUsers.forEach((user) => {
      combinedData.push({
        id: `user-${user._id}`,
        title: `${user.name} ${user.lastName || ''}`,
        image: user.avatarUrl || 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2',
        badge: user.verified ? 'Verified Pro' : 'Top Rated',
        type: user.role === 'company' || user.planType === 'business' ? 'business' : 'provider',
        originalId: user._id,
      });
    });

    res.json(combinedData);
  } catch (err) {
    console.error('Explore Favourites Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/explore/stats
 * Returns dashboard stats: active jobs count, total users, average rating
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Count active jobs (status open or active)
    const activeJobsCount = await Service.countDocuments({
      status: { $in: ['open', 'active'] },
    });

    // Count total users
    const totalUsersCount = await User.countDocuments();

    // Calculate average rating across all users who have reviews
    const usersWithRatings = await User.find({ reviewCount: { $gt: 0 } });
    let averageRating = 0;
    if (usersWithRatings.length > 0) {
      const totalRating = usersWithRatings.reduce((sum, user) => sum + user.averageRating, 0);
      averageRating = totalRating / usersWithRatings.length;
      // Round to 1 decimal place
      averageRating = Math.round(averageRating * 10) / 10;
    }

    res.json({
      activeJobs: activeJobsCount,
      totalUsers: totalUsersCount,
      averageRating: averageRating,
    });
  } catch (err) {
    console.error('Explore Stats Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
