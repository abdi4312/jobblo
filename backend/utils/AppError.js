class AppError extends Error {
  constructor({ code = 'INTERNAL_SERVER_ERROR', message = 'Internal server error', statusCode = 500, details = null }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
