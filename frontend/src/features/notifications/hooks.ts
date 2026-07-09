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
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
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

export const useOrderApprovalSocket = (userId: string | undefined) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const socket = initSocket();
    socket.emit('join', userId);

    const handleOrderApproved = (data: { orderId: string; chatId: string }) => {
      toast.success('Din forespørsel er godkjent!');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['orders', userId] });
    };

    socket.on('order_approved', handleOrderApproved);

    return () => {
      socket.off('order_approved', handleOrderApproved);
    };
  }, [userId, navigate, queryClient]);
};

export const useUnreadCount = () => {
  const user = useUserStore((state) => state.user);
  const userId = user?._id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const socket = initSocket();

    // Join user room
    socket.emit('join', userId);

    const handleNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [userId, queryClient]);

  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => getUnreadCount(),
    enabled: !!userId,
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
