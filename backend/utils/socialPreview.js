const mongoose = require('mongoose');
const { isPubliclyVisible } = require('../constants/serviceVisibility');

/**
 * Open Graph / Twitter Card metadata for a listing.
 *
 * Kept separate from the route so the decisions below can be tested directly rather
 * than through HTTP: what counts as public, what is allowed into a preview, how a
 * relative image becomes absolute, and what happens when the id is nonsense.
 *
 * ── What a crawler is ──────────────────────────────────────────────────────────
 * Facebook, WhatsApp, iMessage, Slack, LinkedIn, Discord and Telegram all fetch a URL
 * once, read the `<head>`, and never execute JavaScript. A React SPA therefore cannot
 * produce a rich preview from the client no matter what it puts in `document.head` —
 * by the time React runs, the crawler has gone. Server-rendered HTML is the only
 * mechanism, which is what this builds.
 */

/** Longest description a preview shows. Facebook truncates near 300; WhatsApp far less. */
const DESCRIPTION_LIMIT = 200;
/** Longest title. Facebook shows ~88, Twitter ~70. */
const TITLE_LIMIT = 90;

/**
 * Escape text for interpolation into an HTML attribute.
 *
 * Every one of these five matters here: `<` and `>` stop a listing title closing the
 * meta tag and opening a `<script>`, `"` stops it escaping the attribute, `&` keeps
 * existing entities from double-decoding, and `'` covers single-quoted attributes.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Collapse whitespace and cut to `limit`, ending on a word where possible. */
function truncate(value, limit) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  // Only break on a word if that does not throw away most of the text.
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

/**
 * The canonical public origin, with no trailing slash.
 *
 * `PUBLIC_SITE_URL` is preferred and is what production should set. `FRONTEND_URL`
 * is the existing variable and is accepted as a fallback so nothing breaks before it
 * is configured.
 *
 * There is deliberately NO localhost default. The old route defaulted to
 * `http://localhost:5173`, so a misconfigured environment published `og:url` and
 * `og:image` pointing at a machine nobody else can reach — a preview that silently
 * fails everywhere instead of failing loudly once. An unset origin returns null and
 * the caller degrades to a preview with no absolute URLs rather than wrong ones.
 */
function siteOrigin(env = process.env) {
  const raw = env.PUBLIC_SITE_URL || env.FRONTEND_URL || '';
  const trimmed = String(raw).trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  // A localhost origin is fine in development but must never be baked into a shared
  // link, so it is still returned — the caller decides. See canonicalListingUrl.
  return trimmed;
}

/** `https://jobblo.no/jobs/:id`, or null when the origin is unknown. */
function canonicalListingUrl(id, env = process.env) {
  const origin = siteOrigin(env);
  if (!origin) return null;
  // The id is validated as an ObjectId before this is called, so it contributes only
  // [0-9a-f] and needs no escaping — but encode anyway so a future caller cannot make
  // this a URL-injection point.
  return `${origin}/jobs/${encodeURIComponent(String(id))}`;
}

/**
 * The URL to advertise as og:url — the /share/job/:id path, not the clean /jobs/:id.
 *
 * og:url is the address a crawler re-fetches to confirm the card, so it must resolve to
 * this server-rendered HTML. Only /share/job/ is proxied to the backend renderer in
 * nginx; /jobs/:id is served by the SPA fallback, so a crawler re-fetching /jobs/:id
 * gets a JS shell and canonicalises the share to the homepage (the redirect chain the
 * Facebook debugger showed). Pointing og:url at /share/job/ keeps the card on a URL
 * that always renders the card; a human clicking it is 302'd on to /jobs/:id by the
 * route's own UA gate.
 */
function shareListingUrl(id, env = process.env) {
  const origin = siteOrigin(env);
  if (!origin) return null;
  return `${origin}/share/job/${encodeURIComponent(String(id))}`;
}

/**
 * The MIME type a crawler should expect for an image URL, derived from its extension.
 *
 * WhatsApp and Facebook read `og:image:type` to decide up front whether to bother
 * fetching (and how to decode) the image; a missing or wrong type is one of the
 * reasons a card silently degrades to text-only. Returns null when the extension is
 * unknown, so the tag is omitted rather than declared wrong.
 */
