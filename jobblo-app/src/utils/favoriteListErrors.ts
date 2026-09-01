/**
 * Maps a failed `/api/lists` request to a Norwegian sentence.
 *
 * Nothing the server writes is ever rendered. The backend's `message` fields are English
 * developer strings and its 500 bodies used to forward raw Mongoose text, so the mapping
 * keys off the stable machine `code` added in `backend/controllers/listController.js`,
 * then falls back to the HTTP status. `error.message` and stack traces never reach the
 * screen.
 *
 * 401 is not mapped to a logout here: `src/api/client.ts` already clears the stored
 * token on 401, and a network failure or a 500 must never sign the user out.
 */

const CODE_MESSAGES: Record<string, string> = {
  invalid_list_name: 'Listenavnet må fylles ut og kan være maks 60 tegn.',
  invalid_id: 'Noe stemmer ikke med lenken. Gå tilbake og prøv igjen.',
  list_not_found: 'Vi fant ikke listen. Den kan være slettet, eller du har ikke tilgang.',
  service_not_found: 'Oppdraget finnes ikke lenger og kunne ikke lagres.',
  service_already_in_list: 'Allerede lagret i denne listen.',
  contributor_cannot_remove_others: 'Bare eieren av listen kan fjerne andre deltakere.',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Noen av opplysningene mangler eller er ugyldige. Kontroller feltene og prøv igjen.',
  401: 'Du er ikke lenger innlogget. Logg inn på nytt og prøv igjen.',
  403: 'Du har ikke tilgang til å gjøre dette.',
  404: 'Vi fant ikke listen. Den kan være slettet, eller du har ikke tilgang.',
  409: 'Dette er allerede lagret.',
  429: 'For mange forsøk. Vent litt og prøv igjen.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The stable `code` from the response body, when the server sent one. */
export function favoriteListErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const response = isRecord(error.response) ? error.response : null;
  const data = response && isRecord(response.data) ? response.data : null;
  return typeof data?.code === 'string' ? data.code : null;
}

/** True when the failure is specifically "this service is already in this list". */
export function isAlreadyInListError(error: unknown): boolean {
  return favoriteListErrorCode(error) === 'service_already_in_list';
}

export function favoriteListErrorMessage(
  error: unknown,
  fallback = 'Noe gikk galt. Prøv igjen.'
): string {
  if (!isRecord(error)) return fallback;

  const response = isRecord(error.response) ? error.response : null;

  // No response at all — the request never reached the server.
  if (!response) {
    if (error.code === 'ECONNABORTED') return 'Forespørselen tok for lang tid. Prøv igjen.';
    return 'Ingen kontakt med serveren. Sjekk internettforbindelsen og prøv igjen.';
  }

  const code = favoriteListErrorCode(error);
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const status = typeof response.status === 'number' ? response.status : 0;
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return 'Noe gikk galt hos oss. Prøv igjen om litt.';

  return fallback;
}
