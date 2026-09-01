const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');
const Notification = require('../../models/Notification');
const { logApplicationError } = require('../../utils/errorLogger');
const { notify } = require('../../services/notifications');

/**
 * The lifecycle automation the product design already assumed existed.
 *
 * There was no scheduler in this codebase at all — no cron, no queue, not even a
 * setInterval. A comment in the old payout service referred to "the system-cron"
 * that would retry failed payouts; it was never built. The consequences were all
 * money-shaped: a customer who stopped responding left the provider's payment frozen
 * in `ready_for_review` forever, a failed transfer waited for someone to notice by
 * hand, and abandoned checkouts accumulated with no cleanup.
 *
 * Every job here must be safe to run twice. They are all either compare-and-swap
 * updates or calls into services that are already idempotent, so a double run cannot
 * double-pay, double-refund or double-complete.
 */

/** Business timings, configurable rather than scattered as literals. */
function config() {
  return {
    // How long a customer has to review before the money is released to the provider.
    autoReleaseDays: Number(process.env.SAFEPAY_AUTO_RELEASE_DAYS || 14),
    // A warning goes out this many days before the auto-release.
    warnBeforeDays: Number(process.env.SAFEPAY_AUTO_RELEASE_WARN_DAYS || 3),
    // Checkout sessions Stripe will never complete.
    abandonedOrderHours: Number(process.env.SAFEPAY_ABANDONED_ORDER_HOURS || 72),
  };
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * Orders the customer never got round to approving.
 *
 * Releases to the provider after the review window. This is the single most
 * important job here: without it a provider's only recourse against an unresponsive
 * customer is to open a dispute and wait for a human, which does not scale.
 *
 * Idempotent because releasePayoutToProvider is keyed on `payout_order_<orderId>`
 * and the status move is a compare-and-swap out of `ready_for_review`.
 */
async function autoReleaseStaleReviews() {
  const { autoReleaseDays } = config();
  const cutoff = daysAgo(autoReleaseDays);
  const releasePayoutToProvider = require('../payout/releasePayoutToProvider');

  const candidates = await Order.find({
    status: 'ready_for_review',
    readyForReviewAt: { $lte: cutoff },
  })
    .select('_id customerId providerId serviceId agreedPrice chatId')
    .limit(50)
    .lean();

  let released = 0;

  for (const order of candidates) {
    try {
      // Never move money on a disputed order.
      const dispute = await Dispute.findOne({
        orderId: order._id,
        status: { $nin: ['resolved', 'closed', 'cancelled'] },
      }).select('_id');
      if (dispute) continue;

      const payment = await Payment.findOne({ orderId: order._id });
      if (!payment || payment.status !== 'completed') continue;

      const gross = order.agreedPrice || 0;
      if (gross <= 0) continue;
      const fee = Math.round(gross * 0.03);

      await releasePayoutToProvider({
        orderId: order._id,
        providerId: order.providerId,
        customerId: order.customerId,
        serviceId: order.serviceId,
        grossAmount: gross,
        platformFee: fee,
        releaseSource: 'admin_override',
        releasedBy: null,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        stripeCheckoutSessionId: payment.stripeSessionId,
      });

      // Only now is completion money-safe.
      const moved = await Order.findOneAndUpdate(
        { _id: order._id, status: 'ready_for_review' },
        {
          $set: { status: 'completed' },
          $push: {
            history: {
              action: 'auto_released',
              userId: null,
              timestamp: new Date(),
              data: { reason: `Automatisk frigitt etter ${autoReleaseDays} dager uten svar` },
            },
          },
        },
        { new: true }
      );

      if (moved) {
        payment.status = 'released';
        await payment.save();
        released += 1;
        await notify({
          userId: order.customerId,
          type: 'payment',
          content: `Oppdraget ble automatisk godkjent etter ${autoReleaseDays} dager, og betalingen er utbetalt.`,
          orderId: order._id,
          event: 'order_completed',
          payload: { orderId: String(order._id), automatic: true },
        });
        await notify({
          userId: order.providerId,
          type: 'payment',
          content: 'Betalingen din er frigitt automatisk.',
          orderId: order._id,
          event: 'payout_sent',
          payload: { orderId: String(order._id), automatic: true },
        });
      }
    } catch (err) {
      await logApplicationError({
        error: err,
        requestPath: 'scheduler/autoReleaseStaleReviews',
        httpMethod: 'POST',
        httpStatus: 500,
        errorCode: 'AUTO_RELEASE_FAILED',
        source: 'scheduler',
        metadata: { orderId: String(order._id) },
      });
    }
  }

  return { scanned: candidates.length, released };
}

/** Tell the customer before the window closes, so auto-release is never a surprise. */
async function warnBeforeAutoRelease() {
  const { autoReleaseDays, warnBeforeDays } = config();
  const warnAfter = daysAgo(Math.max(autoReleaseDays - warnBeforeDays, 0));

  const candidates = await Order.find({
    status: 'ready_for_review',
    readyForReviewAt: { $lte: warnAfter },
    autoReleaseWarnedAt: null,
  })
    .select('_id customerId')
    .limit(100);

  let warned = 0;
  for (const order of candidates) {
    // CAS on the warn marker, so a second run cannot send a second warning.
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, autoReleaseWarnedAt: null },
      { $set: { autoReleaseWarnedAt: new Date() } }
    );
    if (!claimed) continue;

    await notify({
      userId: order.customerId,
      type: 'order',
      content: `Du har ${warnBeforeDays} dager på deg til å godkjenne oppdraget. Etter det frigis betalingen automatisk.`,
      orderId: order._id,
    });
    warned += 1;
  }

  return { warned };
}

