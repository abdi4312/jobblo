import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from "./api";
import { useEffect } from "react";
import { initSocket } from "../../socket/socket";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export const useNotifications = (userId: string | undefined) => {
  return useInfiniteQuery({
    queryKey: ["notifications", userId],
    queryFn: ({ pageParam = 1 }) => getNotifications(userId!, pageParam),
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
    socket.emit("join", userId);

    const handleOrderApproved = (data: { orderId: string; chatId: string }) => {
      toast.success("Din forespørsel er godkjent! Du blir nå tatt til chatten.");
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["orders", userId] });
      setTimeout(() => {
        navigate(`/messages/${data.chatId}`);
      }, 2000);
    };

    socket.on("order_approved", handleOrderApproved);

    return () => {
      socket.off("order_approved", handleOrderApproved);
    };
  }, [userId, navigate, queryClient]);
};

export const useUnreadCount = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const socket = initSocket();

    // Join user room
    socket.emit("join", userId);

    const handleNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: ["unreadCount", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    };

    socket.on("new_notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
    };
  }, [userId, queryClient]);

  return useQuery({
    queryKey: ["unreadCount", userId],
    queryFn: () => getUnreadCount(userId!),
    enabled: !!userId,
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });
};
