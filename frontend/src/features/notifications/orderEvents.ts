/**
 * Mirror of `backend/constants/orderEvents.js`. Change both together.
 *
 * These are the lifecycle events the server emits alongside a notification so the
 * screen the user is looking at can refresh itself. They are separate from
 * `new_notification`, which is the tray entry — `NotificationRealtime` owns that and
 * nothing here should touch it.
 *
 * The two lists had drifted badly. The frontend waited on `new_order_request`, which
 * nothing has ever emitted, while the server emitted `ready_for_review` — the moment
 * a customer's approve button unlocks — to no listener at all. A socket event nobody
 * handles fails silently, so this was invisible until the events were mapped
 * end-to-end.
 */

/** Application / selection stage — before an order exists. */
export const APPLICATION_EVENTS = [
  'new_job_request',
  'order_approved',
  'request_declined',
  'worker_selected',
] as const;

/** Money and work stage — an order exists. */
export const ORDER_EVENTS = [
  'order_paid',
  'payment_confirmed',
  'order_status_changed',
  'job_started',
  'evidence_uploaded',
  'order_ready_for_review',
  'work_approved',
  'order_completed',
  'payout_sent',
  'payout_failed',
] as const;

/** Dispute stage. */
export const DISPUTE_EVENTS = ['dispute_opened', 'dispute_updated', 'dispute_resolved'] as const;

/**
 * Older spellings still reachable in the tree. Listened for, never emitted by new code.
 *
 * `order_started` is the previous name for `job_started` and survives in
 * `safepayController.startJob`, which is currently unrouted but not deleted.
 * `ready_for_review` was the chat `systemData` spelling of `order_ready_for_review`.
 * Keeping them costs one listener each and means an old server build does not go
 * silent against a new client.
 */
export const LEGACY_ALIASES = ['order_started', 'ready_for_review'] as const;

export const ALL_LIFECYCLE_EVENTS = [
  ...APPLICATION_EVENTS,
  ...ORDER_EVENTS,
  ...DISPUTE_EVENTS,
  ...LEGACY_ALIASES,
] as const;

export type LifecycleEvent = (typeof ALL_LIFECYCLE_EVENTS)[number];

/** Every payload carries `orderId` where an order exists; some also carry `status`. */
export interface LifecyclePayload {
  orderId?: string;
  requestId?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Read an id out of a payload that may be a string, an ObjectId-ish object, or absent.
 * Server payloads are `String(order._id)` now, but `new_job_request` sends a whole
 * populated document, so this stays tolerant.
 */
export const idFrom = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return undefined;
};
