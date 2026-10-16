module.exports = (_req, res) =>
  res.status(503).json({
    code: 'SUBSCRIPTION_REBUILD_IN_PROGRESS',
    message: 'Subscription functionality is temporarily unavailable.',
  });
