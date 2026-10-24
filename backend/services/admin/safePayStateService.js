const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const SafePayHistory = require('../../models/SafePayHistory');
const Chat = require('../../models/ChatMessage');
const Dispute = require('../../models/Dispute');
const { logActivity } = require('./activityService');
const { notify } = require('../../services/notifications');

/**
 * Order statuses a user-initiated dispute may be opened from.
 * Active stages (paid / in_progress) and the approval stage
 * (ready_for_review), plus post-completion. BUG-003.
 */
const DISPUTE_ELIGIBLE_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'completed'];
// Must match PROCESSING_LEASE_MS in services/payout/releasePayoutToProvider.js.
const PAYOUT_LOCK_LEASE_MS = 5 * 60 * 1000;

/**
 * Transition legality now lives in services/order/orderState.js so there is one
 * table rather than one per caller. The local copy here was missing
 * `ready_for_review` entirely, which meant this admin sync path could not move an
 * order that was sitting in it — the single most common place for an order to be
 * stuck.
 */
const {
  isValidTransition,
} = require('../order/orderState');

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
  let order = await Order.findById(orderId);
  if (!order) throw new Error('Ordre ikke funnet');

  // Only allow dispute when in eligible state (shared with admin chat-report flow)
  if (!DISPUTE_ELIGIBLE_STATUSES.includes(order.status)) {
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
  const previousOrderStatus = order.status;
  const openedAt = new Date();
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
    previousOrderStatus,
    openedAt,
    timeline: [{
      action: 'dispute_opened',
      actorId: openedByUserId,
      note: `Tvist åpnet: ${title}`,
    }],
  });

  // Claim the order before creating the dispute so a timeout refund cannot race it,
  // nor a provider transfer that releasePayoutToProvider has fenced (payoutLockId).
  // A lock older than the payout lease is abandoned and no longer blocks.
  const claimedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: previousOrderStatus,
      'providerConnectTimeout.status': {
        $nin: ['processing', 'pending', 'reconciliation_required', 'failed', 'manual_review'],
      },
      $or: [
        { payoutLockId: null },
        { payoutLockedAt: { $lte: new Date(openedAt.getTime() - PAYOUT_LOCK_LEASE_MS) } },
      ],
    },
    {
      $set: { status: 'disputed' },
      $push: {
        history: {
          action: 'dispute_opened',
          userId: openedByUserId,
          timestamp: openedAt,
          data: { disputeId: dispute._id, reason: reasonCategory },
        },
      },
    },
    { new: true }
  );
  if (!claimedOrder) {
    throw new Error('Ordren er under refusjons- eller utbetalingsbehandling eller har endret status. Prøv igjen om litt.');
  }
  order = claimedOrder;
  try {
    await dispute.save();
  } catch (error) {
    await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: 'disputed',
        'history.data.disputeId': dispute._id,
      },
      {
        $set: { status: previousOrderStatus },
        $pull: { history: { 'data.disputeId': dispute._id } },
      }
    );
    throw error;
  }

  // Update payment status
  if (payment) {
    payment.status = 'disputed';
    await payment.save();
  }

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
      notify({
        userId: openedAgainst,
        type: 'alert',
        content: `Det er åpnet en tvist på oppdraget "${title}".`,
        orderId,
        senderId: openedByUserId,
        event: 'dispute_opened',
        payload: { orderId: String(orderId) },
      }),
      notify({
        userId: order.customerId,
        type: 'alert',
        content: 'Tvist åpnet. Support er varslet og tar kontakt.',
        orderId,
        event: 'dispute_opened',
        payload: { orderId: String(orderId) },
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

module.exports = { openDispute, isValidTransition, DISPUTE_ELIGIBLE_STATUSES };
