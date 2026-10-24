const createError = require('http-errors');
const multer = require('multer');
const AppError = require('../utils/AppError');
const { logApplicationError } = require('../utils/errorLogger');

/** Anything no route answered. */
function notFound(req, res, next) {
  next(createError(404));
}

/**
 * Upload and payload failures, translated. Without this a too-large image became a generic
 * 500 and the user was told "Noe gikk galt" with nothing to act on.
 */
function uploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'Bildet er for stort. Maks 8 MB per fil.',
      LIMIT_FILE_COUNT: 'For mange filer. Du kan laste opp inntil 6 bilder.',
      LIMIT_UNEXPECTED_FILE: 'Uventet fil i opplastingen.',
    };
    return res.status(413).json({ error: messages[err.code] || 'Kunne ikke laste opp filen.' });
  }
  if (err && err.code === 'INVALID_FILE_TYPE') return res.status(400).json({ error: err.message });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Innholdet er for stort. Prøv med færre eller mindre bilder.' });
  return next(err);
}

/** Last stop: log (best effort) and answer with the standard error envelope. */
async function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isAppErr = err instanceof AppError;
  const errorCode = isAppErr ? err.code : 'INTERNAL_SERVER_ERROR';
  const safeMessage = isAppErr ? err.message : 'Internal server error.';

  try {
    await logApplicationError({
      error: err,
      requestPath: req.path,
      httpMethod: req.method,
      httpStatus: status,
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      userId: req.user?._id || null,
      correlationId: req.requestId || req.get('x-request-id') || null,
      errorCode,
      metadata: err.details || null,
    });
  } catch (logErr) {
    console.error('Failed to log error:', logErr.message);
  }

  res.status(isAppErr ? err.statusCode : status);
  return res.json({
    success: false,
    error: { code: errorCode, referenceId: res.getHeader('X-Request-ID') || req.requestId || undefined, message: safeMessage },
  });
}

module.exports = { notFound, uploadErrors, errorHandler };
