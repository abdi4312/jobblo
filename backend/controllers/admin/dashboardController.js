const User = require('../../models/User');
const Service = require('../../models/Service');
const Order = require('../../models/Order');
const Transaction = require('../../models/Transaction');
const Subscription = require('../../models/Subscription');
const Review = require('../../models/Review');
const Notification = require('../../models/Notification');
const AdminActivity = require('../../models/AdminActivity');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');

/**
 * GET /api/admin/overview
 * Returns real aggregated dashboard data in a single request.
 * Uses parallel MongoDB queries for performance.
 */
const getOverview = asyncHandler(async (req, res) => {
  const now = new Date();

  // Current month boundaries
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Last 30 days for trend chart
  const last30Days = new Date(now);
  last30Days.setDate(now.getDate() - 29);
  last30Days.setHours(0, 0, 0, 0);

  // ---- Run all aggregations in parallel ----
  const [
    totalUsers,
    usersThisMonth,
    usersPrevMonth,
    usersByRole,
    totalServices,
    servicesThisMonth,
    totalOrders,
    ordersByStatus,
    ordersThisMonth,
    revenueResult,
    revenuePrevMonth,
    activeSubscriptions,
    pendingReviews,
    userRegistrationTrend,
    recentActivity,
    recentUsers,
    recentServices,
    recentOrders,
  ] = await Promise.all([
    // Total users (non-deleted)
    User.countDocuments({ isDeleted: { $ne: true } }),

    // Users registered this month
    User.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: startOfMonth },
    }),

    // Users registered previous month (for comparison)
    User.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
    }),

    // Users grouped by role
    User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),

    // Total services
    Service.countDocuments(),

    // Services created this month
    Service.countDocuments({ createdAt: { $gte: startOfMonth } }),

    // Total orders
    Order.countDocuments(),

    // Orders grouped by status
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Orders this month
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),

    // Total successful transaction revenue this month (NOK)
    Transaction.aggregate([
      {
        $match: {
          status: 'succeeded',
          currency: 'nok',
          createdAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Revenue previous month
    Transaction.aggregate([
      {
        $match: {
          status: 'succeeded',
          currency: 'nok',
          createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Active subscriptions
    Subscription.countDocuments({ 'currentPlan.status': 'active' }),

    // Reviews (total — as "pending moderation" flag — adjust when moderation field exists)
    Review.countDocuments(),

    // User registrations by day for last 30 days
    User.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          createdAt: { $gte: last30Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Latest 10 admin activity records
    AdminActivity.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('adminId', 'name email')
      .lean(),

    // Recent users
    User.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role accountStatus createdAt avatarUrl')
      .lean(),

    // Recent services
    Service.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title price status categories createdAt')
      .populate('userId', 'name')
      .lean(),

    // Recent orders
    Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('status paymentStatus agreedPrice createdAt')
      .populate('customerId', 'name')
      .populate('serviceId', 'title')
      .lean(),
  ]);

  // ---- Build safe computed values ----
  const revenueThisMonth = revenueResult[0]?.total ?? 0;
  const revenuePrev = revenuePrevMonth[0]?.total ?? 0;

  // Calculate period-over-period change (returns null when no previous data)
  const calcChange = (current, previous) => {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  };

  // Normalize role distribution into a stable map
  const roleMap = { user: 0, provider: 0, company: 0, superAdmin: 0 };
  usersByRole.forEach(({ _id, count }) => {
    if (_id in roleMap) roleMap[_id] = count;
  });

  // Normalize order status distribution
  const orderStatusMap = {};
  ordersByStatus.forEach(({ _id, count }) => {
    if (_id) orderStatusMap[_id] = count;
  });

  return sendSuccess(res, {
    stats: {
      totalUsers: {
        value: totalUsers,
        thisMonth: usersThisMonth,
        change: calcChange(usersThisMonth, usersPrevMonth),
      },
      totalServices: {
        value: totalServices,
        thisMonth: servicesThisMonth,
      },
      totalOrders: {
        value: totalOrders,
        thisMonth: ordersThisMonth,
      },
      revenueThisMonth: {
        value: revenueThisMonth,
        prevMonth: revenuePrev,
        change: calcChange(revenueThisMonth, revenuePrev),
        currency: 'NOK',
      },
      activeSubscriptions: {
        value: activeSubscriptions,
      },
      totalReviews: {
        value: pendingReviews,
      },
    },
    roleDistribution: roleMap,
    orderStatusDistribution: orderStatusMap,
    userRegistrationTrend,
    recentActivity,
    recentUsers,
    recentServices,
    recentOrders,
  });
});

module.exports = { getOverview };
