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
import { ALL_LIFECYCLE_EVENTS, idFrom, type LifecyclePayload } from './orderEvents';

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
 * Keep an open order screen in step with the server.
 *
 * The notification itself is handled by `NotificationRealtime`; these are the companion
 * lifecycle events the server emits alongside it, and they exist so an order page
 * updates itself rather than showing stale state behind a fresh toast.
 *
 * Two things were wrong here and they cancelled each other out into silence:
 *
 *   1. The event list did not match what the server emits. It waited on
 *      `new_order_request`, which nothing has ever emitted, and did not carry
 *      `order_ready_for_review` — the single event that unlocks the customer's
 *      "Godkjenn og utbetal" button. The customer sat on the approval page and had to
 *      reload to find out the provider had finished.
 *   2. Even for the events that did match, it invalidated `['orders']`, `['order']`,
 *      `['myApplicants']` and `['jobRequests']` — none of which any order screen uses.
 *      The live screens query `['safepay-checkout', id]`, `['provider-order', id]`,
 *      `['dispute', id]` and `['order-reviews', id]`.
 *
 * Both lists now come from `./orderEvents`, which mirrors `backend/constants/orderEvents.js`.
 *
 * Invalidation is scoped to the order in the payload wherever one is present, so a
 * dispute update on order A does not refetch order B. Only when a payload arrives
 * without an id do the per-order keys get invalidated wholesale, and even then this
 * never clears the cache — `queryClient.clear()` here would drop the user's profile,
 * chat list and everything else along with it.
 */
export const useOrderApprovalSocket = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const socket = initSocket();

    /** Lists that can change shape on any lifecycle event, regardless of which order. */
    const invalidateLists = () => {
      for (const key of [['orders'], ['order'], ['myApplicants'], ['jobRequests'], ['services']]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    };

    /** The per-order screens. Scoped when we know the id, broad only when we do not. */
    const invalidateOrder = (orderId?: string) => {
      const perOrder = ['safepay-checkout', 'provider-order', 'dispute', 'order-reviews'];
      for (const prefix of perOrder) {
        queryClient.invalidateQueries({
          queryKey: orderId ? [prefix, orderId] : [prefix],
        });
      }
    };

    const handler = (payload: LifecyclePayload | undefined) => {
      const orderId = idFrom(payload?.orderId);
      invalidateOrder(orderId);
      invalidateLists();
    };

    ALL_LIFECYCLE_EVENTS.forEach((event) => socket.on(event, handler));

    return () => {
      ALL_LIFECYCLE_EVENTS.forEach((event) => socket.off(event, handler));
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
