const AdminActivity = require('../models/AdminActivity');
const ErrorLog = require('../models/ErrorLog');
const { generateReference } = require('./generateReferenceId');
const { redactSensitive } = require('./sanitizer');

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
  metadata = {},
  errorCode = null,
  source = null,
}) {
  try {
    const errorName = error?.name || 'UnknownError';
    const errorMessage = error?.message || String(error || 'Unknown');

    // Map severity default
    let action = errorCode || 'error_500';
    let severity = httpStatus >= 500 ? 'critical' : 'error';

    // Skip 4xx client errors unless explicitly flagged
    if (httpStatus >= 400 && httpStatus < 500 && !errorCode) {
      return;
    }

    // Extract safe stack trace (first 10 lines for admin debugging)
    const safeStack =
      error.stack
        ?.split('\n')
        .slice(0, 10)
        .join('\n') || null;

    // Build safe metadata — sanitize request context
    const safeMeta = { correlationId, userId, ...metadata };
    const sanitized = redactSensitive(safeMeta);

    const description = `${httpMethod} ${requestPath} → ${httpStatus}: ${errorMessage}`;

    // Create an ErrorLog record (best-effort)
    const referenceId = generateReference({ prefix: 'ERR' });
    try {
      await ErrorLog.create({
        referenceId,
        errorCode: errorCode || 'INTERNAL_SERVER_ERROR',
        severity,
        message: errorMessage.substring(0, 500),
        technicalMessage: errorMessage,
        stack: safeStack,
        source,
        httpMethod: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(httpMethod) ? httpMethod : 'other',
        route: requestPath,
        statusCode: httpStatus,
        userId: userId || null,
        requestId: correlationId || null,
        metadata: sanitized,
      });
    } catch (err) {
      console.error('[ErrorLogger] Failed to persist ErrorLog:', err.message);
    }

    // Also create an AdminActivity audit entry for visibility in legacy systems
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
      metadata: sanitized,
    });
  } catch (logError) {
    // Fail silently to avoid cascading errors
    console.error('Failed to log error to database:', logError.message);
  }
}

module.exports = { logApplicationError };
