const crypto = require('crypto');

/**
 * Where a Google or Vipps sign-in ends up — the website, or the mobile app.
 *
 * The provider callbacks (`/api/auth/google/callback`, `/api/auth/vipps/callback`) stay
 * exactly what they are: HTTPS endpoints on this server, registered in the Google Cloud
 * and Vipps portals, performing the code exchange with the client secret. Nothing here
 * changes that, and no provider is ever handed an app scheme as a redirect URI.
 *
 * What changes is the LAST hop. A browser that finished a provider flow has to land
 * somewhere; for the website that is `FRONTEND_URL/oauth-success?token=…`, and for the
 * app it has to be `jobblo://oauth-success?token=…`. A custom scheme cannot be a provider
 * redirect URI, so the arrangement SafePay already uses applies here too: redirect to an
 * HTTPS page on this origin (`GET /api/auth/mobile-return`) which hands off to the app
 * scheme. See controllers/SafePayCheckoutController.js — the env vars, the CSP nonce and
 * the `<meta refresh>` + `location.replace` + tap-able-button trio are deliberately the
 * same, because that is the combination that survives Android Custom Tabs.
 *
 * Which of the two happens is decided by intent recorded server-side at the START of the
 * flow (`?platform=mobile`) and read back at the callback — from the session, and from a
 * `state` token this server signed before the provider was ever contacted. Never from an
 * unsigned parameter on the callback, which arrives via the provider and is trivially
 * forgeable; never from a client-supplied URL, which would be an open redirect with
 * Google as the referrer. Absent or unrecognised means web, so every existing caller —
 * the whole website — is untouched.
 */

/** A deep-link prefix, e.g. `jobblo://`. Deliberately not an http(s) URL. */
const APP_LINK_PREFIX_RE = /^[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]*$/i;
/** The `?error=` vocabulary the callbacks speak: lower snake_case, nothing else. */
const ERROR_CODE_RE = /^[a-z][a-z0-9_]{0,63}$/;
/** Three base64url segments — a JWT and nothing else. */
const ACCESS_TOKEN_RE = /^[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}$/;
/** Real access tokens are a few hundred characters; this rejects only the pathological. */
const ACCESS_TOKEN_MAX = 4096;
/** Code for "nothing more useful can be said than: it did not work". */
const GENERIC_ERROR = 'oauth_failed';
/** The one session key this module owns. */
const SESSION_KEY = 'oauthPlatform';

/** `FRONTEND_URL` is configured with and without a trailing slash across environments. */
function resolveFrontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

/**
 * The app scheme the bridge page hands off to. The SAME variable SafePay already reads —
 * the app being opened is the same app, and a second variable is a second thing to get
 * wrong. `jobblo://` matches the `scheme` declared in jobblo-app/app.json. Expo Go does
 * not register that scheme, so pointing this at `exp://<lan-ip>:8081/--/` makes the very
 * same bridge open a development client instead.
 */
function resolveAppLinkPrefix() {
  const raw = process.env.MOBILE_APP_LINK_PREFIX?.trim() || 'jobblo://';
  if (!APP_LINK_PREFIX_RE.test(raw)) {
    return { error: `MOBILE_APP_LINK_PREFIX is not a usable deep-link prefix: "${raw}"` };
  }
  if (/^https?:\/\//i.test(raw)) {
    return {
      error:
        'MOBILE_APP_LINK_PREFIX must be an app scheme such as jobblo://, not an http(s) URL — ' +
        'the bridge hands off to the app, it is not a general web redirector',
    };
  }
  return { prefix: raw.endsWith('/') ? raw : `${raw}/` };
}

/**
 * Public origin of *this* server, where the bridge page is served from.
 *
 * Configured, not taken from the request: the Host header is client-supplied, and using
 * it would let a caller decide where a completed sign-in is sent. Outside production a
 * request-derived origin is allowed, so a LAN or ngrok dev server needs no extra setup.
 */
function resolveMobileReturnBase(req) {
  const configured = process.env.MOBILE_RETURN_URL?.trim().replace(/\/$/, '');
  if (configured) {
    if (!/^https?:\/\//i.test(configured)) {
      return { error: `MOBILE_RETURN_URL must start with http(s)://, got "${configured}"` };
    }
    return { base: configured };
  }
  if (process.env.NODE_ENV === 'production') {
    return { error: 'MOBILE_RETURN_URL is not set — refusing to derive it from the Host header' };
  }
  const host = req?.get?.('host');
  if (!host) {
    return { error: 'MOBILE_RETURN_URL is not set and the request carries no Host header' };
  }
  return { base: `${req.protocol}://${host}` };
}

