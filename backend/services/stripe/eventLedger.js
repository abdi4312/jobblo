const StripeEvent = require('../../models/StripeEvent');

/**
 * A claim older than this is assumed to belong to a process that died mid-handler,
 * and may be taken over. Long enough that a slow-but-alive handler is never
 * stolen from; short enough that a crash does not block the payment for hours.
 */
const STALE_CLAIM_MS = 5 * 60 * 1000;

/**
 * Try to take ownership of a Stripe event.
 *
 * Returns one of:
 *   { claimed: true }                     — process it, then call markProcessed
 *   { claimed: false, reason: 'duplicate' }   — already done, ack 200
 *   { claimed: false, reason: 'in_flight' }   — another worker has it, ack 200
 */
async function claimEvent(event) {
  const objectId = event?.data?.object?.id || null;

  try {
    await StripeEvent.create({
      eventId: event.id,
      type: event.type,
      status: 'processing',
      objectId,
    });
    return { claimed: true };
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  // Someone got there first. Decide whether they are still alive.
  const existing = await StripeEvent.findOne({ eventId: event.id });
  if (!existing) {
    // Released between our insert and this read — let Stripe retry rather than
    // racing again here.
    return { claimed: false, reason: 'in_flight' };
  }

  if (existing.status === 'processed') {
    return { claimed: false, reason: 'duplicate' };
  }

  const age = Date.now() - new Date(existing.updatedAt || existing.createdAt).getTime();
  if (age < STALE_CLAIM_MS) {
    return { claimed: false, reason: 'in_flight' };
  }

  // Stale claim: take it over, but only if nobody else does so first. The
  // updatedAt guard makes the takeover itself a compare-and-swap.
  const takenOver = await StripeEvent.findOneAndUpdate(
    { eventId: event.id, status: 'processing', updatedAt: existing.updatedAt },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { new: true }
  );

  return takenOver ? { claimed: true } : { claimed: false, reason: 'in_flight' };
}

/** The handler succeeded. Replays from here on return early. */
async function markProcessed(eventId) {
  await StripeEvent.updateOne(
    { eventId },
    { $set: { status: 'processed', processedAt: new Date(), lastError: null } }
  );
}

/**
 * The handler failed. Release the claim so Stripe's retry can pick it up.
 *
 * Deleting rather than marking 'failed' is deliberate: a 'failed' row would have
 * to be special-cased in claimEvent, and forgetting that is exactly how a retry
 * gets mistaken for a duplicate and the payment is lost.
 */
async function releaseClaim(eventId, err) {
  try {
    await StripeEvent.deleteOne({ eventId, status: 'processing' });
  } catch (delErr) {
    // Best effort. The stale-claim path above recovers this within STALE_CLAIM_MS.
    console.error('Could not release Stripe event claim %s: %s', eventId, delErr.message);
  }
  if (err) {
    console.error('Stripe event %s released after failure: %s', eventId, err.message);
  }
}

module.exports = { claimEvent, markProcessed, releaseClaim, STALE_CLAIM_MS };
