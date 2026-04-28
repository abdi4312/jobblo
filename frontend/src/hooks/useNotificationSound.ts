import { useCallback, useEffect, useRef } from "react";
import { useUserStore } from "../stores/userStore";
import MessageSound from "../assets/sound/msg_notification.mp3";

const SOUND_CONFIG = {
  message: MessageSound,
  send: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
  alert: MessageSound,
} as const;

export type SoundType = keyof typeof SOUND_CONFIG;

// global unlock flag (shared across hook instances)
let isAudioUnlocked = false;

export const useNotificationSound = (volume: number = 1) => {
  const audioRefs = useRef<Partial<Record<SoundType, HTMLAudioElement>>>({});

  const getAudio = useCallback((type: SoundType) => {
    if (typeof window === "undefined") return null;

    if (!audioRefs.current[type]) {
      try {
        const audio = new Audio(SOUND_CONFIG[type]);
        audio.preload = "auto";
        audio.volume = volume;
        audioRefs.current[type] = audio;
      } catch (err) {
        console.error(`[sound] init failed: ${type}`, err);
        return null;
      }
    }

    return audioRefs.current[type]!;
  }, [volume]);

  const play = useCallback((type: SoundType) => {
    if (typeof window === "undefined") return;

    const { notificationsEnabled } = useUserStore.getState();
    if (!notificationsEnabled) return;

    const audio = getAudio(type);
    if (!audio) return;

    audio.currentTime = 0;
    void audio.play();
  }, [getAudio]);

  // global unlock (runs once across app)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAudioUnlocked) return;

    const unlock = () => {
      if (isAudioUnlocked) return;
      isAudioUnlocked = true;

      const audio = getAudio("message");
      if (!audio) return;

      audio.muted = true;

      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });

      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);

    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [getAudio]);

  return {
    playMessageSound: useCallback(() => play("message"), [play]),
    playSendSound: useCallback(() => play("send"), [play]),
    playAlertSound: useCallback(() => play("alert"), [play]),
    playCustomSound: play,
  };
};