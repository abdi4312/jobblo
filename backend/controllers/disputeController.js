const mongoose = require('mongoose');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const { openDispute } = require('../services/admin/safePayStateService');

/**
 * POST /api/safepay/contract/:orderId/dispute
 * Allow customer or provider to open a dispute.
 */
exports.openDisputeByUser = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Ugyldig ordre-ID.' });
    }

    const { reasonCategory, title, description } = req.body;

    if (!reasonCategory || !title?.trim() || !description?.trim()) {
      return res.status(400).json({ success: false, message: 'Kategori, tittel og beskrivelse er påkrevd.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Kontrakt ikke funnet.' });

    const isCustomer = String(order.customerId) === String(userId);
    const isProvider = String(order.providerId) === String(userId);

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ success: false, message: 'Ikke autorisert.' });
    }

    const dispute = await openDispute({
      orderId,
      openedByUserId: userId,
      openedByRole: isCustomer ? 'customer' : 'provider',
      reasonCategory,
      title: title.trim(),
      description: description.trim(),
      adminId: userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({ success: true, message: 'Tvist åpnet.', disputeId: dispute._id });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Serverfeil.' });
  }
};

/**
 * GET /api/safepay/contract/:orderId/dispute
 * Get dispute for an order (only participants can view).
 */
exports.getDisputeByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Ugyldig ordre-ID.' });
    }

    const order = await Order.findById(orderId).select('customerId providerId').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Kontrakt ikke funnet.' });

    const isParticipant = String(order.customerId) === String(userId) || String(order.providerId) === String(userId);
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Ikke autorisert.' });

    const dispute = await Dispute.findOne({ orderId })
      .select('-messages.isInternal') // Never expose internal notes to users
      .lean();

    if (!dispute) return res.status(404).json({ success: false, message: 'Ingen tvist funnet.' });

    // Filter out internal messages
    if (dispute.messages) {
      dispute.messages = dispute.messages.filter((m) => !m.isInternal);
    }

    return res.json({ success: true, dispute });
  } catch {
    return res.status(500).json({ success: false, message: 'Serverfeil.' });
  }
};

/**
 * POST /api/safepay/disputes/:disputeId/message
 * User adds a message to the dispute.
 */
exports.addUserDisputeMessage = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const userId = req.userId;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(disputeId)) {
      return res.status(400).json({ success: false, message: 'Ugyldig tvist-ID.' });
    }
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Melding er påkrevd.' });

    const dispute = await Dispute.findById(disputeId).populate('orderId', 'customerId providerId');
    if (!dispute) return res.status(404).json({ success: false, message: 'Tvist ikke funnet.' });

    const order = dispute.orderId;
    const isCustomer = String(order.customerId) === String(userId);
    const isProvider = String(order.providerId) === String(userId);
    if (!isCustomer && !isProvider) return res.status(403).json({ success: false, message: 'Ikke autorisert.' });

    const ACTIVE = ['open','under_review','waiting_for_customer','waiting_for_provider','evidence_submitted'];
    if (!ACTIVE.includes(dispute.status)) {
      return res.status(400).json({ success: false, message: 'Tvisten er avsluttet.' });
    }

    dispute.messages.push({
      senderId: userId,
      senderRole: isCustomer ? 'customer' : 'provider',
      message: message.trim(),
      isInternal: false,
    });

    if (dispute.status === 'waiting_for_customer' && isCustomer) {
      dispute.status = 'evidence_submitted';
    } else if (dispute.status === 'waiting_for_provider' && isProvider) {
      dispute.status = 'evidence_submitted';
    }

    await dispute.save();
    return res.json({ success: true, message: 'Melding sendt.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Serverfeil.' });
  }
};
