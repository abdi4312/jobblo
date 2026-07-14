const mongoose = require('mongoose');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Parse and validate pagination params from query string.
 * Enforces a maximum page size to prevent full-collection fetches.
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Validate that a string is a valid MongoDB ObjectId.
 * Returns the ObjectId if valid, null otherwise.
 */
const parseObjectId = (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

/**
 * Whitelist and parse sort parameters.
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 * @param {string[]} allowedFields - Fields permitted for sorting
 * @param {string} defaultField - Default sort field
 */
const parseSort = (sortBy, sortOrder, allowedFields, defaultField = 'createdAt') => {
  const field = allowedFields.includes(sortBy) ? sortBy : defaultField;
  const order = sortOrder === 'asc' ? 1 : -1;
  return { [field]: order };
};

/**
 * Parse an ISO date string safely.
 * Returns null if the value is invalid or missing.
 */
const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

module.exports = { parsePagination, parseObjectId, parseSort, parseDate, MAX_LIMIT, DEFAULT_LIMIT };
