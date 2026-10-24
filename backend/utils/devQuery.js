/**
 * Query helpers shared by the developer-console controllers (they used to carry copies):
 * time constants, ?range parsing, time buckets for aggregations, safe regex search,
 * id validation and pagination.
 */
const mongoose = require('mongoose');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const RANGES = { '1h': HOUR, '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY };

/** Parses ?range=1h|24h|7d|30d or ?from&to into { from, to, bucketMs }. Bad input → last 24 h. */
function parseRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - (RANGES[query.range] || DAY));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return parseRange({ range: '24h' });
  const span = to - from;
  const bucketMs = span <= HOUR ? 60 * 1000 : span <= 2 * DAY ? HOUR : span <= 8 * DAY ? 6 * HOUR : DAY;
  return { from, to, bucketMs };
}

/** Aggregation expression: a date field rounded down to its bucket. */
const bucketExpr = (field, bucketMs) => ({ $toDate: { $subtract: [{ $toLong: field }, { $mod: [{ $toLong: field }, bucketMs] }] } });

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Case-insensitive "contains" match on user input, regex-escaped (no ReDoS, no `.*` scans). */
const rx = (v) => ({ $regex: escapeRegex(v), $options: 'i' });
const isId = (v) => mongoose.isValidObjectId(v) && String(v).length === 24;

const pageParams = (q, max = 100) => {
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 25, 1), max);
  return { page, limit, skip: (page - 1) * limit };
};
/** Aggregation rows [{ _id, n }] → { value: count }. */
const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'none', r.n]));
/** { value: count } of one field, optionally filtered. */
const groupCount = (Model, field, match = {}) => Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]).then(countBy);

/** Audit-log entry for a developer-console write (who, what, from where). */
const audit = (req, description, metadata, targetModel = 'other', targetId = null) =>
  require('../services/admin/activityService').logActivity({ adminId: req.user._id, action: 'other', targetModel, targetId, description, metadata, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });

const pagination = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page < Math.ceil(total / limit), hasPreviousPage: page > 1 });

module.exports = { MINUTE, HOUR, DAY, RANGES, parseRange, bucketExpr, escapeRegex, rx, isId, pageParams, pagination, countBy, groupCount, audit };
