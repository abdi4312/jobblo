import { toast } from 'react-hot-toast';

/**
 * Share a listing.
 *
 * On a phone this hands off to the operating system's own share sheet, which already
 * contains the apps the person actually uses and needs no permission, no styling and no
 * maintenance from us. Everywhere else it copies the link and says so.
 *
 * Deliberately not a modal full of network buttons. The product has one of those
 * (`components/shared/ShareModal`) on the public listing page; reusing it here would put
 * Facebook, X, WhatsApp and an iframe embed generator into the owner's own management
 * menu, which is not what "Del annonse" means on your own listing — you want the link.
 *
 * The share card work that matters for links pasted into Messenger or Slack is
 * server-rendered Open Graph metadata on the listing route, not buttons in this menu.
 */

/**
 * The canonical public origin for shared links.
 *
 * `window.location.origin` alone is wrong for anything that leaves the browser. It is
 * whatever host the app happens to be served from, which is `http://localhost:5173`
 * in development, a preview host on a branch build, and — if the SPA is ever opened
 * through the API domain — the API host. A link pasted into a chat has to survive
 * being read by somebody else on another machine, and it is also the URL the social
 * crawler will fetch, so it must be the production site.
 *
 * `VITE_PUBLIC_SITE_URL` (for example `https://jobblo.no`) is the canonical value and
 * is what production builds should set. Without it this falls back to the current
 * origin, which keeps local development usable and is correct in production once the
 * variable is configured.
 */
function siteOrigin(): string {
  const importMetaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) ?? {};
  const configured = importMetaEnv.VITE_PUBLIC_SITE_URL ?? (typeof process !== 'undefined' ? process.env?.VITE_PUBLIC_SITE_URL : undefined);

  if (typeof configured === 'string' && /^https?:\/\//i.test(configured.trim())) {
    return configured.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'https://jobblo.no';
}

/**
 * The link a listing is shared as.
 *
 * This uses the `/share/job/:id` path format on purpose. The backend preview
 * route at this path runs its own crawler UA check (see
 * `backend/routes/preview.js` → `isCrawlerUserAgent` + line 89 branch) and
 * answers directly with the server-rendered Open Graph HTML for crawlers, then
 * 302-redirects human visitors to the canonical `/jobs/:id` SPA listing.
 *
 * Using this path means the correct per-listing card is delivered to WhatsApp,
 * Facebook, iMessage etc. regardless of whether the reverse proxy in front of
 * the app has the UA-detect nginx map deployed. The crawler path has no JS
 * requirement, so the backend's own UA regex is the single source of truth.
 *
 * A short `?v=` cache-buster is appended per share. Messaging apps cache OG
 * previews for days or weeks per URL; a unique query per share forces the
 * crawler to re-fetch fresh meta instead of serving a stale card from an
 * earlier version of the listing. The rendered preview HTML still claims the
 * clean `/jobs/:id` URL as canonical via `og:url` and <link rel="canonical">,
 * so the transient query never leaks into search indexes or link equity.
 */
export function listingUrl(serviceId: string): string {
  const base = `${siteOrigin()}/share/job/${encodeURIComponent(serviceId)}`;
  const v = Date.now().toString(36);
  return `${base}?v=${v}`;
}

export function buildSharePayload(serviceId: string, title?: string): ShareData & { text: string } {
  const url = listingUrl(serviceId);
  const resolvedTitle = title?.trim() || 'Oppdrag på Jobblo';
  // `text` is only the URL. The receiving app builds the card (image + title +
  // description) from the link's OG tags, so repeating the title in the message body
  // shows it twice — once as plain text, once inside the card. `title` stays for the
  // OS share-sheet's own header, which apps do not paste into the message.
  const text = url;

  return {
    title: resolvedTitle,
    text,
    url,
  };
}

/**
 * `navigator.share` needs a user gesture and a secure context, and Safari rejects a
 * payload it does not like. Feature-detect with `canShare` where it exists so we do not
 * open a sheet that immediately fails.
 */
function canUseNativeShare(data: ShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function') return navigator.canShare(data);
  return true;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the textarea path below — clipboard access can be refused by
    // permissions policy even where the API exists.
  }

  // Non-secure contexts and older browsers have no Clipboard API at all.
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

/**
 * @returns how the link was shared, so a caller can vary its own feedback if it needs to
 */
export async function shareListing(serviceId: string, title?: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = listingUrl(serviceId);
  const payload = buildSharePayload(serviceId, title);

  if (canUseNativeShare(payload)) {
    try {
      await navigator.share(payload);
      // No toast here. The OS sheet already confirmed the action, and stacking our own
      // banner on top of it reads as a second, unrelated event.
      return 'shared';
    } catch (error) {
      // Dismissing the sheet rejects with AbortError. That is a decision, not a
      // failure, and must not fall through to copying something they chose not to send.
      if ((error as Error)?.name === 'AbortError') return 'shared';
    }
  }

  if (await copyToClipboard(url)) {
    toast.success('Lenken er kopiert');
    return 'copied';
  }

  toast.error('Kunne ikke dele lenken');
  return 'failed';
}