/** Absolute URL of the bridge page on this origin. */
function mobileBridgeUrl(req) {
  const origin = resolveMobileReturnBase(req);
  if (origin.error) return { error: origin.error };
  return { url: `${origin.base}/api/auth/mobile-return` };
}

/**
 * The only thing a client gets to say about where it comes back to: `mobile`, or nothing.
 * A closed enum — never a URL. An unrecognised value is logged and treated as web: a
 * redirect endpoint reached by a browser is the wrong place to answer with a 400, and web
 * is the safe direction to fail in.
 */
function readPlatformIntent(req) {
  const raw =
    typeof req?.query?.platform === 'string' ? req.query.platform.trim().toLowerCase() : '';
  if (raw === 'mobile') return 'mobile';
  if (raw && raw !== 'web') {
    console.warn('OAuth: unrecognised platform "%s" — continuing as web', raw);
  }
  return 'web';
}

/**
 * The mobile intent again, this time in a form the provider itself hands back.
 *
 * The session alone was not enough. It is a cookie in whichever browser ran the flow, it is
 * consumed at the callback, and the SECOND attempt from one browser is not like the first:
 * the cookie may have rotated or been dropped, and nothing on the start endpoint's redirect
 * stopped that browser from satisfying the second attempt out of its own cache and never
 * asking this server at all. Either way the callback found no recorded platform, answered
 * `web`, and a phone mid-sign-in was sent to FRONTEND_URL.
 *
 * `state` is the one parameter an OAuth provider is obliged to return untouched, so it is
 * the natural second carrier. This is still not client-supplied intent: the client says
 * `mobile` at the START endpoint and nowhere else, and what goes into `state` is minted and
 * signed HERE, before the provider is contacted. A forged `?state=` cannot claim `mobile`
 * without this server's secret — which is exactly why it can be trusted on a callback where
 * a bare `?platform=` could not be.
 *
 * Web mints nothing at all, so every URL the website sees is byte-identical to before.
 */
const PLATFORM_STATE_TTL_MS = 15 * 60 * 1000;
/** `m.<issuedAt>.<nonce>.<hmac>` — hex throughout, so nothing needs escaping. */
const PLATFORM_STATE_RE = /^m\.(\d{10,15})\.([a-f0-9]{18})\.([a-f0-9]{64})$/;
/**
 * Vipps mints its own `state`; the platform token rides after this separator.
 *
 * A dash, because both halves are hex and neither `URLSearchParams` nor `querystring`
 * percent-encodes it — the value a provider echoes back is then character-for-character the
 * one that was stored, which is what Vipps' constant-time state comparison needs.
 */
const STATE_JOIN = '-';

function platformStateSecret() {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || '';
}

