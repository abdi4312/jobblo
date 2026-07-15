/**
 * Standardized API response helpers for admin routes.
 * All admin endpoints must use these helpers for consistent output.
 */

/**
 * Send a successful response.
 * @param {object} res - Express response object
 * @param {object} data - Payload to include in "data"
 * @param {string} message - Human-readable success message
 * @param {object|null} pagination - Pagination metadata or null
 * @param {number} statusCode - HTTP status code (default 200)
 */
const sendSuccess = (res, data = {}, message = 'Request completed successfully.', pagination = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
};

/**
 * Send an error response — never exposes raw errors or stack traces.
 * @param {object} res - Express response object
 * @param {string} message - Safe user-facing error message
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {object|null} errors - Optional field-level validation errors
 */
const sendError = (res, message = 'Internal server error.', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

/**
 * Wrap an async controller function to catch unhandled errors.
 * Prevents raw Mongoose errors from leaking to the client.
 * @param {Function} fn - Async controller function
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch((err) => {
    // Log to server, never expose to client
    console.error('[Admin Controller Error]', err.message);
    return sendError(res, 'Internal server error.', 500);
  });
};

/**
 * Build pagination metadata for list endpoints.
 * @param {number} total - Total number of matching documents
 * @param {number} page - Current page number (1-based)
 * @param {number} limit - Page size
 */
const buildPagination = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

module.exports = { sendSuccess, sendError, asyncHandler, buildPagination };
