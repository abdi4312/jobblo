const mongoose = require('mongoose');

/** Validation and input helpers shared by the listing controllers. */

/** A user-supplied string is not a regex. Same escape the admin search already uses. */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bounds for a job posting. The schema only had `price: { min: 0 }`. */
const SERVICE_LIMITS = {
  TITLE_MIN: 5,
  TITLE_MAX: 200,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 5000,
  PRICE_MAX: 1000000,
  DURATION_MAX: 1000,
  MAX_CHECKLIST_ITEMS: 50,
  CHECKLIST_TEXT_MAX: 300,
};

/**
 * Shared field validation for creating and editing a job.
 *
 * None of this existed: title and description had no length caps, `price` had no
 * ceiling (so 1e308 was accepted and then overflowed Stripe at checkout), and
 * `fromDate`/`toDate` were never compared — a job could end before it started, which
 * nothing downstream would ever question.
 *
 * Returns an error string, or null when the payload is acceptable.
 */
function validateServiceFields(body, { partial = false } = {}) {
  const has = (field) => body[field] !== undefined && body[field] !== null;

  if (has('customerType') && !['private', 'business'].includes(body.customerType))
    return 'Ugyldig oppdragstype.';

  if (!partial || has('title')) {
    const title = String(body.title ?? '').trim();
    if (title.length < SERVICE_LIMITS.TITLE_MIN)
      return `Tittelen må være minst ${SERVICE_LIMITS.TITLE_MIN} tegn.`;
    if (title.length > SERVICE_LIMITS.TITLE_MAX)
      return `Tittelen kan være maks ${SERVICE_LIMITS.TITLE_MAX} tegn.`;
  }

  if (!partial || has('description')) {
    const description = String(body.description ?? '').trim();
    if (description.length < SERVICE_LIMITS.DESCRIPTION_MIN)
      return `Beskrivelsen må være minst ${SERVICE_LIMITS.DESCRIPTION_MIN} tegn.`;
    if (description.length > SERVICE_LIMITS.DESCRIPTION_MAX)
      return `Beskrivelsen kan være maks ${SERVICE_LIMITS.DESCRIPTION_MAX} tegn.`;
  }

  for (const field of ['price', 'hourlyRate']) {
    if (!has(field)) continue;
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0) return `${field} må være et positivt tall.`;
    if (value > SERVICE_LIMITS.PRICE_MAX)
      return `${field} kan ikke overstige ${SERVICE_LIMITS.PRICE_MAX} kr.`;
  }

  if (has('duration')) {
    const value = Number(body.duration?.value);
    if (body.duration?.value !== undefined) {
      if (!Number.isFinite(value) || value <= 0) return 'Varighet må være større enn 0.';
      if (value > SERVICE_LIMITS.DURATION_MAX)
        return `Varighet kan ikke overstige ${SERVICE_LIMITS.DURATION_MAX}.`;
    }
  }

  const from = has('fromDate') ? new Date(body.fromDate) : null;
  const to = has('toDate') ? new Date(body.toDate) : null;
  if (from && Number.isNaN(from.getTime())) return 'Ugyldig fra-dato.';
  if (to && Number.isNaN(to.getTime())) return 'Ugyldig til-dato.';
  if (from && to && from > to) return 'Sluttdato kan ikke være før startdato.';

  return null;
}

/** Guards against Mongo operator injection from query strings (`?userId[$ne]=null`). */
const isValidId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

/**
 * Trims the optional contact fields and drops the blanks.
 *
 * Both edit entry points post the whole form, but only /api/services/my-posted
 * can read these back (they are `select: false`), so the other one always sends
 * empty strings. Assigning those would silently erase a saved phone number just
 * because the user edited the job from a screen that couldn't see it.
 */
const pickContactUpdates = (body) => {
  const updates = {};
  for (const field of ['contactPhone', 'contactEmail']) {
    const value = body[field];
    if (typeof value === 'string' && value.trim()) updates[field] = value.trim();
  }
  return updates;
};

module.exports = { escapeRegex, SERVICE_LIMITS, validateServiceFields, isValidId, pickContactUpdates };
