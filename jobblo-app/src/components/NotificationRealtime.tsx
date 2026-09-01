import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getChatSocket } from '../services/chatSocket.service';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../queryKeys';
import type { Notification } from '../types/Notification';

const MAX_SEEN = 200;

/**
 * Single app-level realtime subscription for notifications.
 *
 * Mounted once in the root layout. Uses the existing chat socket — no second connection.
 * Listens for `new_notification` and `notification_count` events, updating the TanStack
 * cache so the badge and inbox stay current without polling.
 */
export function NotificationRealtime() {
  const userId = useAuthStore((s) => s.user && typeof s.user._id === 'string' ? s.user._id : null);
  const qc = useQueryClient();
  const seenRef = useRef<Set<string>>(new Set());

  const refetchAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
  }, [qc]);

  useEffect(() => {
    if (!userId) return;

    const socket = getChatSocket();
    const seen = seenRef.current;

    const handleNotification = (payload: Notification & { urgent?: boolean; unreadCount?: number }) => {
      const id = String(payload?._id || '');
      if (id) {
        if (seen.has(id)) return;
        seen.add(id);
        if (seen.size > MAX_SEEN) {
          const first = seen.values().next().value;
          if (first !== undefined) seen.delete(first);
        }
      }

      if (typeof payload?.unreadCount === 'number') {
        qc.setQueryData(queryKeys.notifications.unreadCount, { count: payload.unreadCount });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
      }
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    };

    const handleCount = (payload: { count?: number }) => {
      if (typeof payload?.count === 'number') {
        qc.setQueryData(queryKeys.notifications.unreadCount, { count: payload.count });
      }
    };

    const handleReconnect = () => refetchAll();

    socket.on('new_notification', handleNotification);
    socket.on('notification_count', handleCount);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('new_notification', handleNotification);
      socket.off('notification_count', handleCount);
      socket.off('connect', handleReconnect);
    };
  }, [userId, qc, refetchAll]);

  return null;
}