/**
 * Transfers that failed. releasePayoutToProvider already refuses to create a second
 * transfer for an order, so retrying is safe.
 */
async function retryFailedPayouts() {
  const releasePayoutToProvider = require('../payout/releasePayoutToProvider');

  const failed = await Payout.find({ status: 'failed' })
    .select('orderId providerId customerId serviceId grossAmount platformFee')
    .limit(25)
    .lean();

  let retried = 0;
  for (const payout of failed) {
    try {
      const payment = await Payment.findOne({ orderId: payout.orderId });
      await releasePayoutToProvider({
        orderId: payout.orderId,
        providerId: payout.providerId,
        customerId: payout.customerId,
        serviceId: payout.serviceId,
        grossAmount: payout.grossAmount,
        platformFee: payout.platformFee,
        releaseSource: 'admin_override',
        releasedBy: null,
        stripePaymentIntentId: payment?.stripePaymentIntentId,
        stripeCheckoutSessionId: payment?.stripeSessionId,
      });
      retried += 1;
    } catch (err) {
      // Expected for a provider who still has not finished Connect onboarding —
      // logged, not escalated, so it does not drown the error log.
      console.error('retryFailedPayouts: order %s still failing: %s', payout.orderId, err.message);
    }
  }

  return { scanned: failed.length, retried };
}

/**
 * Checkout sessions that were started and never paid. Frees the listing so the owner
 * can award it again — before this, an abandoned contract blocked the job.
 */
