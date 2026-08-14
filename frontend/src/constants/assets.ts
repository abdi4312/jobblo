/**
 * Bundled fallback assets.
 *
 * Every default avatar in the app pointed at an `api.builder.io/.../TEMP/...`
 * URL — a design-tool CDN, serving a placeholder that was never meant to ship,
 * as a hard production dependency for anyone without a profile picture. The
 * banner default came from Unsplash the same way.
 *
 * These are inline data URIs, so they cost no request and cannot 404.
 */

/** Neutral avatar: grey circle with a person glyph. */
export const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <circle cx="48" cy="48" r="48" fill="#e6e6e6"/>
      <circle cx="48" cy="38" r="16" fill="#b4b4b4"/>
      <path d="M16 88a32 32 0 0 1 64 0z" fill="#b4b4b4"/>
    </svg>`.replace(/\s+/g, ' ')
  );

/** Muted green gradient used where a profile has no banner of its own. */
export const DEFAULT_BANNER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" width="1200" height="300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a3a1a"/>
          <stop offset="100%" stop-color="#2d7a4d"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="300" fill="url(#g)"/>
    </svg>`.replace(/\s+/g, ' ')
  );
