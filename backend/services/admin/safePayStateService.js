const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const SafePayHistory = require('../../models/SafePayHistory');
const Chat = require('../../models/ChatMessage');
const Dispute = require('../../models/Dispute');
const Notification = require('../../models/Notification');
const { logActivity } = require('./activityService');

/**
 * Allowed Order status transitions.
 * Key: current status → Value: array of permitted next statuses
 */
const ORDER_TRANSITIONS = {
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['in_progress', 'cancelled', 'disputed'],
  in_progress: ['completed', 'cancelled', 'disputed'],
  completed: ['disputed'],          // post-completion dispute allowed
  disputed: ['in_progress', 'completed', 'cancelled'],
  cancelled: [],
  declined: [],
};

/**
 * Validate whether a transition is allowed.
 */
function isValidTransition(current, next) {
  return (ORDER_TRANSITIONS[current] || []).includes(next);
}

/**
 * Synchronize all related models when an order status changes.
 * Uses MongoDB session for atomicity.
 *
 * @param {object} options
 * @param {string} options.orderId
 * @param {string} options.newOrderStatus
 * @param {string} options.adminId - ID of the acting admin
 * @param {string} options.reason - Human-readable reason
 * @param {string} options.ip
 * @param {string} options.userAgent
 */
/**
 * Synchronize all related models when an order status changes.
 * Sequential writes (no transactions) — works on standalone MongoDB.
 */
async function syncSafePayStatus({ orderId, newOrderStatus, adminId, reason, ip, userAgent }) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Ordre ikke funnet');

  if (!isValidTransition(order.status, newOrderStatus)) {
    throw new Error(`Ugyldig statusovergang: ${order.status} → ${newOrderStatus}`);
  }

  const prev = order.status;
  order.status = newOrderStatus;
  order.history.push({
    action: `admin_status_change`,
    userId: adminId,
    timestamp: new Date(),
    data: { from: prev, to: newOrderStatus, reason },
  });
  await order.save();

  // Synchronize Payment status
  const paymentStatusMap = {
    paid: 'completed',
    in_progress: 'completed',
    disputed: 'disputed',
    completed: 'released',
    cancelled: 'pending',
  };
  if (paymentStatusMap[newOrderStatus]) {
    await Payment.findOneAndUpdate({ orderId }, { status: paymentStatusMap[newOrderStatus] });
  }

  // Synchronize Chat status
  if (order.chatId) {
    const chatStatusMap = {
      paid: 'paid',
      in_progress: 'in_progress',
      disputed: 'disputed',
      completed: 'completed',
      cancelled: 'cancelled',
    };
    if (chatStatusMap[newOrderStatus]) {
      await Chat.findByIdAndUpdate(order.chatId, { status: chatStatusMap[newOrderStatus] });
    }
  }

  // Synchronize SafePayHistory
  const historyStatusMap = {
    disputed: 'disputed',
    completed: 'completed',
    cancelled: 'cancelled',
  };
  if (historyStatusMap[newOrderStatus]) {
    await SafePayHistory.findOneAndUpdate({ orderId }, { status: historyStatusMap[newOrderStatus] });
  }

  await logActivity({
    adminId,
    action: 'order_updated',
    targetModel: 'Order',
    targetId: orderId,
    description: `SafePay status synkronisert: ${prev} → ${newOrderStatus}. Årsak: ${reason}`,
    ip,
    userAgent,
  });

  return { success: true, prevStatus: prev, newStatus: newOrderStatus };
}

/**
 * Open a dispute for a SafePay contract.
 * Note: Uses sequential writes (no MongoDB transactions) so this works on
 * standalone MongoDB instances. In production with a replica set the writes
 * are still consistent because the dispute is created first; downstream
 * updates are idempotent and can be retried if they fail.
 */
async function openDispute({
  orderId,
  openedByUserId,
  openedByRole,
  reasonCategory,
  title,
  description,
  adminId,
  ip,
  userAgent,
}) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Ordre ikke funnet');

  // Only allow dispute when in eligible state
  const ELIGIBLE = ['paid', 'in_progress', 'completed'];
  if (!ELIGIBLE.includes(order.status)) {
    throw new Error(`Tvist kan ikke åpnes for ordre med status: ${order.status}`);
  }

  // Prevent duplicate active dispute
  const existing = await Dispute.findOne({
    orderId,
    status: { $in: ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'] },
  });
  if (existing) throw new Error('Det finnes allerede en aktiv tvist for denne ordren');

  const openedAgainst =
    String(order.customerId) === String(openedByUserId) ? order.providerId : order.customerId;

  // Link payment if exists
  const payment = await Payment.findOne({ orderId });

  // Create dispute
  const dispute = new Dispute({
    orderId,
    chatId: order.chatId,
    serviceId: order.serviceId,
    paymentId: payment?._id ?? null,
    openedBy: openedByUserId,
    openedAgainst,
    openedByRole,
    reasonCategory,
    title,
    description,
    status: 'open',
    payoutFrozen: true,
    openedAt: new Date(),
    timeline: [{
      action: 'dispute_opened',
      actorId: openedByUserId,
      note: `Tvist åpnet: ${title}`,
    }],
  });
  await dispute.save();

  // Update payment status
  if (payment) {
    payment.status = 'disputed';
    await payment.save();
  }

  // Update order
  order.status = 'disputed';
  order.history.push({
    action: 'dispute_opened',
    userId: openedByUserId,
    timestamp: new Date(),
    data: { disputeId: dispute._id, reason: reasonCategory },
  });
  await order.save();

  // Update chat
  if (order.chatId) {
    await Chat.findByIdAndUpdate(order.chatId, {
      status: 'disputed',
      $push: {
        messages: {
          type: 'system_status',
          systemData: { disputeId: dispute._id, orderId },
          text: `Tvist åpnet: ${title}`,
          createdAt: new Date(),
        },
      },
    });
  }

  // Update SafePayHistory
  await SafePayHistory.findOneAndUpdate({ orderId }, { status: 'disputed' });

  // Notifications (failure should not fail the main operation)
  try {
    await Promise.all([
      Notification.create({
        userId: openedAgainst,
        type: 'order',
        content: `En tvist er åpnet for oppdrag. Tittel: ${title}`,
        orderId,
        senderId: openedByUserId,
      }),
      Notification.create({
        userId: order.customerId,
        type: 'system',
        content: `Tvist åpnet for kontrakt. Admin er varslet.`,
        orderId,
      }),
    ]);
  } catch {
    // Notification failure does not fail the main operation
  }

  await logActivity({
    adminId: openedByUserId,
    action: 'other',
    targetModel: 'Order',
    targetId: orderId,
    description: `Tvist åpnet av ${openedByRole}: ${title}`,
    ip,
    userAgent,
  });

  return dispute;
}

module.exports = { syncSafePayStatus, openDispute, isValidTransition };