async function cleanupAbandonedOrders() {
  const Service = require('../../models/Service');
  const JobRequest = require('../../models/JobRequest');
  const { abandonedOrderHours } = config();
  const cutoff = new Date(Date.now() - abandonedOrderHours * 60 * 60 * 1000);

  const abandoned = await Order.find({
    status: 'awaiting_payment',
    paymentStatus: { $ne: 'paid' },
    createdAt: { $lte: cutoff },
  })
    .select('_id serviceId providerId chatId')
    .limit(100)
    .lean();

  let cancelled = 0;
  let reopened = 0;

  for (const order of abandoned) {
    // CAS so a payment landing right now cannot be cancelled out from under itself.
    const moved = await Order.findOneAndUpdate(
      { _id: order._id, status: 'awaiting_payment', paymentStatus: { $ne: 'paid' } },
      {
        $set: { status: 'cancelled' },
        $push: {
          history: {
            action: 'auto_cancelled',
            userId: null,
            timestamp: new Date(),
            data: { reason: `Ikke betalt innen ${abandonedOrderHours} timer` },
          },
        },
      }
    );
    if (!moved) continue;
    cancelled += 1;

    // Keep the conversation's badge honest. `cancelled` is in the Chat status enum but
    // nothing ever set it, so a chat for a dead contract kept reading "Kontrakt signert".
    if (moved.chatId) {
      const Chat = require('../../models/ChatMessage');
      await Chat.updateOne({ _id: moved.chatId }, { $set: { status: 'cancelled' } }).catch(
        (err) => console.error('cleanupAbandonedOrders: chat status sync failed: %s', err.message)
      );
    }

    // Put the listing back on the market.
    //
    // Awarding sets Service.status to 'awaiting_payment', and NOTHING in the codebase
    // ever set it back to 'open' — the update whitelist deliberately excludes status.
    // So an award the customer never paid for removed the job from search permanently,
    // with no owner-facing way to recover it. Only reopen when no other live order
    // holds the service.
    const stillHeld = await Order.findOne({
      serviceId: order.serviceId,
      status: { $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'disputed'] },
    }).select('_id');

    if (!stillHeld) {
      const service = await Service.findOneAndUpdate(
        { _id: order.serviceId, status: 'awaiting_payment' },
        { $set: { status: 'open' } }
      );
      if (service) {
        reopened += 1;
        // The applicants auto-declined by that award get their applications back, so
        // the owner can pick someone else instead of reposting from scratch.
        await JobRequest.updateMany(
          { serviceId: order.serviceId, status: { $in: ['declined', 'accepted'] } },
          { $set: { status: 'pending' } }
        );
      }
    }
  }

  return { cancelled, reopened };
}

/**
 * The safety net: find orders that reached a terminal state while still holding
 * money, and disputes whose money movement never finished.
 *
 * Reports rather than repairs — an automated fix here could compound a mistake.
 * Everything it finds goes to the admin error log.
 */
async function reconcileMoneyState() {
  const terminalWithMoney = await Order.find({
    status: { $in: ['completed', 'cancelled'] },
    paymentStatus: 'paid',
  })
    .select('_id status')
    .limit(200)
    .lean();

  const problems = [];

  for (const order of terminalWithMoney) {
    const [payment, payout] = await Promise.all([
      Payment.findOne({ orderId: order._id }).select('status').lean(),
      Payout.findOne({ orderId: order._id }).select('status').lean(),
    ]);

    if (!payment) continue;
    if (['refunded', 'released'].includes(payment.status)) continue;
    if (payout && ['released_internal', 'processing', 'transferred'].includes(payout.status)) {
      continue;
    }

    problems.push({ orderId: String(order._id), orderStatus: order.status, paymentStatus: payment.status });
  }

  const stuckDisputes = await Dispute.find({ 'resolution.moneyState': { $in: ['pending', 'failed'] } })
    .select('_id orderId resolution.outcome resolution.moneyState')
    .limit(50)
    .lean();

  if (problems.length > 0 || stuckDisputes.length > 0) {
    await logApplicationError({
      error: new Error(
        `Reconciliation found ${problems.length} terminal order(s) with unsettled money and ${stuckDisputes.length} dispute(s) with unfinished money movement`
      ),
      requestPath: 'scheduler/reconcileMoneyState',
      httpMethod: 'POST',
      httpStatus: 500,
      errorCode: 'MONEY_RECONCILIATION_MISMATCH',
      source: 'scheduler',
      metadata: {
        orders: problems.slice(0, 25),
        disputes: stuckDisputes.slice(0, 25).map((d) => ({
          disputeId: String(d._id),
          orderId: String(d.orderId),
          outcome: d.resolution?.outcome,
          moneyState: d.resolution?.moneyState,
        })),
      },
    });
  }

  return { unsettledOrders: problems.length, stuckDisputes: stuckDisputes.length };
}

module.exports = {
  autoReleaseStaleReviews,
  warnBeforeAutoRelease,
  retryFailedPayouts,
  cleanupAbandonedOrders,
  reconcileMoneyState,
  config,
};
