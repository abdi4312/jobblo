const mongoose = require('mongoose');

/**
 * One row per Stripe event id we have accepted for processing.
 *
 * Stripe guarantees at-least-once delivery and replays events on any non-2xx, so
 * without this a retry re-runs every side effect: a second Payment document, a
 * second notification, a second chat system message, a second payout attempt.
 *
 * The contract is claim → process → mark processed:
 *
 *   - `processing` means someone is working on it right now. A concurrent delivery
 *     sees this and backs off.
 *   - `processed` means it completed. Replays return early forever.
 *   - On failure the claim is RELEASED (deleted), so Stripe's retry can claim it
 *     again. Marking an event processed before its handler succeeds would turn
 *     every transient database blip into a permanently lost payment.
 *
 * A claim left in `processing` by a crashed process would otherwise block retries
 * forever, so a claim older than STALE_CLAIM_MS is takeable.
 */
const stripeEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'processed'],
      default: 'processing',
      index: true,
    },
    attempts: { type: Number, default: 1 },
    // Stripe object this event was about, for reconciliation. Never the payload.
    objectId: { type: String, default: null },
    processedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StripeEvent', stripeEventSchema);
