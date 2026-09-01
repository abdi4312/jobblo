import { AppState, Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { WebBrowserOpenOptions } from 'expo-web-browser';
import type { SafePaySessionStatusResponse } from '../types/SafePay';

/**
 * Runs a Stripe Checkout session from inside the app, and decides on the server's word
 * alone whether it was paid.
 *
 * Why this exists: the checkout screen handed the payment to the *system* browser with
 * `Linking.openURL(session.url)`, and Stripe's `success_url` was a plain website URL owned
 * by the web app. Together those two facts meant the customer finished paying inside
 * Chrome/Safari on the website, with no path back — the app never learned the payment had
 * happened and the user was simply left in another app.
 *
 * Two things bring them back, and they are deliberately independent:
 *
 *  1. The return trip. `POST /create-session` is called with `platform: 'mobile'`, so the
 *     server builds its own return URLs and points Stripe at an HTTPS page that hands off
 *     to `jobblo://safepay/success?session_id=…&orderId=…`. Stripe will not accept a custom
 *     scheme as a return URL, which is why the hand-off needs that page. The `url` listener
 *     below is what notices the arrival.
 *  2. The fallbacks, for when redirect delivery fails: Checkout opens in an *in-app* browser
 *     so Jobblo is the thing the sheet sits on top of and closing it IS the return; plus a
 *     status poll and an AppState check.
 *
 * Every one of those paths ends in the same place — `GET /api/safepay-checkout/status/:id`.
 * Nothing here infers a payment from a browser closing or from a deep link arriving.
 */

/** Mongo ObjectId — what every `:orderId` route segment expects. */
const ORDER_ID = /^[a-f\d]{24}$/i;
/** Stripe Checkout Session id — what `GET /status/:sessionId` expects. */
const SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

/**
 * Guards for values that arrive from a URL. A deep link can carry the literal strings
 * `"undefined"`, `"null"` or `"[object Object]"`, all of which are truthy — so an
 * `enabled: !!id` check happily fires a request for a nonsense id. These reject that
 * before it reaches the network.
 */
export function isValidOrderId(value: unknown): value is string {
  return typeof value === 'string' && ORDER_ID.test(value.trim());
}

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value.trim());
}

/**
 * Fallback source for the session id, used only when the order document does not carry one
 * yet. Stripe puts the id in the Checkout URL's path
 * (`https://checkout.stripe.com/c/pay/cs_live_…#fid…`); the fragment is dropped first so
 * its opaque payload cannot supply a false match.
 */
export function sessionIdFromCheckoutUrl(url: string): string | null {
  const path = url.split('#')[0] ?? '';
  return path.match(/cs_(?:test|live)_[A-Za-z0-9]+/)?.[0] ?? null;
}

export type CheckoutOutcome =
  /** The server said `paid`. The only shape the caller may treat as success. */
  | { outcome: 'paid'; sessionId: string; status: SafePaySessionStatusResponse }
  /** Customer left Checkout without a confirmed payment, or we could not confirm one. */
  | { outcome: 'unconfirmed'; status: SafePaySessionStatusResponse | null }
  /** The browser itself refused to open, so no payment was ever attempted. */
  | { outcome: 'not_opened' };

type RunOptions = {
  checkoutUrl: string;
  /** `null` when no session id could be resolved; the flow still runs, unverifiable. */
  sessionId: string | null;
  /** Server check, injected so this module needs neither the api client nor the cache. */
  verify: (sessionId: string) => Promise<SafePaySessionStatusResponse>;
};

const POLL_MS = 2500;
/** Stops a forgotten tab polling forever. Well past any real card entry. */
const GIVE_UP_MS = 15 * 60 * 1000;

const BROWSER_OPTIONS: WebBrowserOpenOptions = {
  // Android: keep the Custom Tab inside *our* task. With the default (`true`) it becomes a
  // separate task and the back gesture drops the customer on the home screen instead of
  // back into Jobblo — which is the visible half of the bug being fixed here.
  createTask: false,
  showTitle: true,
  toolbarColor: '#122A1C',
  controlsColor: '#2E6641',
  enableBarCollapsing: false,
};

/**
 * Opens Checkout and resolves once the customer's payment has either been confirmed by the
 * server or the customer has come back without one. Never resolves `paid` on any signal
 * other than the server's own `payment_status`.
 */
