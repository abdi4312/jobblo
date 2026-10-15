const { getStripeWebhookReadiness } = require('../../services/stripe/webhookReadiness');

exports.getWebhookReadiness = async (_req, res) => {
  const readiness = await getStripeWebhookReadiness();
  res.status(readiness.status === 'configuration_unavailable' ? 503 : 200).json(readiness);
};
