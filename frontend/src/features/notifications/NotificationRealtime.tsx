import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { initSocket } from '../../socket/socket';
import { useUserStore } from '../../stores/userStore';
import { listenForUnlock, playNotificationSound } from './sound';
import { notificationMeta, useOpenNotification } from './presentation';
import type { AlertType } from './types';

/**
 * Everything that happens when a notification arrives, in one place, mounted once.
 *
 * This logic used to live in three components at the same time. `Header` listened for
 * `new_notification` and played a sound; `useUnreadCount` listened for it and invalidated
 * queries — and `useUnreadCount` is called by both the header's bell and anything else that
 * wants the badge, so the same event ran two or three sets of handlers. Combined with a
 * server that emitted into two rooms the socket was in, a single application could produce
 * four sounds.
 *
 * Mounting this once in `App` and taking the handlers out of the components means one
 * event, one handler, one sound, one toast — and one place to change any of it.
 *
 * It also does the two things nobody was doing:
 *
 *   • **Catch up after a reconnect.** Anything that happened while the socket was down was
 *     simply missed; the tray stayed stale until something else refetched. On `connect` we
 *     refetch, because that is exactly the moment we know we might have missed something.
 *   • **Catch up on foreground.** Mobile browsers freeze or close the socket when the tab
 *     is backgrounded, which on a phone is every time the user does anything else. Coming
 *     back to the tab now refetches instead of showing whatever was true when they left.
 */

/** Notifications already handled this session, so a duplicate delivery is a no-op. */
const MAX_SEEN = 200;

export function NotificationRealtime() {
  const user = useUserStore((state) => state.user);
  const userId = user?._id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openNotification = useOpenNotification();
  const seenRef = useRef<Set<string>>(new Set());

  /** Everything that reads notification state, refetched together. */
  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  // Warm the audio pipeline on the first gesture of the session. Doing it here rather than
  // inside a sound hook means it happens once, for one shared AudioContext.
  useEffect(() => listenForUnlock(), []);

  const showToast = useCallback(
    (notification: AlertType) => {
      const { label, Icon } = notificationMeta(notification.type);

      toast.custom(
        (t) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              openNotification(notification);
            }}
            className={`flex w-full max-w-90 items-start gap-3 rounded-2xl border border-[#E6E7E1] bg-white p-3.5 text-left shadow-[0_18px_44px_rgba(11,11,11,0.16)] transition-all ${
              t.visible ? 'animate-in fade-in slide-in-from-bottom-2' : 'opacity-0'
            }`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9] text-[#2E6641]">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">
                {label}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[0.875rem] leading-relaxed font-medium text-[#0B0B0B]">
                {notification.content}
              </span>
            </span>
          </button>
        ),
        { duration: 6000, position: 'bottom-center' }
      );
    },
    [openNotification]
  );

  const showSystemNotification = useCallback(
    (notification: AlertType) => {
      const { browserNotificationsEnabled } = useUserStore.getState();
      if (!browserNotificationsEnabled) return;
      // iOS Safari has no Notification constructor outside an installed PWA. The in-app
      // toast above is the channel that always works, which is why it is not conditional.
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      try {
        const { label } = notificationMeta(notification.type);
        const system = new Notification(`Jobblo · ${label}`, {
          body: notification.content,
          icon: '/logo192.png',
          // Collapses repeats in the OS tray instead of stacking one banner per event.
          tag: 'jobblo-notification',
          renotify: false,
        } as NotificationOptions);

        system.onclick = () => {
          window.focus();
          openNotification(notification);
          system.close();
        };
        setTimeout(() => system.close(), 6000);
      } catch {
        /* the tab is allowed to refuse */
      }
    },
    [openNotification]
  );

  useEffect(() => {
    if (!userId) return;

    const socket = initSocket();
    const seen = seenRef.current;

    const handleNotification = (payload: AlertType & { urgent?: boolean; unreadCount?: number }) => {
      const id = String(payload?._id || '');

      // Guard against a duplicate delivery for any reason — two rooms, a double-mounted
      // listener in development's StrictMode, a server-side retry.
      if (id) {
        if (seen.has(id)) return;
        seen.add(id);
        if (seen.size > MAX_SEEN) {
          // Bounded, so a long session cannot grow this without limit.
          seen.delete(seen.values().next().value as string);
        }
      }

      // The count now rides along with the event, so the badge updates without the
      // round trip the old handler triggered on every single notification.
      if (typeof payload?.unreadCount === 'number') {
        queryClient.setQueryData(['unreadCount'], { count: payload.unreadCount });
      } else {
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // `urgent` is decided by the server's catalogue (services/notifications/index.js), so
      // "is this worth a sound" is answered once, next to the event, rather than by a list
      // the client has to keep in step. Older payloads without the flag stay audible.
      const urgent = payload?.urgent !== false;
      if (urgent) {
        playNotificationSound();
        if (document.hidden) showSystemNotification(payload);
        else showToast(payload);
      }
    };

    const handleCount = (payload: { count?: number }) => {
      if (typeof payload?.count === 'number') {
        queryClient.setQueryData(['unreadCount'], { count: payload.count });
      }
    };

    // A reconnect means we were disconnected, which means we may have missed events.
    const handleReconnect = () => refetchAll();

    socket.on('new_notification', handleNotification);
    socket.on('notification_count', handleCount);
    socket.on('connect', handleReconnect);

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      refetchAll();
      // Phones suspend the socket rather than closing it cleanly, so it can believe it is
      // connected when it is not. Asking for a reconnect is free when it already is.
      if (!socket.connected) socket.connect();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleVisibility);

    return () => {
      socket.off('new_notification', handleNotification);
      socket.off('notification_count', handleCount);
      // Named handler, so this cannot remove the connect listeners other features
      // registered — `socket.off('connect')` elsewhere in this codebase does exactly that.
      socket.off('connect', handleReconnect);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleVisibility);
    };
  }, [userId, queryClient, navigate, refetchAll, showToast, showSystemNotification]);

  return null;
}

export default NotificationRealtime;
