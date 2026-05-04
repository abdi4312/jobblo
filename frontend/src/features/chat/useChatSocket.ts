import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { initSocket } from "../../socket/socket";
import { useUserStore } from "../../stores/userStore";
import { useNotificationSound } from "../../hooks/useNotificationSound";
import { useChatQueries } from "../../features/chat/hook";

export const useChatSocket = (conversationId?: string) => {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const userId = user?._id;
  const { playSendSound } = useNotificationSound();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const { chatsQuery, activeChatQuery, contractQuery, sendMutation } =
    useChatQueries(conversationId);

  useEffect(() => {
    const socket = initSocket();
    if (!socket || !userId) return;

    // Initial setup
    socket.emit("setup", userId);

    if (conversationId) {
      socket.emit("join-chat", conversationId);
      socket.emit("mark-as-read", { chatId: conversationId, userId });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      window.dispatchEvent(new CustomEvent("chat-read"));
    }

    // Socket listeners
    const handleReceiveMessage = (data: { chatId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["chat", data.chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });

      if (conversationId === data.chatId) {
        socket.emit("mark-as-read", { chatId: conversationId, userId });
        window.dispatchEvent(new CustomEvent("chat-read"));
      }
    };

    const handleMessagesRead = (data: { chatId: string }) => {
      if (data.chatId === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["chat", data.chatId] });
      }
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    };

    const handleUserOnline = (onlineUserIds: string[]) => {
      setOnlineUsers(onlineUserIds);
    };

    const handleContractUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["contract"] });
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("messages-read", handleMessagesRead);
    socket.on("get-online-users", handleUserOnline);

    const serviceId = activeChatQuery.data?.serviceId?._id;
    if (serviceId) {
      socket.emit("join_service", serviceId);
      socket.on("contract_created", handleContractUpdate);
      socket.on("contract_signed", handleContractUpdate);
    }

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("messages-read", handleMessagesRead);
      socket.off("get-online-users", handleUserOnline);
      socket.off("contract_created", handleContractUpdate);
      socket.off("contract_signed", handleContractUpdate);
      if (conversationId) socket.emit("leave-chat", conversationId);
    };
  }, [
    conversationId,
    userId,
    queryClient,
    activeChatQuery.data?.serviceId?._id,
  ]);

  return {
    userId,
    user,
    onlineUsers,
    chatsQuery,
    activeChatQuery,
    contractQuery,
    sendMutation,
    playSendSound,
  };
};
