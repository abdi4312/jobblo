import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { queryKeys } from '@/queryKeys';
import { fetchProfileWithToken, isUsableAuthToken } from '@/services/auth.service';
import { oauthErrorMessage } from '@/utils/oauthErrors';

/**
 * Turning a finished Google or Vipps trip into a signed-in session — exactly once.
 *
 * Two independent observers can see the same return, and on different platforms different
 * ones do. On iOS the callback is delivered to ASWebAuthenticationSession, so the login
 * screen's `runOAuthSession` is the only thing that sees it. On Android the app receives a
 * real deep link, so expo-router also routes to app/(auth)/oauth-success.tsx and that screen
 * sees it too. Both call `completeOAuthSignIn`, and it is single-flight per token: the second
 * caller joins the first one's promise instead of firing a second profile request and a
 * second `authStore.login`.
 *
 * Nothing here navigates. `app/(auth)/_layout.tsx` redirects to `/(app)` the moment
 * `isAuthenticated` flips, from whichever screen the person is actually looking at.
 */

/** The `?error=` vocabulary the backend emits: lower snake_case. */
const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;

export type OAuthReturnParams = {
  token?: string | string[] | null;
  error?: string | string[] | null;
};

export type ParsedOAuthReturn =
  | { kind: 'success'; token: string }
  | { kind: 'error'; code: string }
  /** Neither a usable token nor a known code — a truncated or mangled link. */
  | { kind: 'unusable' };

/** expo-router hands repeated query keys over as arrays; take the first. */
function first(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0].trim() : '';
  return typeof value === 'string' ? value.trim() : '';
}

export function parseOAuthParams(params: OAuthReturnParams): ParsedOAuthReturn {
  const token = first(params.token);
  const code = first(params.error);
  // A token is only ever acted on when the server sent no error alongside it, and only when
  // it has the shape of a token. Never fabricate a session out of a malformed link.
  if (!code && isUsableAuthToken(token)) return { kind: 'success', token };
  if (ERROR_CODE.test(code)) return { kind: 'error', code };
  return { kind: 'unusable' };
}

/**
 * Same thing from a raw deep link, for the caller that holds the URL rather than router
 * params. Parsed by hand: React Native's `URLSearchParams` polyfill throws on `get`, and the
 * fragment is dropped first so nothing after a `#` can supply a false match.
 */
export function parseOAuthReturnUrl(url: string): ParsedOAuthReturn {
  const route = (url ?? '').split('#')[0] ?? '';
  const at = route.indexOf('?');
  const params: OAuthReturnParams = {};
  if (at !== -1) {
    for (const pair of route.slice(at + 1).split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const rawKey = eq === -1 ? pair : pair.slice(0, eq);
      const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
      let key = rawKey;
      let value = rawValue;
      try {
        key = decodeURIComponent(rawKey);
        value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      } catch {
        // Malformed percent-encoding: keep the raw value and let validation reject it.
      }
      if (key === 'token' || key === 'error') params[key] = value;
    }
  }
  return parseOAuthParams(params);
}

export type OAuthCompletion =
  | { status: 'signed-in' }
  | { status: 'failed'; message: string };

/**
 * One entry per token, at module scope so it survives a screen unmounting mid-flight.
 *
 * Successful entries are kept: a late second observer joining an already-resolved promise is
 * the whole point, and evicting would let it run the sign-in a second time — a second
 * `/auth/profile` request and a second `authStore.login`, which clears the session before
 * re-creating it. Failures ARE evicted, so a token stays retryable if the network was the
 * only thing wrong. A kept success is re-checked against the store below, because the link
 * that produced it can be tapped again after a sign-out.
 */
const completions = new Map<string, Promise<OAuthCompletion>>();

const GENERIC_FAILURE = 'Innloggingen mislyktes. Prøv igjen.';

/**
 * Verify a token with the server, then create the session. This is the ONLY place a mobile
 * OAuth sign-in becomes real.
 *
 * The token arrives in a deep link, so it is a claim until `/auth/profile` answers with the
 * account it belongs to. The user object is that answer — never a JWT payload decoded
 * locally, and never a shape invented from the fields a screen happens to need.
 */
export async function completeOAuthSignIn(
  input: ParsedOAuthReturn | string
): Promise<OAuthCompletion> {
  const parsed = typeof input === 'string' ? parseOAuthReturnUrl(input) : input;

  if (parsed.kind === 'error') {
    return { status: 'failed', message: oauthErrorMessage(parsed.code) ?? GENERIC_FAILURE };
  }
  if (parsed.kind === 'unusable') {
    return { status: 'failed', message: GENERIC_FAILURE };
  }

  const existing = completions.get(parsed.token);
  if (existing) {
    const result = await existing;
    /**
     * A resolved success is only still true while a session actually exists. The bridge page
     * can outlive the one it created — it stays in the browser's recents, inviting a tap on
     * "Åpne Jobblo" long after a sign-out — and handing back the old promise then would report
     * a session that is gone, leaving the arrival screen waiting for a redirect that never
     * comes. Re-run instead, and let the server say whether the token is still good.
     */
    if (result.status === 'failed' || useAuthStore.getState().isAuthenticated) {
      return result;
    }
    completions.delete(parsed.token);
  }

  const run = (async (): Promise<OAuthCompletion> => {
    const user = await fetchProfileWithToken(parsed.token);
    await useAuthStore.getState().login(parsed.token, user);
    return { status: 'signed-in' as const };
  })().catch(() => {
    // Retryable: the token may be fine and the network not.
    completions.delete(parsed.token);
    return { status: 'failed' as const, message: GENERIC_FAILURE };
  });

  completions.set(parsed.token, run);
  return run;
}

/**
 * Runs the completion for a screen and reports where it got to.
 *
 * The query cache is seeded here rather than inside `completeOAuthSignIn` because a
 * `QueryClient` only exists inside the provider tree, while the completion itself has to be
 * callable from a plain async function. Seeding twice is harmless — it is the same object
 * under the same key — and skipping it entirely would leave the first profile read to refetch
 * something the app already has.
 */
export function useOAuthLoginCompletion(params: OAuthReturnParams) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<'working' | 'signed-in' | 'failed'>('working');
  const [message, setMessage] = useState<string | null>(null);

  const token = first(params.token);
  const errorCode = first(params.error);

  useEffect(() => {
    let active = true;

    void completeOAuthSignIn(parseOAuthParams({ token, error: errorCode })).then((result) => {
      if (!active) return;
      if (result.status === 'signed-in') {
        const user = useAuthStore.getState().user;
        if (user) queryClient.setQueryData(queryKeys.auth.profile, user);
        setState('signed-in');
        setMessage(null);
        return;
      }
      setState('failed');
      setMessage(result.message);
    });

    return () => {
      active = false;
    };
  }, [token, errorCode, queryClient]);

  return { state, message } as const;
}

