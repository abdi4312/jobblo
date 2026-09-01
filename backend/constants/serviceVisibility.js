/**
 * Which listings anyone is allowed to see.
 *
 * This list already existed twice — as the `query.status = { $in: ['open', 'active'] }`
 * filter in `getAllServices` and as `PUBLIC_SERVICE_STATUSES` in `getServiceById` — and
 * a third, incompatible copy had grown in the social-preview route, written the other
 * way round as a blacklist:
 *
 *     job.status === 'draft' || job.status === 'closed' ||
 *     job.status === 'private' || job.status === 'cancelled'
 *
 * A blacklist is the wrong shape for a visibility rule: every status added to the model
 * afterwards defaults to public. Eight of the eleven real statuses were not on that
 * list, so `expired`, `pending`, `awaiting_payment`, `paid`, `in_progress`,
 * `ready_for_review`, `waiting_for_approval` and `completed` listings all produced full
 * social previews — title, description and photo — from an endpoint that needs no
 * authentication. `'private'` is not even a value the Service schema can hold, so that
 * clause never matched anything.
 *
 * One exported list, used by every read path, so a new status is private until somebody
 * deliberately adds it here.
 */
const PUBLIC_SERVICE_STATUSES = ['open', 'active'];

/** True when this listing may be shown to an anonymous visitor. */
function isPubliclyVisible(service) {
  return Boolean(service) && PUBLIC_SERVICE_STATUSES.includes(service.status);
}

module.exports = { PUBLIC_SERVICE_STATUSES, isPubliclyVisible };