function signPlatformState(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** The token for one flow, or '' for web — which deliberately carries no state at all. */
function mintPlatformState(platform) {
  if (platform !== 'mobile') return '';
  const secret = platformStateSecret();
  if (!secret) {
    console.error('OAuth: no SESSION_SECRET or JWT_SECRET to sign the platform state with');
    return '';
  }
  const payload = `m.${Date.now()}.${crypto.randomBytes(9).toString('hex')}`;
  return `${payload}.${signPlatformState(payload, secret)}`;
}

/**
 * Vipps has its own CSRF state bound to the session. The composite is what gets stored AND
 * what gets compared, so that check stays byte-for-byte what it was; the token simply rides
 * along behind a separator neither half can contain.
 */
function withPlatformState(baseState, platform) {
  const token = mintPlatformState(platform);
  return token ? `${baseState}${STATE_JOIN}${token}` : baseState;
}

/**
 * True only for a token THIS server signed, for mobile, within the last 15 minutes.
 * Compared in constant time; anything malformed, stale or unsigned is simply not mobile.
 */
function platformStateSaysMobile(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return false;
  const secret = platformStateSecret();
  if (!secret) return false;

  const parts = PLATFORM_STATE_RE.exec(raw.slice(raw.lastIndexOf(STATE_JOIN) + 1));
  if (!parts) return false;

  // Negative age means a clock that moved, not a valid future flow; allow only a minute.
  const age = Date.now() - Number(parts[1]);
  if (!(age > -60 * 1000 && age < PLATFORM_STATE_TTL_MS)) return false;

  const expected = Buffer.from(signPlatformState(`m.${parts[1]}.${parts[2]}`, secret), 'hex');
  const actual = Buffer.from(parts[3], 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * A provider start endpoint has to RUN on every attempt: it is where the intent for this
 * flow is recorded and where a fresh state is minted. Its answer is a redirect carrying a
 * one-time authorization request, so there is nothing in it worth reusing and a great deal
 * that goes wrong when a browser does.
 *
 * A response that cannot set headers is skipped rather than thrown at. This is cache
 * hygiene on a redirect, not the sign-in itself, and the alternative is a 500 in the middle
 * of somebody's login for the sake of a header — the same reason `resolveMobileReturnBase`
 * asks `req?.get?.('host')` instead of assuming.
 */
function noStore(res) {
  if (typeof res?.set !== 'function') return;
  res.set({ 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', Expires: '0' });
}

/**
 * Record the intent at the start endpoint, and wait for the store write.
 *
 * Awaited for the same reason `startIduraAuth` awaits it: the provider round-trip can come
 * back before an async session store has finished writing, and a callback that finds no
 * recorded platform sends a phone to the website instead of into the app.
 */
async function rememberOAuthPlatform(req) {
  const platform = readPlatformIntent(req);

  if (!req.session) {
    if (platform === 'mobile') {
      console.error('OAuth: session middleware unavailable; cannot record mobile intent');
    }
    return 'web';
  }

  if (platform === 'mobile') req.session[SESSION_KEY] = 'mobile';
  else delete req.session[SESSION_KEY];

  try {
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );
  } catch (err) {
    console.error('OAuth: could not persist platform intent: %s', err.message);
    return 'web';
  }
  return platform;
}

/**
 * Read the recorded intent at the callback. Two independent carriers, and EITHER one
 * saying `mobile` is enough: the session, which every existing flow has always used, and
 * the signed `state` the provider just handed back. One browser losing its cookie or
 * short-circuiting the start endpoint can take out the first; nothing short of the server
 * secret can take out the second.
 *
 * The session copy stays single use, so a stale `mobile` left by an abandoned attempt
 * cannot capture a later web sign-in from the same browser. The state copy needs no
 * clearing — it is bound to the one authorization request that carried it, and expires.
 *
 * Call this once at the top of the callback, before any early return: a refused sign-in has
 * to reach the app just as much as a successful one does.
 */
function takeOAuthPlatform(req) {
  const stored = req.session?.[SESSION_KEY];
  if (req.session) delete req.session[SESSION_KEY];

  const fromSession = stored === 'mobile';
  const fromState = platformStateSaysMobile(req?.query?.state);

  // Worth a line in the log: it means the browser session did not survive the round trip,
  // which is invisible otherwise and is the difference between working and not for Vipps,
  // whose CSRF state lives in that same session.
  if (fromState && !fromSession) {
    console.warn('OAuth: mobile intent recovered from the signed state, not the session');
  }

  return fromSession || fromState ? 'mobile' : 'web';
}

/**
 * The final destination for one OAuth flow. Pass exactly one of `accessToken` / `error`.
 *
 * `webPath` applies to the website only, where a link conflict belongs on the profile page.
 * The app has ONE arrival screen for both outcomes: two competing success paths is how two
 * navigations end up racing over the same URL.
 *
 * A mobile flow whose bridge cannot be built falls back to the website rather than to a
 * dead end — the person is mid-sign-in and has to land somewhere real. The misconfiguration
 * is logged, not shown.
 */
function oauthDestination({ req, platform, accessToken, error, webPath = 'login' }) {
  const token = typeof accessToken === 'string' ? accessToken.trim() : '';
  const code = ERROR_CODE_RE.test(String(error || '')) ? String(error) : '';

  if (platform === 'mobile') {
    const bridge = mobileBridgeUrl(req);
    if (bridge.url) {
      const params = new URLSearchParams();
      if (token) {
        params.set('state', 'success');
        params.set('token', token);
      } else {
        params.set('state', 'error');
        params.set('code', code || GENERIC_ERROR);
      }
      return `${bridge.url}?${params.toString()}`;
    }
    console.error('OAuth mobile return unavailable: %s', bridge.error);
  }

  const base = resolveFrontendBase();
  if (token) return `${base}/oauth-success?token=${token}`;
  return `${base}/${String(webPath).replace(/^\//, '')}?error=${code || GENERIC_ERROR}`;
}

/**
 * HTML-attribute escaping. Every value interpolated into the page below is already
 * regex-validated, so this is the second lock on the door rather than the first.
 */
function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * The bridge page. Two jobs, in order of reliability: hand off to the app with no
 * interaction at all, and — for the browsers that refuse to launch an external scheme on
 * their own — give the person one obvious thing to tap.
 *
 * That button is not decoration. `expo-web-browser` cannot close an Android Custom Tab
 * programmatically (its own source says so), so what actually returns the user to the app
 * is one explicit deep-link navigation from the page. The page must not auto-launch the
 * scheme: a second browser navigation can leave the provider/custom-tab task eligible to
 * resurface after the app has already taken focus.
 *
 * The deep link appears only inside the anchor attribute, so no token reaches a scripting
 * context. The token is never rendered as text and never logged.
 */
function mobileReturnPage({ nonce, target, failed }) {
  const href = escapeHtml(target);
  const title = target ? 'Åpner Jobblo…' : 'Åpne Jobblo-appen';
  const lead = !target
    ? 'Vi klarte ikke å lage lenken tilbake til appen. Bytt til Jobblo-appen og prøv å logge inn der.'
    : failed
      ? 'Innloggingen ble ikke fullført. Vi tar deg tilbake til appen, der du kan prøve igjen.'
      : 'Vi tar deg tilbake til appen. Innloggingen fullføres der.';
  const hint = target
    ? 'Skjer ingenting? Trykk på knappen over, eller bytt til Jobblo-appen manuelt.'
    : 'Du kan lukke dette vinduet.';

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<style nonce="${nonce}">
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px; background: #EFF0EA; color: #0B0B0B;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif }
  main { width: 100%; max-width: 22rem; background: #fff; border: 1px solid #E6E7E1;
    border-radius: 24px; padding: 32px 24px; text-align: center }
  .brand { margin: 0; font-size: .6875rem; font-weight: 600; letter-spacing: .16em;
    text-transform: uppercase; color: #9B9E96 }
  h1 { margin: .5rem 0 0; font-size: 1.25rem; line-height: 1.3 }
  .lead { margin: .75rem 0 0; font-size: .875rem; line-height: 1.6; color: #63665F }
  .btn { display: block; margin-top: 1.75rem; padding: .875rem 1.25rem;
    border-radius: 9999px; background: #2E6641; color: #fff; font-size: .9375rem;
    font-weight: 600; text-decoration: none }
  .hint { margin: 1rem 0 0; font-size: .75rem; line-height: 1.6; color: #9B9E96 }
</style>
</head>
<body>
<main>
  <p class="brand">Jobblo</p>
  <h1>${title}</h1>
  <p class="lead">${lead}</p>
  ${target ? `<a class="btn" id="app" href="${href}">Åpne Jobblo</a>` : ''}
  <p class="hint">${hint}</p>
</main>
</body>
</html>`;
}

/**
 * PUBLIC (no auth): the HTTPS bridge between a provider callback and the mobile app.
 *
 * Unauthenticated because it is reached by a browser redirect from this server's own
 * callback, inside a Custom Tab that carries no Jobblo credentials of its own. It reads no
 * database, asserts no outcome, and reflects only values that already match a strict shape.
 *
 * Everything is re-validated here even though this server generated the URL: these are
 * query parameters on a public endpoint, so at this point they are attacker-controlled
 * strings that merely usually come from us. A token that fails the shape check is dropped
 * and the app is told the sign-in failed — never fabricate a success.
 */
function mobileReturn(req, res) {
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    // Nothing here may be cached, indexed, or leaked onwards as a referrer: the query
    // string carries an access token.
    'Cache-Control': 'no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  });

  const query = req.query || {};
  const pick = (value) => (typeof value === 'string' ? value.trim() : '');
  const rawToken = pick(query.token);
  const failed = pick(query.state) === 'error';

  const token =
    !failed && rawToken.length <= ACCESS_TOKEN_MAX && ACCESS_TOKEN_RE.test(rawToken)
      ? rawToken
      : '';
  const code = ERROR_CODE_RE.test(pick(query.code)) ? pick(query.code) : '';

  const link = resolveAppLinkPrefix();
  // Something meaningful arrived: either a usable token or a known error code.
  const usable = !!token || !!code;

  let target = '';
  if (link.error) {
    console.error('OAuth mobileReturn: %s', link.error);
  } else if (token) {
    // Group segments like `(auth)` are omitted from expo-router URLs, so this resolves to
    // app/(auth)/oauth-success.tsx — the single canonical arrival screen. Both charsets are
    // URL-safe by construction, so no encoding step is needed.
    target = `${link.prefix}oauth-success?token=${token}`;
  } else {
    target = `${link.prefix}oauth-success?error=${code || GENERIC_ERROR}`;
  }

  const nonce = crypto.randomBytes(16).toString('base64');
  res.set(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'nonce-${nonce}'; img-src 'none'; ` +
      `base-uri 'none'; form-action 'none'`
  );

  // A page renders in every case — somebody is standing in front of it, mid-sign-in — but
  // the status code separates "we are misconfigured" from "those parameters were unusable"
  // for whoever reads the logs.
  const status = link.error ? 500 : usable ? 200 : 400;
  res.status(status).send(mobileReturnPage({ nonce, target, failed: failed || !token }));
}

module.exports = {
  mobileReturn,
  oauthDestination,
  rememberOAuthPlatform,
  takeOAuthPlatform,
  mintPlatformState,
  withPlatformState,
  noStore,
  resolveAppLinkPrefix,
  resolveMobileReturnBase,
};
