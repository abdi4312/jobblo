import { playNotificationSound, playUiSound } from '../features/notifications/sound';

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
 * an element the browser had already queued, and it started audibly a moment later. If it
 * resolved, the unmute raced the `pause()`. Either way the tone escaped, at a moment when
 * nothing had happened — right after signing in.
 *
 * The engine behind this shim never calls `play()` to prime anything. It resumes an
 * `AudioContext` and decodes the file; neither makes a sound, so there is no silent play to
 * leak. Sound is only ever produced by an explicit call below.
 *
 * The three functions were already the same file (`SOUND_CONFIG` mapped `message`, `send`
 * and `alert` to one mp3), so nothing is lost by routing them to one engine — and they now
 * share a rate limiter, which means an incoming chat message and its notification can no
 * longer double-play.
 *
 * Stable module-level identities: `Header` lists `playMessageSound` in an effect's
 * dependencies, and a new closure per render would resubscribe the chat socket every time.
 */

export type SoundType = 'message' | 'send' | 'alert';

const api = {
  /** An incoming chat message. */
  playMessageSound: playNotificationSound,
  /** Your own outgoing message — quieter, and repeatable at typing speed. */
  playSendSound: playUiSound,
  /** A notification. Kept for callers that predate `NotificationRealtime`. */
  playAlertSound: playNotificationSound,
  playCustomSound: (type: SoundType) =>
    type === 'send' ? playUiSound() : playNotificationSound(),
} as const;

export const useNotificationSound = () => api;
