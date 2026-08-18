const mongoose = require('mongoose');
const {
  buildListingPreview,
  renderPreviewHtml,
  escapeHtml,
  truncate,
  siteOrigin,
  canonicalListingUrl,
  absoluteImageUrl,
  isValidObjectId,
  DESCRIPTION_LIMIT,
} = require('../utils/socialPreview');
const { PUBLIC_SERVICE_STATUSES } = require('../constants/serviceVisibility');

/**
 * Social share cards.
 *
 * Facebook, WhatsApp, iMessage, Slack, LinkedIn, Discord and Telegram fetch a URL once
 * and read the <head> without running JavaScript, so a React shell can never produce a
 * card. These tests cover the server-rendered replacement: what gets in, what must not,
 * and what happens when the input is hostile or malformed.
 */

const ENV = { PUBLIC_SITE_URL: 'https://jobblo.no' };
const ID = '507f1f77bcf86cd799439011';

const listing = (overrides = {}) => ({
  status: 'open',
  title: 'Male to soverom',
  description: 'Trenger en maler til to soverom i Oslo. Malingen er kjøpt.',
  images: ['https://res.cloudinary.com/jobblo/image/upload/v1/job.jpg'],
  ...overrides,
});

/** Pull a meta tag's content out of rendered HTML. */
const metaOf = (html, key) => {
  const m = html.match(
    new RegExp(`<meta (?:property|name)="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content="([^"]*)"`)
  );
  return m ? m[1] : null;
};

// ── 1 ───────────────────────────────────────────────────────────────────────────
describe('1. a public listing returns correct preview HTML', () => {
  const html = renderPreviewHtml(buildListingPreview(listing(), ID, ENV));

  it('is a complete HTML document', () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('</html>');
    expect(html).toContain('<html lang="nb">');
  });

  it('carries every tag the brief requires', () => {
    for (const [key, value] of [
      ['og:type', 'website'],
      ['og:site_name', 'Jobblo'],
      ['twitter:card', 'summary_large_image'],
    ]) {
      expect(metaOf(html, key)).toBe(value);
    }
    for (const key of [
      'og:title',
      'og:description',
      'og:image',
      'og:url',
      'twitter:title',
      'twitter:description',
      'twitter:image',
    ]) {
      expect(metaOf(html, key)).toBeTruthy();
    }
  });

  it('is indexable and declares its canonical URL', () => {
    expect(metaOf(html, 'robots')).toBe('index, follow');
    expect(html).toContain(`<link rel="canonical" href="https://jobblo.no/job-listing/${ID}" />`);
  });

  it('contains no script tag at all', () => {
    // The old route shipped `<script>location.replace(...)</script>`. A crawler ignores
    // it, and a human who lands here gets a blank flash — and a redirect from this
    // route back to the SPA URL is how a crawler-routing proxy ends up in a loop.
    expect(html).not.toMatch(/<script/i);
  });
});

// ── 2, 3, 4 ─────────────────────────────────────────────────────────────────────
describe('2. title comes from the listing', () => {
  it('uses the listing title verbatim', () => {
    expect(buildListingPreview(listing(), ID, ENV).title).toBe('Male to soverom');
  });

  it('falls back to a branded title when the listing has none', () => {
    const meta = buildListingPreview(listing({ title: '   ' }), ID, ENV);
    expect(meta.title).toBe('Oppdrag på Jobblo');
  });

  it('truncates an absurdly long title rather than shipping it whole', () => {
    const meta = buildListingPreview(listing({ title: 'a'.repeat(400) }), ID, ENV);
    expect(meta.title.length).toBeLessThanOrEqual(90);
    expect(meta.title.endsWith('…')).toBe(true);
  });
});

