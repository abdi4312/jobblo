/**
 * Provider Work Controller
 * Provider-specific order actions: view, start, checklist, evidence, ready-for-review, reconcile.
 */
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Dispute = require('../models/Dispute');
const Chat = require('../models/ChatMessage');
// stripe is lazily initialized only when needed (reconcile endpoint)

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

async function hasActiveDispute(orderId) {
  const d = await Dispute.findOne({ orderId, status: { $nin: ['resolved', 'closed', 'cancelled'] } });
  return !!d;
}

// GET /api/safepay/orders/:orderId
exports.getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Ugyldig orderId' });
    const order = await Order.findById(orderId)
      .populate('serviceId', 'title description location price checklist fromDate')
      .populate('customerId', 'name lastName avatarUrl averageRating')
      .populate('providerId', 'name lastName avatarUrl averageRating completedJobs');
    if (!order) return res.status(404).json({ error: 'Ordre ikke funnet' });
    const isCustomer = String(order.customerId._id) === String(req.userId);
    const isProvider = String(order.providerId?._id) === String(req.userId);
    if (!isCustomer && !isProvider) return res.status(403).json({ error: 'Ikke autorisert' });
    const fee = Math.round((order.agreedPrice || 0) * 0.03);
    const calculation = { basePrice: order.agreedPrice, fee, total: (order.agreedPrice || 0) + fee, providerNet: (order.agreedPrice || 0) - fee };
    const dispute = await Dispute.findOne({ orderId, status: { $nin: ['resolved', 'closed', 'cancelled'] } }).select('status reasonCategory title openedAt');
    res.json({ order, calculation, isCustomer, isProvider, activeDispute: dispute || null });
  } catch (err) { res.status(500).json({ error: 'Serverfeil' }); }
};

// POST /api/safepay/orders/:orderId/start
exports.startJob = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Ugyldig orderId' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Ordre ikke funnet' });
    if (String(order.providerId) !== String(userId)) return res.status(403).json({ error: 'Kun utfører kan starte jobben' });
    if (order.status === 'in_progress') return res.json({ message: 'Allerede startet', order });
    if (order.paymentStatus !== 'paid') return res.status(400).json({ error: 'Betaling må bekreftes først' });
    if (await hasActiveDispute(orderId)) return res.status(400).json({ error: 'Aktiv tvist' });
    if (order.status !== 'paid') return res.status(409).json({ error: `Ugyldig statusovergang: ${order.status} → in_progress` });
    const now = new Date();
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, status: 'paid' },
      { $set: { status: 'in_progress', startedAt: now }, $push: { history: { action: 'job_started', userId, timestamp: now, data: { message: 'Utfører startet oppdraget' } } } },
      { new: true }
    );
    if (!updated) return res.json({ message: 'Allerede startet', order });
    if (updated.chatId) {
      const chat = await Chat.findById(updated.chatId);
      if (chat) { chat.status = 'in_progress'; chat.messages.push({ type: 'system_status', systemData: { event: 'job_started', orderId: updated._id }, text: 'Utfører har startet oppdraget', createdAt: now }); await chat.save(); }
    }
    const notif = await Notification.create({ userId: updated.customerId, type: 'order', content: 'Utfører har startet oppdraget!', orderId: updated._id, senderId: userId });
    const io = req.app.get('io');
    if (io) { io.to(`user_${updated.customerId}`).emit('new_notification', notif); io.to(`user_${updated.customerId}`).emit('order_status_changed', { orderId: updated._id, status: 'in_progress' }); }
    res.json({ message: 'Oppdrag startet', order: updated });
  } catch (err) { res.status(500).json({ error: 'Serverfeil ved start av oppdrag' }); }
};