export async function runStripeCheckout({
  checkoutUrl,
  sessionId,
  verify,
}: RunOptions): Promise<CheckoutOutcome> {
  let resolveOutcome: ((result: CheckoutOutcome) => void) | null = null;
  const settled = new Promise<CheckoutOutcome>((resolve) => {
    resolveOutcome = resolve;
  });

  let finished = false;
  const finish = (result: CheckoutOutcome) => {
    if (finished) return;
    finished = true;
    resolveOutcome?.(result);
  };

  let lastStatus: SafePaySessionStatusResponse | null = null;

  /**
   * The single place a payment may be declared successful.
   *
   * Errors are swallowed deliberately: a 404 while Stripe propagates a fresh session, or a
   * dropped connection while the browser held focus, must not end the flow — every exit
   * path below asks once more. Note this endpoint is also what *confirms* the order
   * server-side, so calling it is how a payment gets reconciled when the Stripe webhook
   * cannot reach this environment.
   */
  const askServer = async (): Promise<boolean> => {
    if (!sessionId) return false;
    try {
      const status = await verify(sessionId);
      lastStatus = status;
      if (status.payment_status !== 'paid') return false;
      finish({ outcome: 'paid', sessionId, status });
      try {
        // Closes the sheet on iOS. On Android the native module has no `dismissBrowser`,
        // so this is a no-op and the customer's own back gesture closes the tab — landing
        // them on the screen the caller has already routed to.
        await WebBrowser.dismissBrowser();
      } catch {
        // No browser presented, or no dismiss support here. Nothing to undo.
      }
      return true;
    } catch {
      return false;
    }
  };

  const poll = setInterval(() => void askServer(), POLL_MS);
  const giveUp = setTimeout(() => finish({ outcome: 'unconfirmed', status: lastStatus }), GIVE_UP_MS);

  /**
   * Android reports background → active when the customer leaves the Custom Tab, and that
   * is the only dependable "they are back" signal there: `openBrowserAsync` resolves the
   * instant the tab *opens* rather than when it closes. iOS keeps the app active for the
   * whole sheet, so finishing on AppState there would abandon a customer who was still
   * typing their card details — hence the platform check before giving up.
   */
  let wasAway = false;
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active') {
      wasAway = true;
      return;
    }
    void askServer().then((paid) => {
      if (paid || !wasAway || Platform.OS !== 'android') return;
      finish({ outcome: 'unconfirmed', status: lastStatus });
    });
  });

  /**
   * The deep link Stripe's return page hands off to (`jobblo://safepay/…`). This is the fast
   * signal: it arrives the moment the OS switches back to Jobblo, without waiting for the
   * next poll tick or for AppState to settle, and it behaves the same on both platforms.
   *
   * It is never treated as proof of payment. Whichever way the link points, the answer comes
   * from `askServer()`. A cancel link is what the customer chose, so it ends the flow
   * unconfirmed; a success link the server will not confirm leaves the poll running, because
   * the redirect can beat Stripe's own bookkeeping by a second or two.
   *
   * expo-router listens for the same event and does the actual navigation. Nothing navigates
   * from here — two navigators racing over one URL is how duplicate success screens happen.
   */
  const deepLink = Linking.addEventListener('url', ({ url }) => {
    const route = (url ?? '').split('#')[0] ?? '';
    if (!/\/safepay\/(success|checkout)/i.test(route)) return;
    const cancelled = /\/safepay\/checkout/i.test(route);
    void askServer().then((paid) => {
      if (paid || !cancelled) return;
      finish({ outcome: 'unconfirmed', status: lastStatus });
    });
  });

  try {
    void WebBrowser.openBrowserAsync(checkoutUrl, BROWSER_OPTIONS)
      .then(async (result) => {
        // Android resolves `opened` immediately, which says nothing about the payment, so
        // it is ignored there. iOS resolves on close: `cancel` when the customer dismissed
        // the sheet, `dismiss` when `askServer` closed it after a confirmed payment.
        if (Platform.OS === 'android' || result.type === 'opened') return;
        if (await askServer()) return;
        finish({ outcome: 'unconfirmed', status: lastStatus });
      })
      .catch(() => finish({ outcome: 'not_opened' }));

    return await settled;
  } finally {
    clearInterval(poll);
    clearTimeout(giveUp);
    appState.remove();
    deepLink.remove();
  }
}

