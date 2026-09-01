/**
 * Error-copy mapping for the dispute flow. Kept out of the service layer so screens
 * can render Norwegian messages without importing anything that talks to the API.
 *
 * 401 is deliberately absent: the axios interceptor in src/api/client.ts owns the
 * session teardown for 401 alone. 403/404/500/network failures stay in-screen.
 */
export function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  return (error.response as { status?: number } | undefined)?.status;
}

export function serverMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const data = (error.response as { data?: { error?: string; message?: string } } | undefined)?.data;
  const raw = data?.error ?? data?.message;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/** True when the failure is transport-level (no HTTP response at all). */
export function isNetworkError(error: unknown): boolean {
  return httpStatus(error) === undefined;
}

/** The backend rejects a second dispute on the same order with a 400 carrying this text. */
export function isDuplicateDisputeError(error: unknown): boolean {
  return /allerede en aktiv tvist/i.test(serverMessage(error) ?? '');
}

/** The backend rejects messages on a terminal dispute with exactly this text. */
export function isDisputeClosedError(error: unknown): boolean {
  return /tvisten er avsluttet/i.test(serverMessage(error) ?? '');
}

export function disputeErrorMessage(error: unknown, fallback: string): string {
  const status = httpStatus(error);
  if (status === 403) return 'Du har ikke tilgang til denne tvisten.';
  if (status === 404) return 'Tvisten ble ikke funnet.';
  if (status === undefined) return 'Ingen nettverksforbindelse. Sjekk tilkoblingen og prøv igjen.';
  // 400s carry actionable validation text from the API; 500s must not leak internals.
  if (status >= 500) return 'Noe gikk galt hos oss. Prøv igjen om litt.';
  return serverMessage(error) ?? fallback;
}
