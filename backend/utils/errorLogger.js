const AdminActivity = require('../models/AdminActivity');

/**
 * Logs an application error to AdminActivity with type='error'.
 * Never stores passwords, tokens, cookies, or sensitive request payloads.
 *
 * @param {Object} params
 * @param {Error} params.error - The error object
 * @param {string} params.requestPath - HTTP request path
 * @param {string} params.httpMethod - HTTP method (GET, POST, etc)
 * @param {number} params.httpStatus - HTTP status code
 * @param {string} params.ip - Client IP address
 * @param {string} params.userAgent - User-Agent header
 * @param {string} [params.userId] - Authenticated user ID (optional)
 * @param {string} [params.correlationId] - Request correlation ID (optional)
 */
async function logApplicationError({
  error,
  requestPath,
  httpMethod,
  httpStatus,
  ip,
  userAgent,
  userId,
  correlationId,
}) {
  try {
    const errorName = error.name || 'UnknownError';
    const errorMessage = error.message || String(error);

    // Determine action and severity based on status code
    let action = 'error_500';
    let severity = 'error';

    if (httpStatus >= 500) {
      action = 'error_500';
      severity = 'critical';
    } else if (httpStatus >= 400) {
      // Only log 400/500 range server errors, not normal validation failures
      return; // Skip logging 4xx client errors
    }

    // Extract safe stack trace (first 10 lines for admin debugging)
    const safeStack =
      error.stack
        ?.split('\n')
        .slice(0, 10)
        .join('\n') || null;

    // Build safe metadata — sanitize request context
    const metadata = {};
    if (correlationId) metadata.correlationId = correlationId;
    if (userId) metadata.userId = userId;

    const description = `${httpMethod} ${requestPath} → ${httpStatus}: ${errorMessage}`;

    await AdminActivity.create({
      type: 'error',
      action,
      severity,
      description,
      httpMethod: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(httpMethod)
        ? httpMethod
        : 'other',
      httpStatus,
      requestPath,
      errorName,
      errorMessage,
      stack: safeStack,
      ip,
      userAgent,
      adminId: userId || null,
      metadata,
    });
  } catch (logError) {
    // Fail silently to avoid cascading errors
    console.error('Failed to log error to database:', logError.message);
  }
}

module.exports = { logApplicationError };