describe('3. description comes from safe public listing content', () => {
  it('uses the listing description, whitespace collapsed', () => {
    const meta = buildListingPreview(
      listing({ description: '  Trenger   maler.\n\nMalingen er kjøpt. ' }),
      ID,
      ENV
    );
    expect(meta.description).toBe('Trenger maler. Malingen er kjøpt.');
  });

  it('truncates long copy on a word boundary', () => {
    const words = 'oppussing av bad '.repeat(40);
    const meta = buildListingPreview(listing({ description: words }), ID, ENV);

    expect(meta.description.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
    expect(meta.description.endsWith('…')).toBe(true);
    expect(meta.description).not.toMatch(/\s…$/); // no dangling space before the ellipsis
  });

  it('falls back when the listing has no description', () => {
    const meta = buildListingPreview(listing({ description: '' }), ID, ENV);
    expect(meta.description).toMatch(/Jobblo/);
  });
});

describe('4. the listing image is used, absolute', () => {
  it('uses the first usable listing photo', () => {
    expect(buildListingPreview(listing(), ID, ENV).image).toBe(
      'https://res.cloudinary.com/jobblo/image/upload/v1/job.jpg'
    );
  });

  it('skips empty entries to find a real one', () => {
    const meta = buildListingPreview(
      listing({ images: ['', '   ', 'https://cdn.example/real.jpg'] }),
      ID,
      ENV
    );
    expect(meta.image).toBe('https://cdn.example/real.jpg');
  });

  it('upgrades protocol-relative and http URLs to https', () => {
    // Crawlers fetch over TLS; several refuse mixed content outright.
    expect(absoluteImageUrl('//cdn.example/a.jpg', ENV)).toBe('https://cdn.example/a.jpg');
    expect(absoluteImageUrl('http://cdn.example/a.jpg', ENV)).toBe('https://cdn.example/a.jpg');
  });

  it('makes a site-relative path absolute', () => {
    expect(absoluteImageUrl('/uploads/a.jpg', ENV)).toBe('https://jobblo.no/uploads/a.jpg');
    expect(absoluteImageUrl('uploads/a.jpg', ENV)).toBe('https://jobblo.no/uploads/a.jpg');
  });

  it('refuses data: and blob: URIs, which a crawler cannot fetch', () => {
    expect(absoluteImageUrl('data:image/png;base64,iVBORw0KGgo=', ENV)).toBeNull();
    expect(absoluteImageUrl('blob:https://jobblo.no/abc', ENV)).toBeNull();
  });

  it('never emits a relative og:image', () => {
    const html = renderPreviewHtml(
      buildListingPreview(listing({ images: ['/uploads/a.jpg'] }), ID, ENV)
    );
    expect(metaOf(html, 'og:image')).toMatch(/^https:\/\//);
  });
});

// ── 5 ───────────────────────────────────────────────────────────────────────────
describe('5. fallback image behaviour', () => {
  it('omits og:image entirely when the listing has no photo and no fallback is configured', () => {
    // Jobblo has no social share asset. The old route pointed at /favicon.svg — an SVG,
    // which Facebook, WhatsApp, LinkedIn and Twitter all reject, at 27x14 against
    // Facebook's 200x200 floor. That rendered a broken grey box; omitting the tag
    // renders a clean text card instead.
    const meta = buildListingPreview(listing({ images: [] }), ID, ENV);

    expect(meta.image).toBeNull();
    const html = renderPreviewHtml(meta);
    expect(metaOf(html, 'og:image')).toBeNull();
    expect(html).not.toMatch(/favicon\.svg/);
  });

  it('downgrades the Twitter card to summary when there is no image', () => {
    // summary_large_image with no image renders as an empty banner.
    expect(buildListingPreview(listing({ images: [] }), ID, ENV).twitterCard).toBe('summary');
  });

  it('uses SOCIAL_SHARE_IMAGE when one is configured', () => {
    const env = { ...ENV, SOCIAL_SHARE_IMAGE: 'https://jobblo.no/og-default.png' };
    const meta = buildListingPreview(listing({ images: [] }), ID, env);

    expect(meta.image).toBe('https://jobblo.no/og-default.png');
    expect(meta.twitterCard).toBe('summary_large_image');
  });

  it('resolves a relative SOCIAL_SHARE_IMAGE against the site origin', () => {
    const env = { ...ENV, SOCIAL_SHARE_IMAGE: '/og-default.png' };
    expect(buildListingPreview(listing({ images: [] }), ID, env).image).toBe(
      'https://jobblo.no/og-default.png'
    );
  });

  it('prefers the listing photo over the fallback', () => {
    const env = { ...ENV, SOCIAL_SHARE_IMAGE: '/og-default.png' };
    expect(buildListingPreview(listing(), ID, env).image).toMatch(/cloudinary/);
  });
});

// ── 6 ───────────────────────────────────────────────────────────────────────────
describe('6. the canonical Jobblo URL', () => {
  it('is the public site URL, not the API host', () => {
    expect(canonicalListingUrl(ID, ENV)).toBe(`https://jobblo.no/job-listing/${ID}`);
  });

  it('prefers PUBLIC_SITE_URL over FRONTEND_URL', () => {
    const env = { PUBLIC_SITE_URL: 'https://jobblo.no', FRONTEND_URL: 'https://staging.example' };
    expect(siteOrigin(env)).toBe('https://jobblo.no');
  });

  it('falls back to FRONTEND_URL when PUBLIC_SITE_URL is unset', () => {
    expect(siteOrigin({ FRONTEND_URL: 'https://jobblo.no/' })).toBe('https://jobblo.no');
  });

  it('strips trailing slashes so the URL never doubles up', () => {
    expect(canonicalListingUrl(ID, { PUBLIC_SITE_URL: 'https://jobblo.no///' })).toBe(
      `https://jobblo.no/job-listing/${ID}`
    );
  });

  it('never invents a localhost origin when nothing is configured', () => {
    // The old route defaulted to http://localhost:5173, so a misconfigured environment
    // published og:url pointing at a machine nobody else can reach.
    expect(siteOrigin({})).toBeNull();
    expect(canonicalListingUrl(ID, {})).toBeNull();

    const html = renderPreviewHtml(buildListingPreview(listing(), ID, {}));
    expect(html).not.toMatch(/localhost/);
    expect(metaOf(html, 'og:url')).toBeNull();
  });

  it('rejects a non-http origin', () => {
    expect(siteOrigin({ PUBLIC_SITE_URL: 'jobblo.no' })).toBeNull();
    expect(siteOrigin({ PUBLIC_SITE_URL: 'javascript:alert(1)' })).toBeNull();
  });

  it('og:url and the canonical link agree', () => {
    const html = renderPreviewHtml(buildListingPreview(listing(), ID, ENV));
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)[1];
    expect(metaOf(html, 'og:url')).toBe(canonical);
  });
});

// ── 7 ───────────────────────────────────────────────────────────────────────────
describe('7. malicious HTML is escaped', () => {
  const HOSTILE = '"><script>alert(1)</script><meta property="og:title" content="pwned';

  it('escapes every dangerous character', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('cannot break out of a meta attribute', () => {
    const html = renderPreviewHtml(buildListingPreview(listing({ title: HOSTILE }), ID, ENV));

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('content="pwned');
    expect(html).toContain('&lt;script&gt;');
  });

  it('a hostile description cannot inject tags either', () => {
    const html = renderPreviewHtml(
      renderable({ description: '</head><body onload=alert(1)>' })
    );
    expect(html).not.toMatch(/<body onload/i);
    expect(html).not.toMatch(/<\/head><body/i);
  });

  function renderable(overrides) {
    return buildListingPreview(listing(overrides), ID, ENV);
  }

  it('an image URL cannot smuggle an attribute', () => {
    const html = renderPreviewHtml(
      buildListingPreview(listing({ images: ['https://x/a.jpg" onerror="alert(1)'] }), ID, ENV)
    );
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain('&quot;');
  });

  it('escapes in the visible body too, not only the head', () => {
    const html = renderPreviewHtml(buildListingPreview(listing({ title: HOSTILE }), ID, ENV));
    const body = html.slice(html.indexOf('<body>'));
    expect(body).not.toMatch(/<script/i);
  });
});

// ── 8 ───────────────────────────────────────────────────────────────────────────
describe('8. non-public listings do not leak', () => {
  const NON_PUBLIC = [
    'draft',
    'closed',
    'cancelled',
    'expired',
    'pending',
    'awaiting_payment',
    'paid',
    'in_progress',
    'ready_for_review',
    'waiting_for_approval',
    'completed',
  ];

  it.each(NON_PUBLIC)('a %s listing exposes nothing about itself', (status) => {
    const secret = 'Hemmelig oppdrag for Kari Nordmann';
    const meta = buildListingPreview(
      listing({ status, title: secret, description: secret, images: ['https://cdn/x.jpg'] }),
      ID,
      ENV
    );

    expect(meta.found).toBe(false);
    expect(meta.title).toBe('Jobblo');
    expect(meta.description).not.toContain(secret);

    const html = renderPreviewHtml(meta);
    expect(html).not.toContain(secret);
    expect(html).not.toContain('https://cdn/x.jpg');
  });

  it.each(PUBLIC_SERVICE_STATUSES)('a %s listing IS public', (status) => {
    expect(buildListingPreview(listing({ status }), ID, ENV).found).toBe(true);
  });

  it('a deleted (missing) listing is indistinguishable from a private one', () => {
    // Otherwise this unauthenticated endpoint is an oracle for "does this id exist,
    // and is it a draft?".
    const missing = renderPreviewHtml(buildListingPreview(null, ID, ENV));
    const priv = renderPreviewHtml(buildListingPreview(listing({ status: 'draft' }), ID, ENV));
    expect(missing).toBe(priv);
  });

  it('the generic card is noindex, so it never becomes a search result', () => {
    const html = renderPreviewHtml(buildListingPreview(null, ID, ENV));
    expect(metaOf(html, 'robots')).toBe('noindex, follow');
  });

  it('the generic card is still a valid, branded card', () => {
    // It must not be blank: Facebook falls back to a bare link if the head is empty.
    const html = renderPreviewHtml(buildListingPreview(null, ID, ENV));
    expect(metaOf(html, 'og:site_name')).toBe('Jobblo');
    expect(metaOf(html, 'og:title')).toBe('Jobblo');
    expect(metaOf(html, 'og:description')).toBeTruthy();
  });
});

// ── 9 ───────────────────────────────────────────────────────────────────────────
describe('9. contact details and internals are absent', () => {
  it('ignores contact fields even if they somehow reach the builder', () => {
    // They are `select: false` on the model AND excluded by the route's projection.
    // This asserts the third layer: the builder reads an allow-list, so a field added
    // to the schema later cannot appear in a public preview by default.
    const meta = buildListingPreview(
      listing({
        contactPhone: '99887766',
        contactEmail: 'ola@example.no',
        userId: '65b0000000000000000000ff',
        maxApplicants: 3,
      }),
      ID,
      ENV
    );

    const html = renderPreviewHtml(meta);
    for (const secret of ['99887766', 'ola@example.no', '65b0000000000000000000ff']) {
      expect(html).not.toContain(secret);
    }
  });

  it('leaks no SafePay, order or payment vocabulary', () => {
    const html = renderPreviewHtml(
      buildListingPreview(
        listing({ paymentStatus: 'paid', stripeSessionId: 'cs_test_123', orderId: 'ord_1' }),
        ID,
        ENV
      )
    );
    for (const token of ['cs_test_123', 'ord_1', 'paymentStatus', 'stripeSessionId']) {
      expect(html).not.toContain(token);
    }
  });

  it('the only listing id present is the one already in the shared link', () => {
    const html = renderPreviewHtml(buildListingPreview(listing({ _id: 'internal999' }), ID, ENV));
    expect(html).not.toContain('internal999');
    expect(html).toContain(ID); // the canonical URL, which the sharer already has
  });

  it('the route projects only the fields a preview needs', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'routes', 'preview.js'),
      'utf8'
    );
    expect(source).toMatch(/const PREVIEW_FIELDS = 'title description images status'/);
    expect(source).toMatch(/\.select\(PREVIEW_FIELDS\)/);
  });
});

