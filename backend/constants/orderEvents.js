/**
 * The canonical order/job lifecycle socket events.
 *
 * These are the names the server emits alongside a notification (`notify({ event })`)
 * so a client can refresh the screen the user is actually looking at. They are a
 * separate concern from `new_notification`, which is the tray entry: one is "update
 * your data", the other is "tell the user".
 *
 * Why this file exists: the emitted names and the listened-for names had drifted
 * apart and nobody could see it, because a socket event that nobody handles fails
 * silently. Before this, `ready_for_review` — the moment a customer's approve button
 * becomes available — was emitted and listened for by no one, while the frontend
 * waited on `new_order_request`, which nothing has ever emitted. The customer sat on
 * the approval page and had to reload to discover the job was ready.
 *
 * Rules:
 *   - Emit only names from this list.
 *   - The frontend mirror is `frontend/src/features/notifications/orderEvents.ts`.
 *     Change both together.
 *   - Every payload carries `orderId` where an order exists, so the client can
 *     invalidate that order's queries specifically instead of dropping the cache.
 */

/** Application / selection stage — before an order exists. */
const APPLICATION_EVENTS = Object.freeze([
  'new_job_request', // → job owner: someone applied
  'order_approved', // → applicant: you were selected
  'request_declined', // → applicant: not this time
  'worker_selected', // → both: contract created for a chosen provider
]);

/** Money and work stage — an order exists. */
const ORDER_EVENTS = Object.freeze([
  'order_paid', // escrow funded
  'payment_confirmed', // reconciliation confirmed a payment out of band
  'order_status_changed', // generic status move; payload carries `status`
  'job_started', // provider started the work
  'evidence_uploaded', // provider added proof of work
  'order_ready_for_review', // provider marked the job finished  ← the critical one
  'work_approved', // customer approved
  'order_completed', // order closed out
  'payout_sent',
  'payout_failed',
]);

/** Dispute stage. */
const DISPUTE_EVENTS = Object.freeze([
  'dispute_opened',
  'dispute_updated',
  'dispute_resolved',
]);

/**
 * Names that are still emitted somewhere, or were emitted recently enough that a
 * client or a queued job may still produce them. Listened for, never newly emitted.
 *
 * `order_started` is the older spelling of `job_started`; it survives in
 * `safepayController.startJob`, which is currently unrouted (the live path is
 * `providerWorkController.startJob`) but has not been deleted.
 * `ready_for_review` was the chat `systemData` spelling of `order_ready_for_review`.
 */
const LEGACY_ALIASES = Object.freeze(['order_started', 'ready_for_review']);

const ALL_LIFECYCLE_EVENTS = Object.freeze([
  ...APPLICATION_EVENTS,
  ...ORDER_EVENTS,
  ...DISPUTE_EVENTS,
]);

module.exports = {
  APPLICATION_EVENTS,
  ORDER_EVENTS,
  DISPUTE_EVENTS,
  LEGACY_ALIASES,
  ALL_LIFECYCLE_EVENTS,
};
