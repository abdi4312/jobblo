const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const {
  buildListingPreview,
  renderPreviewHtml,
  isValidObjectId,
} = require('../utils/socialPreview');

/**
 * Server-rendered social previews for listing links.
 *
 * Facebook, WhatsApp, iMessage, Slack, LinkedIn, Discord and Telegram fetch a URL once
 * and read the `<head>`. None of them runs JavaScript, so the React shell — which is
 * what every one of them currently receives — can never produce a card. This route is
 * the server-rendered answer; a reverse proxy sends crawler user-agents here and
 * everyone else to the SPA. See `deploy/nginx/jobblo-share-cards.conf`.
 *
 * The metadata decisions live in `utils/socialPreview.js` so they can be tested without
 * HTTP. What is here is the lookup and the status codes.
 *
 * ── Changes from the previous version ──────────────────────────────────────────
 *
 *   Visibility was a BLACKLIST — `draft`, `closed`, `private`, `cancelled`. Eight of
 *   the eleven real statuses were absent, so `expired`, `pending`, `awaiting_payment`,
 *   `paid`, `in_progress`, `ready_for_review`, `waiting_for_approval` and `completed`
 *   listings all served full previews with title, description and photo from an
 *   unauthenticated endpoint. (`'private'` is not a value the schema can hold, so that
 *   clause matched nothing at all.) It is now the shared allow-list every other public
 *   read path uses — `constants/serviceVisibility.js`.
 *
 *   A malformed id reached `Service.findById`, threw a CastError, and returned a 500
 *   with the body "Internal Server Error". Crawlers cache failures; a 500 on a shared
 *   link can suppress the card until the cache expires.
 *
 *   The generic fallback answered 404. Facebook and LinkedIn frequently decline to
 *   render Open Graph on a 404 body, so an unavailable listing showed a bare link
 *   rather than the Jobblo card. It is a 200 with `noindex` now: the page really is a
 *   valid generic page about Jobblo, it just is not that listing.
 */

/**
 * Only the three fields a preview needs.
 *
 * An explicit projection rather than the whole document: `contactPhone` and
 * `contactEmail` are `select: false` and so were already excluded, but relying on that
 * means any field added to the schema later is one `.lean()` away from a public
 * preview. Nothing about the owner, applicants, orders or SafePay state is loaded.
 */
const PREVIEW_FIELDS = 'title description images status';

router.get('/job-listing/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Validated before the query, so a hand-typed or truncated link degrades to the
    // generic Jobblo card instead of a 500.
    const service = isValidObjectId(id)
      ? await Service.findById(id).select(PREVIEW_FIELDS).lean()
      : null;

    const meta = buildListingPreview(service, id);
    const html = renderPreviewHtml(meta);

    res.set('Content-Type', 'text/html; charset=utf-8');
    // Vary on User-Agent: the proxy routes by it, so a shared cache must not hand this
    // crawler HTML to a browser (or the SPA shell to a crawler) for the same URL.
    res.set('Vary', 'User-Agent');
    res.set(
      'Cache-Control',
      meta.found
        ? 'public, max-age=300, stale-while-revalidate=600'
        : // Do not let a card for a listing that is missing or private stick around.
          'public, max-age=60'
    );

    return res.status(200).send(html);
  } catch (err) {
    console.error('Preview route error for id %s: %s', id, err.message);

    /**
     * Still answer with a valid generic card. A 500 here is worse than useless: the
     * crawler caches the failure, so a database blip while somebody pastes a link
     * leaves that link previewless long after the blip is over.
     */
    const meta = buildListingPreview(null, id);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-store');
    return res.status(200).send(renderPreviewHtml(meta));
  }
});

module.exports = router;
