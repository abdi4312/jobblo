const os = require('os');
const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../../utils/apiResponse');
const { asyncHandler } = require('../../utils/apiResponse');
const AdminActivity = require('../../models/AdminActivity');
const User = require('../../models/User');
const Session = require('../../models/Session');
const ChatMessage = require('../../models/ChatMessage');
const Dispute = require('../../models/Dispute');
const ChatReport = require('../../models/ChatReport');
const SafePayHistory = require('../../models/SafePayHistory');

/**
 * GET /api/admin/system/health
 * Returns overall system health status.
 */
const getSystemHealth = asyncHandler(async (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  let dbResponseTime = 'N/A';
  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    dbResponseTime = `${Date.now() - start}ms`;
  } catch {
    dbResponseTime = 'N/A';
  }

  let status = 'healthy';
  if (mongoose.connection.readyState !== 1) {
    status = 'degraded';
  }

  return sendSuccess(res, {
    status,
    server: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
    },
    database: {
      state: dbState,
      responseTime: dbResponseTime,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/admin/system/metrics
 * Returns safe operational metrics for server, database, and application.
 */
const getSystemMetrics = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeSessions,
    openDisputes,
    openChatReports,
    totalChatMessages,
    totalSafePayHistory,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }),
    Session.countDocuments(),
    Dispute.countDocuments({ status: { $nin: ['resolved', 'closed'] } }),
    ChatReport.countDocuments({ status: { $nin: ['resolved', 'dismissed', 'closed'] } }),
    ChatMessage.countDocuments(),
    SafePayHistory.countDocuments(),
  ]);

  let dbResponseTime = 'N/A';
  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    dbResponseTime = `${Date.now() - start}ms`;
  } catch {
    dbResponseTime = 'N/A';
  }

  return sendSuccess(res, {
    server: {
      cpuUsage: os.loadavg(),
      totalRam: os.totalmem(),
      freeRam: os.freemem(),
      ramUsagePercent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
      processMemory: process.memoryUsage(),
      uptime: process.uptime(),
      activeRequests: 0,
    },
    database: {
      collections: {
        users: totalUsers,
        sessions: activeSessions,
        chatMessages: totalChatMessages,
        disputes: openDisputes,
        chatReports: openChatReports,
        safePayHistory: totalSafePayHistory,
      },
      responseTime: dbResponseTime,
      activeConnections: 0,
    },
    application: {
      totalUsers,
      activeSessions,
      socketConnections: 0,
      openDisputes,
      openChatReports,
      failedLogins: 0,
    },
  });
});

/**
 * GET /api/admin/system/errors
 * Returns application errors (runtime exceptions, failed requests, 5xx errors).
 * Does not include audit/activity events.
 */
const getSystemErrors = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const skip = (page - 1) * limit;

  let total = 0;
  let logs = [];

  try {
    // Read from ErrorLog (structured error events) instead of AdminActivity.
    // Filter by optional query params: severity, code, route, date range.
    const ErrorLog = require('../../models/ErrorLog');
    const query = {};
    if (req.query.severity) query.severity = req.query.severity;
    if (req.query.code) query.errorCode = req.query.code;
    if (req.query.route) query.route = { $regex: req.query.route, $options: 'i' };

    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo)
        query.createdAt.$lte = new Date(new Date(req.query.dateTo).setHours(23, 59, 59, 999));
    }

    [total, logs] = await Promise.all([
      ErrorLog.countDocuments(query),
      ErrorLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('resolvedBy', 'name email')
        .lean(),
    ]);
  } catch (err) {
    console.error('[SystemAdmin] getSystemErrors failed:', err.message);
    return sendError(res, 'Failed to retrieve system errors.', 500);
  }

  // Map ErrorLog documents to the system error response shape expected by frontend
  const mapped = logs.map((l) => ({
    _id: l._id,
    action: l.errorCode || 'INTERNAL_SERVER_ERROR',
    description: l.message || l.technicalMessage || '',
    createdAt: l.createdAt,
    adminId: l.resolvedBy || null,
    userId: l.userId || null,
    httpMethod: l.httpMethod || null,
    httpStatus: l.statusCode || null,
    requestPath: l.route || null,
    referenceId: l.referenceId || null,
  }));

  return sendSuccess(res, { errors: mapped }, 'System errors retrieved.', {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPreviousPage: page > 1,
  });
});

/**
 * GET /api/admin/system/disk
 * Returns storage configuration info. Placeholder since disk access is not exposed.
 */
const getDiskInfo = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    storage: {
      provider: 'Cloudinary / Azure Blob Storage',
      description:
        'File storage is handled externally via Cloudinary (images/documents) and Azure Blob Storage (backups/assets). Direct disk usage metrics are not exposed for security reasons.',
      status: 'configured',
    },
  });
});

module.exports = { getSystemHealth, getSystemMetrics, getSystemErrors, getDiskInfo };
