import { AppState, Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { WebBrowserOpenOptions } from 'expo-web-browser';
import { createURL } from 'expo-linking';

/**
 * Runs a Google or Vipps sign-in from inside the app, and reports only what it actually
 * observed about the browser trip. It never decides that a sign-in succeeded — that needs a
 * verified profile, which is `completeOAuthSignIn`'s job (src/hooks/useOAuthLoginCompletion).
 *
 * Why this exists: the login screen handed the provider to the *system* browser with
 * `Linking.openURL('<api>/auth/google')`, and the backend's only destination was the
 * website. So the person finished signing in inside Chrome, on jobblo.no, and the app never
 * heard about it. The server side of the fix is utils/oauthReturn.js; this is the client
 * side, and it is deliberately shaped like utils/safepayCheckoutSession.ts because the
 * problem is the same one: get out to a browser, and come back reliably.
 *
 * Three things bring the person back, and they are independent on purpose:
 *
 *  1. `openAuthSessionAsync(startUrl, returnUrl)`. On iOS this is a real
 *     ASWebAuthenticationSession: the callback is delivered to *the session*, the sheet
 *     closes itself, and the app never sees an `openURL` event — so `result.url` is the
 *     only signal there. On Android it is a polyfill that races the Custom Tab against a
 *     redirect listener.
 *  2. Our own `Linking` listener. It matches on the PATH, so it still fires when the
 *     server's configured deep-link prefix and this client's `returnUrl` disagree — a
 *     stale `MOBILE_APP_LINK_PREFIX`, or an Expo Go LAN address that moved. That mismatch
 *     is exactly what left the browser spinning with nothing happening.
 *  3. AppState, for the person who gave up and came back by hand.
 *
 * Nothing here navigates. expo-router listens for the same deep link and does its own
 * routing; two navigators racing over one URL is how duplicate success screens happen.
 */

/** Matches `…/oauth-success`, whatever scheme or prefix carried it. */
const OAUTH_RETURN_PATH = /(?:^|[/:])oauth-success(?:[/?#]|$)/i;

export type OAuthProvider = 'google' | 'vipps';

export type OAuthSessionOutcome =
  /** A return URL reached us. It carries either a token or an error code — parse, do not assume. */
  | { outcome: 'returned'; url: string }
  /** The browser closed, or the app came back, without any return URL. */
  | { outcome: 'dismissed' }
  /** The browser itself refused to open, so no sign-in was ever attempted. */
  | { outcome: 'not_opened' };

/**
 * Where the flow comes back to, resolved AT RUNTIME.
 *
 * `createURL` answers `exp://<metro-host>:8081/--/oauth-success` under Expo Go and
 * `jobblo://oauth-success` in a standalone build, from the `scheme` in app.json. Hardcoding
 * either one breaks the other: a literal `jobblo://oauth-success` never matches in Expo Go,
 * so `openAuthSessionAsync` waited for a redirect that could not arrive and the tab just sat
 * there. Google and Vipps share this function — one place, one answer, both providers.
 */
export function oauthReturnUrl(): string {
  return createURL('oauth-success');
}

/** True for a URL that is a sign-in return, whatever prefix delivered it. */
export function isOAuthReturnUrl(url: string | null | undefined): boolean {
  const route = (url ?? '').split('#')[0] ?? '';
  return OAUTH_RETURN_PATH.test(route);
}

/**
 * The app starts flow endpoints on the explicit mobile route so the server can choose the
 * correct callback destination without accepting a caller-controlled return URL.
 */
export function oauthStartUrl(provider: OAuthProvider, apiBase: string): string {
  return `${apiBase.replace(/\/$/, '')}/auth/mobile/${provider}`;
}

/** Stops a forgotten browser tab holding the flow open forever. */
const GIVE_UP_MS = 5 * 60 * 1000;

/**
 * On Android the Custom Tab cannot be closed programmatically, so the deep link arriving is
 * what foregrounds the app — which also makes `openAuthSessionAsync` resolve `dismiss` at
 * almost the same moment. Waiting a beat before believing "they came back empty-handed"
 * keeps a successful sign-in from being reported as a cancelled one.
 */
const DISMISS_GRACE_MS = 1500;

const BROWSER_OPTIONS: WebBrowserOpenOptions = {
  /**
   * `createTask` is deliberately NOT set, so it keeps its default `true`.
   *
   * That default is what routes the Android Custom Tab through `BrowserProxyActivity` — the
   * translucent trampoline expo-web-browser 57 declares with `taskAffinity=".webContainer"`,
   * which puts the tab in a task of its own. SafePay passes `createTask: false`, which
   * launches the tab directly into Jobblo's task, stacked on top of the very activity the
   * deep link then re-enters — and nothing can take it back off again. The Android module
   * exposes no dismiss function at all (`openBrowserAsync` is its only entry point, and the
   * library's own note reads "Users on Android need to manually press the 'x' button in
   * Chrome Custom Tabs, sadly"), so an abandoned tab sitting in our task is free to draw
   * itself back over the signed-in app. That is precisely the reported symptom: sign-in
   * completed, the app appeared, and then Google's account chooser was back on screen.
   *
   * The proxy activity is therefore the only lifecycle management available: once the tab is
   * left it finishes itself and re-launches Jobblo with `FLAG_ACTIVITY_CLEAR_TOP`, which also
   * covers the back-gesture case that `createTask: false` was originally chosen for.
   */
  showTitle: true,
  toolbarColor: '#122A1C',
  controlsColor: '#2E6641',
  enableBarCollapsing: false,
};

/**
 * Opens the provider and resolves once a return URL has arrived or the person is back
 * without one. Resolving is not a claim about the sign-in — `returned` only means a URL
 * reached us, and that URL may well carry an error code.
 */
export async function runOAuthSession(
  provider: OAuthProvider,
  apiBase: string
): Promise<OAuthSessionOutcome> {
  const returnUrl = oauthReturnUrl();
  const startUrl = oauthStartUrl(provider, apiBase);

  let resolveOutcome: ((result: OAuthSessionOutcome) => void) | null = null;
  const settled = new Promise<OAuthSessionOutcome>((resolve) => {
    resolveOutcome = resolve;
  });

  let finished = false;
  const finish = (result: OAuthSessionOutcome) => {
    if (finished) return;
    finished = true;
    resolveOutcome?.(result);
  };

  /**
   * Close the auth sheet once we have our answer. iOS closes it itself when the callback is
   * delivered to the session, so this only matters when our own listener saw the link first.
   * Android has no dismiss support at all — the native module simply does not expose it, and
   * calling `dismissAuthSession` there throws — so it is skipped rather than swallowed.
   */
  const closeBrowser = () => {
    if (Platform.OS === 'android') return;
    try {
      WebBrowser.dismissAuthSession();
    } catch {
      // No session presented, or nothing to dismiss. Nothing to undo.
    }
  };

  const returnedWith = (url: string) => {
    closeBrowser();
    finish({ outcome: 'returned', url });
  };

  /** Deferred so a redirect landing at the same moment still wins. */
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  const dismissSoon = () => {
    if (finished || dismissTimer) return;
    dismissTimer = setTimeout(() => finish({ outcome: 'dismissed' }), DISMISS_GRACE_MS);
  };

  const giveUp = setTimeout(() => finish({ outcome: 'dismissed' }), GIVE_UP_MS);

  // Signal 2: the app itself receiving the deep link. Path-matched, so a prefix the server
  // and this client disagree about does not silently break the return trip.
  const deepLink = Linking.addEventListener('url', ({ url }) => {
    if (!isOAuthReturnUrl(url)) return;
    returnedWith(url);
  });

  /**
   * Signal 3: the person came back by hand. Android only — iOS keeps the app active for the
   * whole sheet, so finishing on AppState there would abandon somebody still typing their
   * password. Even here it only *starts* the grace timer.
   */
  let wasAway = false;
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active') {
      wasAway = true;
      return;
    }
    if (wasAway && Platform.OS === 'android') dismissSoon();
  });

  try {
    // Signal 1. On iOS this is the ONLY signal: ASWebAuthenticationSession delivers the
    // callback to the session rather than to the app, so no `url` event is ever emitted.
    void WebBrowser.openAuthSessionAsync(startUrl, returnUrl, BROWSER_OPTIONS)
      .then((result) => {
        if (result.type === 'success' && isOAuthReturnUrl(result.url)) {
          returnedWith(result.url);
          return;
        }
        // `cancel` (sheet dismissed) or `dismiss`/`opened` on Android, where it fires as
        // soon as the app is foregrounded — including by the redirect we are waiting for.
        dismissSoon();
      })
      .catch(() => finish({ outcome: 'not_opened' }));

    return await settled;
  } finally {
    clearTimeout(giveUp);
    if (dismissTimer) clearTimeout(dismissTimer);
    appState.remove();
    deepLink.remove();
  }
}