// ── 10 ──────────────────────────────────────────────────────────────────────────
describe('10. malformed or unknown ids are handled safely', () => {
  it.each([
    'not-an-id',
    '123',
    '',
    'undefined',
    'null',
    '../../etc/passwd',
    '507f1f77bcf86cd79943901',  // 23 chars
    '507f1f77bcf86cd7994390111', // 25 chars
    '<script>alert(1)</script>',
  ])('rejects %p before it reaches the database', (bad) => {
    expect(isValidObjectId(bad)).toBe(false);
  });

  it('accepts a real ObjectId', () => {
    expect(isValidObjectId(ID)).toBe(true);
    expect(isValidObjectId(String(new mongoose.Types.ObjectId()))).toBe(true);
  });

  it('does not rely on Mongoose alone to define a valid id', () => {
    // Older Mongoose accepted any 12-character string as an ObjectId, which would have
    // let arbitrary text reach findById. Mongoose 8.21 rejects it, so the guard is not
    // load-bearing against this version — the explicit 24-hex check keeps it true
    // regardless of what a future Mongoose decides.
    expect(mongoose.Types.ObjectId.isValid('jobblo12345x')).toBe(false);
    expect(isValidObjectId('jobblo12345x')).toBe(false);

    // The helper accepts exactly 24 hex characters and nothing else.
    expect(isValidObjectId('507f1f77bcf86cd79943901g')).toBe(false); // 'g' is not hex
    expect(isValidObjectId(' 507f1f77bcf86cd799439011')).toBe(false); // leading space
    expect(isValidObjectId(123)).toBe(false);
    expect(isValidObjectId(null)).toBe(false);
  });

  it('an unknown but well-formed id renders the generic card, not an error', () => {
    const html = renderPreviewHtml(buildListingPreview(null, ID, ENV));
    expect(html).toMatch(/^<!doctype html>/i);
    expect(metaOf(html, 'og:site_name')).toBe('Jobblo');
  });

  it('a hostile id cannot reach the rendered URL', () => {
    // Belt and braces: the route validates first, but if a caller passed one through,
    // it is URL-encoded rather than interpolated raw.
    const url = canonicalListingUrl('"><script>alert(1)</script>', ENV);
    expect(url).not.toContain('<script>');
  });

  it('the route validates before querying', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'routes', 'preview.js'),
      'utf8'
    );
    expect(source).toMatch(/isValidObjectId\(id\)\s*\?/);
  });

  it('answers 200 rather than 404 or 500 in every branch', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'routes', 'preview.js'),
      'utf8'
    );
    // Facebook and LinkedIn frequently decline to render Open Graph on a 404 body, and
    // a cached 500 suppresses the card long after the cause is fixed.
    expect(source).not.toMatch(/status\(404\)/);
    expect(source).not.toMatch(/status\(500\)/);
    expect(source).toMatch(/status\(200\)/);
  });
});

// ── truncate, in isolation ──────────────────────────────────────────────────────
describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('kort', 50)).toBe('kort');
  });

  it('does not add an ellipsis at exactly the limit', () => {
    expect(truncate('abcde', 5)).toBe('abcde');
  });

  it('hard-cuts a single unbroken word rather than emptying the string', () => {
    const out = truncate('a'.repeat(100), 20);
    expect(out.length).toBe(20);
    expect(out.endsWith('…')).toBe(true);
  });

  it('tolerates null and undefined', () => {
    expect(truncate(null, 10)).toBe('');
    expect(truncate(undefined, 10)).toBe('');
  });
});
