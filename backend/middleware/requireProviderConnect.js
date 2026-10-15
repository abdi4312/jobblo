const Service = require('../models/Service');
const mongoose = require('mongoose');
const {
  getConnectReadiness,
  sendConnectReadinessFailure,
} = require('../services/stripeConnectReadiness');

exports.ensureProviderConnectReady = async (req, res, userId) => {
  const previous = req.providerConnectReadiness;
  if (previous?.userId === String(userId)) return true;
  try {
    const readiness = await getConnectReadiness(userId);
    if (!readiness.ready) {
      sendConnectReadinessFailure(res, readiness);
      return false;
    }
    if (String(userId) === String(req.userId)) {
      req.providerConnectReadiness = { userId: String(userId), readiness };
    }
    return true;
  } catch (error) {
    if (error.code === 'STRIPE_CONNECT_STATUS_UNAVAILABLE') {
      sendConnectReadinessFailure(res, error);
      return false;
    }
    if (error.code === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'Bruker ikke funnet' });
      return false;
    }
    if (error.code === 'STRIPE_CONNECT_ACCOUNT_NOT_FOUND' ||
        error.code === 'STRIPE_CONNECT_ACCOUNT_MODE_MISMATCH') {
      res.status(409).json({
        error: 'Den lagrede Stripe-kontoen ble ikke funnet i valgt modus. Kontakt kundestøtte.',
        code: error.code,
      });
      return false;
    }
    console.error('Could not verify provider Stripe Connect readiness:', error);
    res.status(500).json({ error: 'Kunne ikke kontrollere Stripe Connect-status.' });
    return false;
  }
};

exports.requireApplicantConnectReady = async (req, res, next) => {
  if (await exports.ensureProviderConnectReady(req, res, req.userId)) next();
};

exports.requireServiceApplicantConnectReady = async (req, res, next) => {
  try {
    const serviceId = req.body?.serviceId;
    if (typeof serviceId !== 'string' || !mongoose.Types.ObjectId.isValid(serviceId)) return next();
    const service = await Service.findById(serviceId).select('userId');
    if (!service || String(service.userId) === String(req.userId)) return next();
    return exports.requireApplicantConnectReady(req, res, next);
  } catch (error) {
    console.error('Could not verify applicant Stripe Connect readiness:', error);
    res.status(500).json({ error: 'Kunne ikke kontrollere Stripe Connect-status.' });
  }
};