// PATCH /api/safepay/orders/:orderId/provider-checklist/:itemId
exports.updateProviderChecklist = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { providerCompleted } = req.body;
    const userId = req.userId;
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Ugyldig orderId' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Ordre ikke funnet' });
    if (String(order.providerId) !== String(userId)) return res.status(403).json({ error: 'Kun utfører' });
    if (!['paid', 'in_progress', 'ready_for_review'].includes(order.status)) return res.status(400).json({ error: 'Ugyldig status' });
    const idx = order.checklist.findIndex((i) => i.id === itemId);
    if (idx === -1) return res.status(404).json({ error: 'Element ikke funnet' });
    if (order.checklist[idx].providerCompleted === Boolean(providerCompleted)) return res.json({ message: 'Ingen endring', order });
    const now = new Date();
    const upd = { [`checklist.${idx}.providerCompleted`]: Boolean(providerCompleted), [`checklist.${idx}.providerCompletedAt`]: providerCompleted ? now : null, [`checklist.${idx}.providerCompletedBy`]: providerCompleted ? userId : null, [`checklist.${idx}.checked`]: Boolean(providerCompleted) };
    const updated = await Order.findByIdAndUpdate(orderId, { $set: upd }, { new: true });
    res.json({ message: 'Sjekkliste oppdatert', order: updated });
  } catch (err) { res.status(500).json({ error: 'Serverfeil' }); }
};

// PATCH /api/safepay/orders/:orderId/customer-checklist/:itemId
exports.updateCustomerChecklist = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { customerConfirmed } = req.body;
    const userId = req.userId;
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Ugyldig orderId' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Ordre ikke funnet' });
    if (String(order.customerId) !== String(userId)) return res.status(403).json({ error: 'Kun oppdragsgiver' });
    if (!['ready_for_review', 'in_progress'].includes(order.status)) return res.status(400).json({ error: 'Ugyldig status' });
    const idx = order.checklist.findIndex((i) => i.id === itemId);
    if (idx === -1) return res.status(404).json({ error: 'Element ikke funnet' });
    if (order.checklist[idx].customerConfirmed === Boolean(customerConfirmed)) return res.json({ message: 'Ingen endring', order });
    const now = new Date();
    const upd = { [`checklist.${idx}.customerConfirmed`]: Boolean(customerConfirmed), [`checklist.${idx}.customerConfirmedAt`]: customerConfirmed ? now : null, [`checklist.${idx}.customerConfirmedBy`]: customerConfirmed ? userId : null };
    const updated = await Order.findByIdAndUpdate(orderId, { $set: upd }, { new: true });
    res.json({ message: 'Sjekkliste bekreftet', order: updated });
  } catch (err) { res.status(500).json({ error: 'Serverfeil' }); }
};

// POST /api/safepay/orders/:orderId/evidence
exports.uploadEvidence = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { completionNote, evidenceType = 'after' } = req.body;
    const userId = req.userId;
    const files = req.files || [];
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Ugyldig orderId' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Ordre ikke funnet' });
    if (String(order.providerId) !== String(userId)) return res.status(403).json({ error: 'Kun utfører' });
    if (!['paid', 'in_progress'].includes(order.status)) return res.status(400).json({ error: 'Ugyldig ordrestatus' });
    if (!files.length && !completionNote) return res.status(400).json({ error: 'Minst én fil eller notat kreves' });
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    for (const f of files) {
      if (!ALLOWED.includes(f.mimetype)) return res.status(400).json({ error: `Ugyldig filtype: ${f.mimetype}` });
      if (f.size > 10 * 1024 * 1024) return res.status(400).json({ error: `Fil for stor: ${f.originalname}` });
    }
    const cloudinary = require('../config/cloudinary');
    const urls = [];
    for (const file of files) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: `jobblo/orders/${orderId}/evidence`, resource_type: 'auto' }, (err, r) => (err ? reject(err) : resolve(r)));
        stream.end(file.buffer);
      });
      urls.push(result.secure_url);
    }
    const arrayField = evidenceType === 'before' ? 'beforeImages' : 'afterImages';
    const upd = { $push: { [arrayField]: { $each: urls }, history: { action: 'evidence_uploaded', userId, timestamp: new Date(), data: { count: urls.length, evidenceType } } } };
    if (completionNote) upd.$set = { completionNote };
    const updated = await Order.findByIdAndUpdate(orderId, upd, { new: true });
    if (order.chatId && urls.length > 0) {
      const chat = await Chat.findById(order.chatId);
      if (chat) { chat.messages.push({ type: 'system_status', systemData: { event: 'evidence_uploaded', orderId: order._id, count: urls.length }, text: `Utfører lastet opp ${urls.length} bilde(r)`, createdAt: new Date() }); await chat.save(); }
    }
    res.json({ message: 'Bevis lastet opp', urls, order: updated });
  } catch (err) { res.status(500).json({ error: 'Serverfeil ved opplasting' }); }
};

