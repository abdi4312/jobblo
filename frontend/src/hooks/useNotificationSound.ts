import { playNotificationSound } from '../features/notifications/sound';

/**
 * Backwards-compatible shim over `features/notifications/sound`.
 *
 * This file used to own the audio itself, and its autoplay "unlock" is why signing in
 * made a noise:
 *
 *     audio.muted = true;
 *     audio.play()
 *       .then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; })
 *       .catch(() => { audio.muted = false; });
 *
 * The intent was to prime the element silently on the first click. But the hook was not
 * mounted on the login screen — App hides the header there — so the listeners only
 * attached *after* the redirect, and the first gesture they saw was the user's first click
 * inside the app. If that `play()` was rejected for want of a gesture, the `catch` unmuted
 * an element the browser had already queued and it started audibly a moment later; if it
 * resolved, the unmute raced the `pause()`. Either way the tone escaped right after
 * signing in, when nothing had happened.
 *
 * The engine behind this shim never calls `play()` to prime anything — it resumes an
 * `AudioContext` and decodes the file, neither of which makes a sound. Audio is only ever
 * produced by an explicit call.
 *
 * `playSendSound`, `playAlertSound` and `playCustomSound` are gone. The first played a
 * tone when *you* sent a message, which is feedback for an action you just took and
 * already saw the result of; the other two had no callers left once notification audio
 * moved to `NotificationRealtime`. One function remains, for one event: a message arrived
 * from someone else.
 */

export const useNotificationSound = () => api;

const api = {
  /** An incoming chat message from someone else. See the guard in `Header`. */
  playMessageSound: playNotificationSound,
} as const;
