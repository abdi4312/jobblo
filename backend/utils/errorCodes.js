// Central registry for stable error codes
module.exports = {
  // Auth
  AUTH_INVALID_CREDENTIALS: { code: 'AUTH_INVALID_CREDENTIALS', defaultMessage: 'Invalid credentials', httpStatus: 401, severity: 'error' },
  AUTH_SESSION_EXPIRED: { code: 'AUTH_SESSION_EXPIRED', defaultMessage: 'Session expired', httpStatus: 401, severity: 'warning' },

  // User
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', defaultMessage: 'User not found', httpStatus: 404, severity: 'info' },

  // Jobs
  JOB_CREATE_FAILED: { code: 'JOB_CREATE_FAILED', defaultMessage: 'Failed to create job', httpStatus: 500, severity: 'critical' },
  JOB_INVALID_LOCATION: { code: 'JOB_INVALID_LOCATION', defaultMessage: 'Invalid job location', httpStatus: 400, severity: 'warning' },
  JOB_INVALID_BUDGET: { code: 'JOB_INVALID_BUDGET', defaultMessage: 'Invalid budget', httpStatus: 400, severity: 'warning' },

  // Validation
  VALIDATION_FAILED: { code: 'VALIDATION_FAILED', defaultMessage: 'Validation failed', httpStatus: 400, severity: 'warning' },

  // Payments
  SAFEPAY_PAYMENT_FAILED: { code: 'SAFEPAY_PAYMENT_FAILED', defaultMessage: 'SafePay payment failed', httpStatus: 502, severity: 'critical' },
  STRIPE_TRANSFER_FAILED: { code: 'STRIPE_TRANSFER_FAILED', defaultMessage: 'Stripe transfer failed', httpStatus: 502, severity: 'critical' },

  // Uploads
  UPLOAD_INVALID_FILE: { code: 'UPLOAD_INVALID_FILE', defaultMessage: 'Invalid file uploaded', httpStatus: 400, severity: 'warning' },
  UPLOAD_FAILED: { code: 'UPLOAD_FAILED', defaultMessage: 'Upload failed', httpStatus: 500, severity: 'error' },

  // External
  EXTERNAL_API_ERROR: { code: 'EXTERNAL_API_ERROR', defaultMessage: 'External service failed', httpStatus: 502, severity: 'error' },

  // Database
  DATABASE_ERROR: { code: 'DATABASE_ERROR', defaultMessage: 'Database error', httpStatus: 500, severity: 'critical' },

  // System
  INTERNAL_SERVER_ERROR: { code: 'INTERNAL_SERVER_ERROR', defaultMessage: 'Internal server error', httpStatus: 500, severity: 'critical' },
};
