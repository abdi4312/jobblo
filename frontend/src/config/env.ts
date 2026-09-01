/**
 * Single source of truth for environment-derived URLs.
 *
 * Vite inlines `import.meta.env.*` at build time, so a production build that was
 * made without `VITE_MAIN_URL` used to bake `http://localhost:5000` into the
 * bundle: the app rendered, then every single request was blocked as mixed
 * content, with no diagnostic anywhere. Callers that had no fallback at all were
 * worse — they produced literal `undefined/api/auth/google` URLs.
 *
 * `scripts/check-env.mjs` fails the production build when this is unset, which is
 * where the problem should surface. The same-origin fallback below is the
 * last-resort net for a build that somehow slipped past it: same-origin requests
 * at least reach a server and fail visibly instead of being silently blocked.
 */

const rawApiUrl = import.meta.env.VITE_MAIN_URL as string | undefined;

function resolveApiBaseUrl(): string {
  const configured = rawApiUrl?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (import.meta.env.DEV) return 'http://localhost:5000';

  console.error(
    '[jobblo] VITE_MAIN_URL is not set in this production build. ' +
      'Falling back to the current origin — API calls will fail if the backend is hosted elsewhere.'
  );
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Absolute base URL of the API, never with a trailing slash. */
export const API_BASE_URL = resolveApiBaseUrl();

/** True when the build has no explicit API URL configured. */
export const IS_API_URL_CONFIGURED = !!rawApiUrl?.trim();

/** Builds an absolute API URL for the cases that can't go through axios (OAuth redirects). */
export const apiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
