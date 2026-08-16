import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount,
} from './api';
import { useEffect } from 'react';
import { initSocket } from '../../socket/socket';
import { useUserStore } from '../../stores/userStore';

export const useNotifications = (type?: string) => {
  const user = useUserStore((state) => state.user);
  const userId = user?._id;
  return useInfiniteQuery({
    queryKey: ['notifications', type],
    queryFn: ({ pageParam = 1 }) => getNotifications(pageParam, type),
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.currentPage + 1;
      return nextPage <= lastPage.totalPages ? nextPage : undefined;
    },
    initialPageParam: 1,
    enabled: !!userId,
  });
};

/**
 * Order-state events that need to invalidate more than the notification tray.
 *
 * The notification itself is handled by `NotificationRealtime`; these are the companion
 * events the server emits alongside it (`event`/`payload` on `notify`), and they exist so
 * an open order page updates itself rather than showing stale state behind a fresh toast.
 */
const ORDER_EVENTS = [
  'order_approved',
  'order_paid',
  'order_started',
  'order_completed',
  'worker_selected',
  'payout_sent',
  'payout_failed',
  'dispute_opened',
  'dispute_resolved',
  'new_job_request',
  'new_order_request',
] as const;

export const useOrderApprovalSocket = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const socket = initSocket();

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['myApplicants'] });
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
    };

    ORDER_EVENTS.forEach((event) => socket.on(event, invalidate));

    return () => {
      ORDER_EVENTS.forEach((event) => socket.off(event, invalidate));
    };
  }, [userId, queryClient]);
};

/**
 * The unread badge.
 *
 * This used to register a `new_notification` socket listener of its own. It is called by
 * the header bell and by anything else that wants the count, so the same event ran the
 * same invalidations two or three times — and alongside the header's own listener, which
 * played the sound, that is how one notification became several. All socket handling for
 * notifications now lives in `NotificationRealtime`, mounted once; this is just the query.
 *
 * It no longer emits `join` either. Rooms are joined server-side on connection, so a
 * client that has to ask is a client that stops receiving anything after its first
 * reconnect. See `backend/sockets/rooms.js`.
 */
export const useUnreadCount = () => {
  const user = useUserStore((state) => state.user);
  const userId = user?._id;

  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => getUnreadCount(),
    enabled: !!userId,
    // The socket pushes the count, so polling is a fallback for a dead socket rather than
    // the primary path.
    staleTime: 30_000,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};

export const useDeleteAllNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};