// POST /api/safepay/orders/:orderId/ready-for-review
exports.markReadyForReview = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Ugyldig orderId' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Ordre ikke funnet' });
    if (String(order.providerId) !== String(userId)) return res.status(403).json({ error: 'Kun utfører' });
    if (order.status === 'ready_for_review') return res.json({ message: 'Allerede klar', order });
    if (order.paymentStatus !== 'paid') return res.status(400).json({ error: 'Betaling ikke bekreftet' });
    if (await hasActiveDispute(orderId)) return res.status(400).json({ error: 'Aktiv tvist' });
    if (order.status !== 'in_progress') return res.status(409).json({ error: `Ugyldig statusovergang: ${order.status} → ready_for_review` });
    const now = new Date();
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, status: 'in_progress' },
      { $set: { status: 'ready_for_review', readyForReviewAt: now }, $push: { history: { action: 'ready_for_review', userId, timestamp: now, data: { message: 'Jobb meldt ferdig' } } } },
      { new: true }
    );
    if (!updated) return res.json({ message: 'Allerede klar', order });
    if (updated.chatId) {
      const chat = await Chat.findById(updated.chatId);
      if (chat) { chat.messages.push({ type: 'system_status', systemData: { event: 'ready_for_review', orderId: updated._id }, text: 'Utfører melder jobben som ferdig', createdAt: now }); await chat.save(); }
    }
    const notif = await Notification.create({ userId: updated.customerId, type: 'order', content: 'Utfører har levert jobben. Vennligst gjennomgå og godkjenn.', orderId: updated._id, senderId: userId });
    const io = req.app.get('io');
    if (io) { io.to(`user_${updated.customerId}`).emit('new_notification', notif); io.to(`user_${updated.customerId}`).emit('order_ready_for_review', { orderId: updated._id }); }
    res.json({ message: 'Klar for gjennomgang', order: updated });
  } catch (err) { res.status(500).json({ error: 'Serverfeil' }); }
};

// POST /api/safepay/orders/:orderId/reconcile-payment
exports.reconcilePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Ugyldig orderId' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Ordre ikke funnet' });
    if (String(order.customerId) !== String(userId)) return res.status(403).json({ error: 'Kun oppdragsgiver kan verifisere betaling' });
    if (['paid', 'in_progress', 'ready_for_review', 'completed'].includes(order.status)) {
      const payment = await Payment.findOne({ orderId });
      return res.json({ status: 'already_paid', order, payment });
    }
    if (!order.checkoutSessionId) return res.status(400).json({ status: 'no_session', message: 'Ingen betalingssesjon funnet' });

    // Lazy stripe initialization
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    let session;
    try { session = await stripe.checkout.sessions.retrieve(order.checkoutSessionId); }
    catch (e) { return res.status(503).json({ status: 'stripe_unavailable', message: 'Stripe ikke tilgjengelig' }); }
    if (session.metadata?.orderId !== String(orderId)) return res.status(400).json({ status: 'session_mismatch' });
    if (session.payment_status !== 'paid') return res.json({ status: 'not_paid', payment_status: session.payment_status });
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, status: { $in: ['awaiting_payment', 'pending'] } },
      { $set: { status: 'paid', paymentStatus: 'paid', paymentConfirmedAt: new Date(), checkoutSessionId: session.id, checkoutSessionStatus: 'complete', paymentIntentId: session.payment_intent }, $push: { history: { action: 'payment_confirmed', userId: null, timestamp: new Date(), data: { stripeSessionId: session.id } } } },
      { new: true }
    );
    let payment;
    try { payment = await Payment.create({ orderId, chatId: order.chatId, status: 'completed', amount: order.agreedPrice, stripeSessionId: session.id, stripePaymentIntentId: session.payment_intent }); }
    catch (e) { if (e.code === 11000) payment = await Payment.findOne({ orderId }); else throw e; }
    const io = req.app.get('io');
    if (io) { io.to(`user_${order.providerId}`).emit('payment_confirmed', { orderId }); io.to(`user_${order.customerId}`).emit('payment_confirmed', { orderId }); }
    res.json({ status: 'confirmed', order: updated || order, payment });
  } catch (err) { res.status(500).json({ error: 'Serverfeil', status: 'error' }); }
};
