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

/** The link a listing is shared as. Absolute, because it leaves the app. */
export function listingUrl(serviceId: string): string {
  return `${window.location.origin}/job-listing/${serviceId}`;
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
  const payload: ShareData = { title: title || 'Oppdrag på Jobblo', url };

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