function imageMimeType(url) {
  if (!url || typeof url !== 'string') return null;
  // Strip any query string / fragment before reading the extension (Azure SAS URLs,
  // the ?v= cache-buster, etc.).
  const clean = url.split(/[?#]/)[0];
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return map[ext] || null;
}

/**
 * Declared image dimensions for the card. Facebook/WhatsApp render a LARGE card only
 * when they can tell the image clears the ~600px minimum, and declaring the size lets
 * them decide without fetching-and-measuring first (which they often skip, showing a
 * small thumbnail instead). 1200×630 is the standard large-card ratio; it is a claim
 * about layout, not the file's real pixels, so it is safe for any wide-enough image.
 */
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/**
 * Turn a stored image reference into an absolute https URL a crawler can fetch.
 *
 * Returns null rather than a guess when it cannot: a broken `og:image` makes a card
 * render as an empty grey box, which looks worse than a text-only card.
 */
function absoluteImageUrl(image, env = process.env) {
  if (!image || typeof image !== 'string') return null;
  const trimmed = image.trim();
  if (!trimmed) return null;

  // Protocol-relative — some storage/CDN hosts emit these in places.
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  if (/^https?:\/\//i.test(trimmed)) {
    // Crawlers fetch over TLS and several refuse mixed content outright.
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  // A data: or blob: URI is not fetchable by a crawler.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  const origin = siteOrigin(env);
  if (!origin) return null;
  return `${origin}/${trimmed.replace(/^\/+/, '')}`;
}

/**
 * Force a Cloudinary image into the exact 1200×630 JPEG the card claims.
 *
 * A big FINN-style card only appears when the fetched image really is a wide
 * landscape ≥600px. Listing photos are whatever the user uploaded — often a small
 * portrait .webp — so declaring og:image:width=1200 while serving a 400×600 webp
 * makes WhatsApp fetch, measure, disagree, and drop to the small thumbnail (the bug
 * in the screenshot). Cloudinary rewrites the delivered pixels from the URL:
 * `c_fill,g_auto` crops to the exact frame, `f_jpg` drops webp (which several
 * crawlers won't render large), `q_auto` keeps it under WhatsApp's ~300KB fetch cap.
 * Any non-Cloudinary URL (Azure blob) is returned unchanged — it can't be resized
 * from a URL, so imageMimeType/dimensions still describe the original.
 */
function cardImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (!url.includes('res.cloudinary.com') || at === -1) return url;

  const transform = `c_fill,g_auto,w_${OG_IMAGE_WIDTH},h_${OG_IMAGE_HEIGHT},f_jpg,q_auto`;
  const head = url.slice(0, at + marker.length);
  let tail = url.slice(at + marker.length);
  // Drop a transform segment Cloudinary already put here so we don't stack two.
  if (/^[a-z]_[^/]+\//i.test(tail)) tail = tail.slice(tail.indexOf('/') + 1);
  // f_jpg makes Cloudinary deliver JPEG regardless of the stored .webp; rewrite the
  // extension too so og:image:type (read from the URL) matches the delivered bytes.
  tail = tail.replace(/\.(webp|png|gif|jpeg)(\?|#|$)/i, '.jpg$2');
  return `${head}${transform}/${tail}`;
}

/**
 * The branded card shown when a listing has no photo of its own.
 *
 * Deliberately NOT defaulted to anything in the repository. The old route pointed at
 * `/favicon.svg`, which fails twice over: Facebook, WhatsApp, LinkedIn and Twitter all
 * reject SVG for `og:image`, and that file is 27×14 px against Facebook's 200×200
 * minimum. The result was a card with a broken image rather than a clean text card.
 *
 * Jobblo has no social share asset today — the largest branded raster in the tree is a
 * 152×55 logo, still under the minimum. Until design supplies a 1200×630 PNG, this
 * returns null and the preview omits the image entirely, which renders as a tidy
 * text-only card. Set `SOCIAL_SHARE_IMAGE` (absolute URL, or a path relative to the
 * site origin) to switch it on the moment the asset exists.
 */
function fallbackImageUrl(env = process.env) {
  const configured = env.SOCIAL_SHARE_IMAGE || 'https://jobblo.no/assets/share-image.png';
  return absoluteImageUrl(configured, env);
}

/**
 * Build the metadata for a listing preview.
 *
 * @param {Object|null} service a lean Service document, or null when not found
 * @param {string} id the requested id, already known to be a valid ObjectId
 * @returns {{found: boolean, title, description, image: string|null, url: string|null,
 *            siteName: string, type: string, twitterCard: string}}
 */
function buildListingPreview(service, id, env = process.env) {
  const url = shareListingUrl(id, env);
  const fallbackImage = fallbackImageUrl(env);

  /**
   * A listing that does not exist and one that exists but is not public produce the
   * SAME generic response. Varying the answer would turn this unauthenticated endpoint
   * into an oracle for "does this id exist, and is it a draft?" — the same reason
   * `getServiceById` answers 404 rather than 403 for a non-public listing.
   */
  if (!isPubliclyVisible(service)) {
    return {
      found: false,
      title: 'Jobblo',
      description: 'Finn eller legg ut oppdrag i Norge. Trygg betaling med SafePay.',
      // The site root, not the listing URL. This card is about Jobblo, not about a
      // listing that is missing or private, and `og:url` is a claim of canonicality —
      // pointing it at a URL that will not resolve asks every crawler to canonicalise
      // the share to a dead page. It also stops a malformed id being echoed back as
      // though it were a real address.
      url: siteOrigin(env),
      siteName: 'Jobblo',
      type: 'website',
      image: fallbackImage,
      imageType: fallbackImage ? imageMimeType(fallbackImage) : null,
      twitterCard: fallbackImage ? 'summary_large_image' : 'summary',
    };
  }

  /**
   * Only these three fields leave the database.
   *
   * `contactPhone` and `contactEmail` are `select: false` on the model, so they are not
   * even loaded — but the rule is stated positively here rather than relying on that:
   * the preview is assembled from an explicit allow-list, so adding a field to the
   * schema cannot quietly add it to a public preview. Nothing about the owner, the
   * applicants, the orders, the SafePay state or any internal id is read.
   */
  const title = truncate(service.title, TITLE_LIMIT) || 'Oppdrag på Jobblo';
  const description =
    truncate(service.description, DESCRIPTION_LIMIT) ||
    'Se oppdraget på Jobblo. Trygg betaling med SafePay.';

  // Prefer the pre-rendered 1200×630 OG derivative (uploaded to Azure alongside the
  // original) so WhatsApp/Facebook get a real wide landscape and show the big card.
  // Fall back to the first raw photo for listings uploaded before OG versions existed.
  const ogUrl = Array.isArray(service.imageMetadata)
    ? service.imageMetadata.find((m) => m && typeof m.ogUrl === 'string' && m.ogUrl.trim())?.ogUrl
    : null;
  const rawImage = Array.isArray(service.images)
    ? service.images.find((i) => typeof i === 'string' && i.trim())
    : null;
  const listingImage = absoluteImageUrl(ogUrl || rawImage, env);
  // Cloudinary photos (older listings) are rewritten to the declared 1200×630 JPEG;
  // a null here means no usable photo, so we fall back to the branded card image.
  const image = cardImageUrl(listingImage) || fallbackImage;

  return {
    found: true,
    title,
    description,
    image,
    imageType: image ? imageMimeType(image) : null,
    url,
    siteName: 'Jobblo',
    type: 'article',
    twitterCard: image ? 'summary_large_image' : 'summary',
  };
}

/**
 * Render the preview document.
 *
 * No JavaScript redirect. The old version emitted
 * `<script>location.replace('…')</script>`, which is only ever reached by a crawler
 * that ignores it — and, on the rare occasion a human landed there, produced a blank
 * flash before bouncing. A plain `<a>` and a `<link rel="canonical">` do the same job
 * without executing anything, and are what a crawler follows anyway.
 */
function renderPreviewHtml(meta) {
  const tag = (attr, key, value) =>
    value ? `    <meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(value)}" />\n` : '';

  const title = escapeHtml(meta.title);

  // The card shows image, title, description and link (og:url). The image block
  // carries width/height/type AND twitter:card=summary_large_image so WhatsApp,
  // Facebook and X all render the BIG image card (like finn.no) instead of a small
  // side thumbnail. Without the large-image hint some clients fall back to summary.
  const largeCard = meta.image ? 'summary_large_image' : 'summary';
  return `<!doctype html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <!-- Open Graph -->
${tag('property', 'og:title', meta.title)}${tag('property', 'og:description', meta.description)}${tag('property', 'og:url', meta.url)}${tag('property', 'og:image', meta.image)}${tag('property', 'og:image:secure_url', meta.image)}${tag('property', 'og:image:type', meta.image ? meta.imageType : null)}${tag('property', 'og:image:width', meta.image ? String(OG_IMAGE_WIDTH) : null)}${tag('property', 'og:image:height', meta.image ? String(OG_IMAGE_HEIGHT) : null)}    <!-- Large image card hint -->
${tag('name', 'twitter:card', largeCard)}${tag('name', 'twitter:image', meta.image)}  </head>
  <body>
    <h1>${title}</h1>
    <p>${escapeHtml(meta.description)}</p>
${meta.url ? `    <p><a href="${escapeHtml(meta.url)}">Åpne annonsen på Jobblo</a></p>\n` : ''}  </body>
</html>
`;
}

/** Is this a string Mongo can turn into an _id without throwing? */
function isValidObjectId(id) {
  return (
    typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)
  );
}

module.exports = {
  buildListingPreview,
  renderPreviewHtml,
  escapeHtml,
  truncate,
  siteOrigin,
  canonicalListingUrl,
  shareListingUrl,
  absoluteImageUrl,
  cardImageUrl,
  fallbackImageUrl,
  imageMimeType,
  isValidObjectId,
  DESCRIPTION_LIMIT,
  TITLE_LIMIT,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
};
