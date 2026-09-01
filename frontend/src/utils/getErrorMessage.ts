/**
 * Turns anything thrown by an axios call into a single Norwegian string safe to
 * hand to `toast.error()` or render as a React child.
 *
 * The backend speaks two error shapes: the legacy `{ error: 'text' }` string and
 * the newer envelope `{ success: false, error: { code, referenceId, message } }`
 * (backend/app.js). Passing the envelope straight to `toast.error()` throws
 * "Objects are not valid as a React child", so every caller must go through here.
 *
 * When the server gave us no usable text we fall back on the status code, because
 * "Bildene er for store" is actionable and "Noe gikk galt" is not.
 */

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'Noen av opplysningene mangler eller er ugyldige. Kontroller feltene og prøv igjen.',
  401: 'Du er ikke lenger innlogget. Logg inn på nytt og prøv igjen.',
  403: 'Du har ikke tilgang til å gjøre dette.',
  404: 'Vi fant ikke det du prøvde å åpne. Det kan ha blitt slettet.',
  409: 'Dette er allerede registrert.',
  413: 'Filene er for store. Prøv med færre eller mindre bilder.',
  429: 'For mange forsøk. Vent litt og prøv igjen.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Pulls a human-readable string out of a response body of either shape. */
function readBody(data: unknown): string | null {
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (!isRecord(data)) return null;

  const { error, message } = data;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof message === 'string' && message.trim()) return message.trim();
  return null;
}

export function getErrorMessage(err: unknown, fallback = 'Noe gikk galt. Prøv igjen.'): string {
  if (!isRecord(err)) return fallback;

  const response = isRecord(err.response) ? err.response : null;

  // No response at all: the request never reached the server.
  if (!response) {
    if (err.code === 'ECONNABORTED') return 'Forespørselen tok for lang tid. Prøv igjen.';
    if (err.code === 'ERR_NETWORK') {
      return 'Ingen kontakt med serveren. Sjekk internettforbindelsen og prøv igjen.';
    }
    return fallback;
  }

  const fromBody = readBody(response.data);
  if (fromBody) return fromBody;

  const status = typeof response.status === 'number' ? response.status : 0;
  if (STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];
  if (status >= 500) return 'Noe gikk galt hos oss. Prøv igjen om litt.';

  return fallback;
}

export default getErrorMessage;
