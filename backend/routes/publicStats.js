const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Service = require('../models/Service');

// Lightweight in-memory cache to avoid hitting DB on every page view
const CACHE_TTL_MS = 60 * 1000; // 60s
let cache = { ts: 0, data: null };

/**
 * GET /api/public/stats
 * Public-safe aggregated counts for landing page
 */
router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && now - cache.ts < CACHE_TTL_MS) {
      return res.json(cache.data);
    }

    // Users: count active, non-deleted users
    const usersQuery = { isDeleted: { $ne: true }, accountStatus: { $ne: 'inactive' } };
    const users = await User.countDocuments(usersQuery);

    // Jobs/Services: count legitimate published services.
    // Exclude drafts, cancelled, expired and closed entries.
    const jobStatuses = ['open', 'paid', 'in_progress', 'completed', 'pending'];
    const jobs = await Service.countDocuments({ status: { $in: jobStatuses } });

    const data = { users, jobs };
    cache = { ts: now, data };

    res.json(data);
  } catch (err) {
    console.error('public/stats error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
