import { useUserStore } from '../../stores/userStore';
import notificationTone from '../../assets/sound/msg_notification.mp3';

/**
 * The notification tone. One decoded buffer, one output chain, for the whole app.
 *
 * The old hook built an `HTMLAudioElement` per hook instance and played it with
 * `audio.currentTime = 0; audio.play()`. Four things went wrong with that, and together
 * they are the "sound appears abnormally" bug:
 *
 *   1. `useNotificationSound()` was called from more than one component, and each call
 *      created its own `Audio` object from the same file. When two of them reacted to the
 *      same socket event the file played twice, a few milliseconds apart — which does not
 *      sound like a repeat, it sounds like a flanged, broken version of the tone.
 *   2. Resetting `currentTime` on an element that is still playing cuts the tone off
 *      mid-sample. A hard cut in the middle of a waveform is a click.
 *   3. Nothing rate-limited it. Three notifications arriving together — which is normal
 *      when an order moves state and notifies both sides — machine-gunned the tone.
 *   4. The autoplay unlock set its "unlocked" flag before `play()` resolved and only ever
 *      unlocked the element belonging to whichever hook instance ran the effect. Every
 *      other element stayed locked, so on iOS the first real notification of a session was
 *      usually silent.
 *
 * The replacement decodes the file once into an `AudioBuffer` and plays it through a fresh
 * `AudioBufferSourceNode` each time. Sources are cheap and single-use, so overlapping calls
 * cannot fight over one element, and there is no "restart" to click. A short gain envelope
 * fades the tone in and out, which is what actually makes it sound smooth: the sample
 * starts and ends at a non-zero amplitude, and jumping straight to it is audible as a tick.
 *
 * Falls back to a single shared `HTMLAudioElement` where Web Audio is unavailable.
 */

/** Quieter than the old full-scale playback. */
const VOLUME = 0.45;

/**
 * Minimum gap between tones. A burst of notifications is one event as far as a person is
 * concerned, and the tray badge already carries the count.
 *
 * There was briefly a second, quieter variant for outgoing chat messages. It is gone: a
 * tone for an action you just took yourself is noise, and in a live conversation it
 * doubled the audio for no information. Sound is only for things that happen *to* you.
 */
const MIN_INTERVAL_MS = 1500;

/** Fade in and out, in seconds. Enough to kill the edge click, short enough to be unheard. */
const ATTACK = 0.012;
const RELEASE = 0.05;

type Ctor = typeof AudioContext;

let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let decoding: Promise<AudioBuffer | null> | null = null;
let fallback: HTMLAudioElement | null = null;
let lastPlayedAt = 0;
let unlocked = false;

const getContextCtor = (): Ctor | null => {
  if (typeof window === 'undefined') return null;
  return (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext ||
    null) as Ctor | null;
};

const getContext = (): AudioContext | null => {
  if (context) return context;
  const Ctx = getContextCtor();
  if (!Ctx) return null;
  try {
    context = new Ctx();
    return context;
  } catch {
    return null;
  }
};

/** Decode once. Concurrent callers share the same promise rather than each fetching. */
const loadBuffer = async (): Promise<AudioBuffer | null> => {
  if (buffer) return buffer;
  if (decoding) return decoding;

  const ctx = getContext();
  if (!ctx) return null;

  decoding = (async () => {
    try {
      const response = await fetch(notificationTone);
      const bytes = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(bytes);
      return buffer;
    } catch {
      // Leave `buffer` null; `play` drops to the HTMLAudio path.
      return null;
    } finally {
      decoding = null;
    }
  })();

  return decoding;
};

const getFallback = (): HTMLAudioElement | null => {
  if (typeof window === 'undefined') return null;
  if (!fallback) {
    try {
      fallback = new Audio(notificationTone);
      fallback.preload = 'auto';
    } catch {
      return null;
    }
  }
  return fallback;
};

/**
 * Browsers will not start audio until the user has interacted with the page, and an
 * `AudioContext` created before that starts `suspended`. This resumes it on the first
 * gesture and warms the decode, so the first real notification is not the one that pays
 * for both.
 *
 * Idempotent, and safe to call from more than one place — unlike the old per-hook unlock,
 * there is only one context to unlock.
 */
export function unlockNotificationSound(): void {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;

  const ctx = getContext();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
  void loadBuffer();
}

/** Wire the unlock to the first gesture of the session. Called once, by the provider. */
export function listenForUnlock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onGesture = () => {
    unlockNotificationSound();
    detach();
  };
  const detach = () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    window.removeEventListener('touchstart', onGesture);
  };

  window.addEventListener('pointerdown', onGesture, { once: false });
  window.addEventListener('keydown', onGesture, { once: false });
  window.addEventListener('touchstart', onGesture, { once: false });

  return detach;
}

/**
 * Play the tone, if the user wants sound and one has not just played.
 *
 * Never throws and never returns a rejected promise — a blocked autoplay is an ordinary
 * outcome on the web, not an error worth surfacing.
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;
  if (!useUserStore.getState().notificationsEnabled) return;

  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;

  const ctx = getContext();

  if (!ctx) {
    const element = getFallback();
    if (element) {
      element.volume = VOLUME;
      // Only restart the fallback if it has actually finished, so this path cannot
      // reproduce the mid-sample cut that made the old implementation click.
      if (element.paused || element.ended) void element.play().catch(() => {});
    }
    return;
  }

  const start = (decoded: AudioBuffer) => {
    try {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

      const source = ctx.createBufferSource();
      source.buffer = decoded;

      const gain = ctx.createGain();
      const t = ctx.currentTime;
      const end = t + decoded.duration;

      // Ramp up, hold, ramp down. `setValueAtTime` first so the ramps have a known
      // starting point — without it Chrome ramps from whatever the node last held.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOLUME, t + ATTACK);
      gain.gain.setValueAtTime(VOLUME, Math.max(t + ATTACK, end - RELEASE));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      source.connect(gain).connect(ctx.destination);
      source.start(t);
      // Sources are single-use; releasing the graph keeps a long session from holding
      // one node per notification.
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          /* already torn down */
        }
      };
    } catch {
      /* nothing worth doing if the graph will not build */
    }
  };

  if (buffer) {
    start(buffer);
    return;
  }

  void loadBuffer().then((decoded) => {
    if (decoded) start(decoded);
    else {
      const element = getFallback();
      if (element && (element.paused || element.ended)) {
        element.volume = VOLUME;
        void element.play().catch(() => {});
      }
    }
  });
}

