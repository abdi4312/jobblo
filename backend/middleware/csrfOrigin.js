/**
 * Cross-site request forgery guard for state-changing requests.
 *
 * Auth rides on cookies (accessToken / refreshToken / the express session), and in
 * production they are `SameSite=None`, so a browser attaches them to requests from ANY
 * site. CORS does not help: it only stops the attacker READING a response — a plain
 * form POST (urlencoded or multipart) still reaches the handler with the victim's
 * cookies. This guard rejects those before any body parsing or handler runs.
 *
 * Policy for POST / PUT / PATCH / DELETE (everything except GET, HEAD, OPTIONS):
 *
 *   1. `Origin` present  -> must be on the explicit allowlist. `null` (sandboxed
 *      iframes, data: URLs, cross-origin redirects) is never allowed.
 *   2. No `Origin`, but the request is visibly from a browser (`Referer` or
 *      `Sec-Fetch-Site`) -> allowed only if the Referer's origin is allowlisted or
 *      the browser says `Sec-Fetch-Site: same-origin`.
 *   3. None of those headers -> not a browser: the mobile app (React Native sends no
 *      Origin and keeps its own cookie jar), server-to-server, curl. Allowed. A web page
 *      cannot produce this: browsers attach `Origin` to every cross-origin unsafe
 *      request, so an attacker's page lands in rule 1.
 *
 * The allowlist is the same one CORS uses; Host / X-Forwarded-Host are never consulted.
 * Applied regardless of cookies so cross-site login/register form posts (login CSRF)
 * are refused too.
 *
 * ponytail: rule 3 assumes a browser that sends `Origin` on unsafe cross-origin requests
 * (Chrome 79+, Firefox 70+, Safari 15+). Older browsers would need a CSRF token.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function createCsrfOriginGuard(allowedOrigins) {
  const allowed = new Set(allowedOrigins.map((o) => o.replace(/\/$/, '')));

  const reject = (res, reason) => {
    console.warn('CSRF: rejected cross-site request (%s)', reason);
    return res.status(403).json({
      error: 'Forespørselen ble avvist.',
      code: 'CSRF_ORIGIN_REJECTED',
    });
  };

  return function csrfOriginGuard(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.headers.origin;
    if (origin !== undefined) {
      return allowed.has(String(origin).replace(/\/$/, ''))
        ? next()
        : reject(res, `origin ${String(origin).slice(0, 100)}`);
    }

    const referer = req.headers.referer;
    const fetchSite = req.headers['sec-fetch-site'];
    if (referer === undefined && fetchSite === undefined) return next(); // non-browser client

    if (referer !== undefined && allowed.has(originOf(referer))) return next();
    if (fetchSite === 'same-origin') return next();
    return reject(res, 'no origin, untrusted referer');
  };
}

module.exports = { createCsrfOriginGuard };
