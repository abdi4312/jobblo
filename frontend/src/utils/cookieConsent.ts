/**
 * Cookie consent state, shared by the banner and the ad loader.
 *
 * Previously the banner wrote 'accepted' or 'customised' to localStorage and
 * nothing ever read it: Google AdSense was loaded unconditionally from index.html
 * before the visitor had answered, and there was no way to say no. Under
 * GDPR/ePrivacy that is consent after the fact.
 */

export const CONSENT_KEY = 'cookie-consent';

export type CookieConsent = 'accepted' | 'rejected' | null;

export function getCookieConsent(): CookieConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'accepted' || value === 'rejected') return value;
    // 'customised' was written by the old banner without recording any actual
    // choice. Treat it as unanswered so those users get asked once, properly.
    return null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: Exclude<CookieConsent, null>): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* private mode — the banner will simply ask again next visit */
  }
  if (value === 'accepted') loadAdsense();
}

let adsenseLoaded = false;

/** Injects the AdSense tag. Only ever called after an explicit accept. */
export function loadAdsense(): void {
  if (adsenseLoaded || typeof document === 'undefined') return;
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
  if (!client) return;

  adsenseLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.appendChild(script);
}

/** Called once at startup so a returning visitor who accepted still gets ads. */
export function initCookieConsent(): void {
  if (getCookieConsent() === 'accepted') loadAdsense();
}
