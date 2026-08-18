/**
 * What is allowed to be stored in `Review.photos`.
 *
 * The customer's review photos were posted as base64 data URLs inside the JSON body of
 * `POST /api/safepay-checkout/approve` and written straight into MongoDB. Three problems
 * came out of that, and this file is the guard against all three:
 *
 *   1. Base64 inflates a file by ~33 %, so two ordinary phone photos exceeded the 12 MB
 *      body-parser limit and the approval failed with "Innholdet er for stort" — at the
 *      one moment in the flow where failing costs the provider their payout.
 *   2. A `Review` document has a 16 MB ceiling like any other. Three photos could approach
 *      it, and there was nothing stopping a fourth.
 *   3. Every read of that review — the provider's profile, the reviews list — shipped the
 *      full image bytes out of the database.
 *
 * Photos are uploaded to Cloudinary now (`POST /api/safepay-checkout/review-photos/:orderId`)
 * and only the resulting URLs are stored. This validator is what makes that hold: it is
 * called by every path that writes `photos`, so an older client, a script, or a new caller
 * cannot put bytes back into the column.
 */

const MAX_REVIEW_PHOTOS = 6;
const MAX_URL_LENGTH = 2048;

/**
 * Validate and normalise a `photos` payload.
 *
 * @param {unknown} photos  Raw value from the request body.
 * @returns {{ ok: true, photos: string[] } | { ok: false, error: string }}
 */
function normaliseReviewPhotos(photos) {
  if (photos === undefined || photos === null) return { ok: true, photos: [] };

  if (!Array.isArray(photos)) {
    return { ok: false, error: 'Bilder må sendes som en liste med URL-er.' };
  }

  if (photos.length > MAX_REVIEW_PHOTOS) {
    return { ok: false, error: `Maks ${MAX_REVIEW_PHOTOS} bilder per vurdering.` };
  }

  const cleaned = [];
  for (const entry of photos) {
    if (typeof entry !== 'string') {
      return { ok: false, error: 'Bilder må sendes som en liste med URL-er.' };
    }

    const url = entry.trim();
    if (!url) continue;

    // The specific rejection that matters: this is what the old client sent.
    if (url.startsWith('data:')) {
      return {
        ok: false,
        error:
          'Bilder kan ikke sendes som data-URL. Last dem opp først, og send URL-ene du får tilbake.',
      };
    }

    if (url.length > MAX_URL_LENGTH) {
      return { ok: false, error: 'Bilde-URL er for lang.' };
    }

    if (!/^https:\/\//i.test(url)) {
      return { ok: false, error: 'Bilde-URL må være en https-adresse.' };
    }

    cleaned.push(url);
  }

  return { ok: true, photos: cleaned };
}

module.exports = { normaliseReviewPhotos, MAX_REVIEW_PHOTOS };
