const { randomUUID } = require('crypto');

module.exports = (req, res, next) => {
  const id = req.get('x-request-id') || `REQ-${randomUUID().split('-')[0].toUpperCase()}`;
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};
