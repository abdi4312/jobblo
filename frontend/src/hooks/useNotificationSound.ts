import { useCallback, useRef, useEffect } from "react";
import { useUserStore } from "../stores/userStore";
import SoundAudio from "../assets/sound/msg_notification.mp3";

export const useNotificationSound = () => {
  const messageSoundRef = useRef<HTMLAudioElement | null>(null);
  const sendSoundRef = useRef<HTMLAudioElement | null>(null);
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);
  const notificationsEnabled = useUserStore(
    (state) => state.notificationsEnabled,
  );

  // Initialize audio objects
  useEffect(() => {
    if (!messageSoundRef.current) {
      messageSoundRef.current = new Audio(SoundAudio);
      messageSoundRef.current.load();
    }
    if (!sendSoundRef.current) {
      sendSoundRef.current = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
      );
      sendSoundRef.current.load();
    }
    if (!alertSoundRef.current) {
      alertSoundRef.current = new Audio(SoundAudio);
      alertSoundRef.current.load();
    }
  }, []);

  // Unlock audio context on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      [messageSoundRef, sendSoundRef, alertSoundRef].forEach((ref) => {
        if (ref.current) {
          ref.current
            .play()
            .then(() => {
              ref.current?.pause();
              if (ref.current) ref.current.currentTime = 0;
            })
            .catch(() => {});
        }
      });
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const playMessageSound = useCallback(() => {
    if (!notificationsEnabled || !messageSoundRef.current) return;
    messageSoundRef.current.currentTime = 0;
    messageSoundRef.current.play().catch(() => {});
  }, [notificationsEnabled]);

  const playSendSound = useCallback(() => {
    if (!notificationsEnabled || !sendSoundRef.current) return;
    sendSoundRef.current.currentTime = 0;
    sendSoundRef.current.play().catch(() => {});
  }, [notificationsEnabled]);

  const playAlertSound = useCallback(() => {
    if (!notificationsEnabled || !alertSoundRef.current) return;
    alertSoundRef.current.currentTime = 0;
    alertSoundRef.current.play().catch(() => {});
  }, [notificationsEnabled]);

  return { playMessageSound, playSendSound, playAlertSound };
};
