const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const Dispute = require('../../models/Dispute');

/**
 * The one place that says which order transitions are legal, and the one place
 * that enforces the money invariant on terminal states.
 *
 * Order.status used to be written from seventeen call sites across seven files,
 * against four different ideas of what was legal. Five of those writes used a
 * proper compare-and-swap; one consulted a shared table; the rest just assigned.
 * The damage was not theoretical: a generic PATCH declared `paid → completed`
 * legal and authorised either party, so a provider could complete their own paid
 * order, skip the payout release, and strand the customer's escrowed money where
 * no code path could reach it.
 *
 * Two rules live here:
 *
 *   1. A transition must appear in ORDER_TRANSITIONS.
 *   2. An order carrying captured money may not reach a terminal state unless that
 *      money has a recorded destination — a payout, a refund, or a dispute
 *      resolution. "Terminal order + successful payment + nothing moved" must be
 *      unreachable.
 */

/**
 * Complete transition table. `ready_for_review` was missing entirely from the
 * previous version — it appeared neither as a key nor as a value — so an order
 * sitting there could not be moved by the admin sync path at all, and nothing
 * could legally return to it after a dispute.
 */
const ORDER_TRANSITIONS = {
  pending: ['accepted', 'declined', 'awaiting_payment', 'cancelled'],
  accepted: ['awaiting_payment', 'paid', 'cancelled'],
  declined: [],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['in_progress', 'disputed', 'cancelled'],
  in_progress: ['ready_for_review', 'completed', 'disputed', 'cancelled'],
  ready_for_review: ['completed', 'in_progress', 'disputed', 'cancelled'],
  completed: ['disputed'], // post-completion dispute stays allowed
  disputed: ['in_progress', 'ready_for_review', 'completed', 'cancelled'],
  cancelled: [],
};

/** States from which money has been captured and not yet resolved. */
const MONEY_HELD_ORDER_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'disputed'];

/** States that end the order's life. Both must account for held money. */
const TERMINAL_STATUSES = ['completed', 'cancelled'];

/** Payout states that mean the provider's money is on its way or has arrived. */
const PAYOUT_SETTLED_STATUSES = ['released_internal', 'processing', 'transferred'];

function isValidTransition(current, next) {
  return (ORDER_TRANSITIONS[current] || []).includes(next);
}

class OrderTransitionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'OrderTransitionError';
    this.code = code;
    this.statusCode = 400;
  }
}

/**
 * Does this order still have captured money with nowhere recorded to go?
 *
 * Reads the Payment rather than the order's own flags, because the Payment is what
 * the Stripe charge actually produced.
 */
async function hasUnresolvedMoney(order) {
  if (order.paymentStatus !== 'paid' && !MONEY_HELD_ORDER_STATUSES.includes(order.status)) {
    return false;
  }

  const payment = await Payment.findOne({ orderId: order._id });
  if (!payment) return false;

  // Already accounted for.
  if (['refunded', 'released'].includes(payment.status)) return false;

  return payment.status === 'completed' || payment.status === 'disputed';
}

/**
 * Throw unless the money on this order has a recorded destination.
 *
 * `resolution` is how a caller declares it has already dealt with the money in the
 * same operation — a dispute resolution, or a payout it is about to perform.
 * Callers that pass it are asserting the financial record exists; callers that do
 * not are checked against the database.
 */
async function assertTerminalIsMoneySafe(order, nextStatus, { resolution = null } = {}) {
  if (!TERMINAL_STATUSES.includes(nextStatus)) return;

  const unresolved = await hasUnresolvedMoney(order);
  if (!unresolved) return;

  // An explicit, recorded financial outcome from the dispute flow.
  if (resolution === 'dispute_resolution') return;

  if (nextStatus === 'completed') {
    if (resolution === 'payout_released') return;
    const payout = await Payout.findOne({ orderId: order._id });
    if (payout && PAYOUT_SETTLED_STATUSES.includes(payout.status)) return;

    throw new OrderTransitionError(
      'Ordren kan ikke fullføres før utbetalingen til leverandøren er frigjort.',
      'payout_required_before_completion'
    );
  }

  // nextStatus === 'cancelled'
  if (resolution === 'refunded') return;
  const payment = await Payment.findOne({ orderId: order._id });
  if (payment && payment.status === 'refunded') return;

  throw new OrderTransitionError(
    'Ordren er betalt og kan ikke avbrytes uten refusjon eller en tvisteløsning.',
    'refund_required_before_cancellation'
  );
}

/** An open dispute freezes the order — nothing may move it but the dispute flow. */
async function assertNoActiveDispute(orderId) {
  const active = await Dispute.findOne({
    orderId,
    status: { $nin: ['resolved', 'closed', 'cancelled'] },
  });
  if (active) {
    throw new OrderTransitionError(
      'Ordren har en aktiv tvist og kan ikke endres.',
      'order_disputed'
    );
  }
}

/**
 * Move an order between states under every guard at once.
 *
 * The update is a compare-and-swap on the source status, so two concurrent callers
 * cannot both win — the loser gets `changed: false` rather than a second set of
 * side effects.
 *
 * @param {object}   opts
 * @param {string}   opts.orderId
 * @param {string}   opts.to                 target status
 * @param {string[]} [opts.allowedFrom]      restrict the source states further than the table
 * @param {string}   [opts.actorId]          who is acting, for history
 * @param {string}   [opts.action]           history action label
 * @param {string}   [opts.reason]
 * @param {boolean}  [opts.requireNoDispute] default true
 * @param {string}   [opts.resolution]       'payout_released' | 'refunded' | 'dispute_resolution'
 * @param {object}   [opts.set]              extra fields to set alongside the status
 */
async function transitionOrder({
  orderId,
  to,
  allowedFrom = null,
  actorId = null,
  action = 'status_change',
  reason = null,
  requireNoDispute = true,
  resolution = null,
  set = {},
}) {
  const order = await Order.findById(orderId);
  if (!order) throw new OrderTransitionError('Ordre ikke funnet', 'order_not_found');

  if (order.status === to) {
    return { changed: false, alreadyThere: true, order };
  }

  if (!isValidTransition(order.status, to)) {
    throw new OrderTransitionError(
      `Ugyldig statusovergang: ${order.status} → ${to}`,
      'invalid_transition'
    );
  }

  if (allowedFrom && !allowedFrom.includes(order.status)) {
    throw new OrderTransitionError(
      `Ugyldig statusovergang: ${order.status} → ${to}`,
      'invalid_transition'
    );
  }

  if (requireNoDispute && to !== 'disputed') {
    await assertNoActiveDispute(orderId);
  }

  await assertTerminalIsMoneySafe(order, to, { resolution });

  const sourceStates = allowedFrom || [order.status];
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: sourceStates } },
    {
      $set: { status: to, ...set },
      $push: {
        history: {
          action,
          userId: actorId,
          timestamp: new Date(),
          data: { from: order.status, to, reason },
        },
      },
    },
    { new: true }
  );

  // Someone else moved it between our read and our write.
  if (!updated) {
    return { changed: false, alreadyThere: false, order: await Order.findById(orderId) };
  }

  return { changed: true, order: updated };
}

module.exports = {
  ORDER_TRANSITIONS,
  TERMINAL_STATUSES,
  MONEY_HELD_ORDER_STATUSES,
  PAYOUT_SETTLED_STATUSES,
  isValidTransition,
  hasUnresolvedMoney,
  assertTerminalIsMoneySafe,
  assertNoActiveDispute,
  transitionOrder,
  OrderTransitionError,
};
