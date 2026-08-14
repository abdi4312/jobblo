import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initSocket } from '../../socket/socket';
import { useUserStore } from '../../stores/userStore';
import { useNotificationSound } from '../../hooks/useNotificationSound';
import { useChatQueries } from '../../features/chat/hook';

export const useChatSocket = (conversationId?: string) => {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const userId = user?._id;
  const { playSendSound } = useNotificationSound();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const { chatsQuery, activeChatQuery, sendMutation } = useChatQueries(conversationId);

  useEffect(() => {
    const socket = initSocket();
    if (!socket || !userId) return;

    // Initial setup
    socket.emit('setup', userId);

    if (conversationId) {
      socket.emit('join-chat', conversationId);
      socket.emit('mark-as-read', { chatId: conversationId, userId });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      window.dispatchEvent(new CustomEvent('chat-read'));
    }

    // Socket listeners
    const handleReceiveMessage = (data: { chatId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', data.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });

      if (conversationId === data.chatId) {
        socket.emit('mark-as-read', { chatId: conversationId, userId });
        window.dispatchEvent(new CustomEvent('chat-read'));
      }
    };

    const handleMessagesRead = (data: { chatId: string }) => {
      if (data.chatId === conversationId) {
        queryClient.invalidateQueries({ queryKey: ['chat', data.chatId] });
      }
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    };

    const handleUserOnline = (onlineUserIds: string[]) => {
      setOnlineUsers(onlineUserIds);
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('messages-read', handleMessagesRead);
    socket.on('get-online-users', handleUserOnline);

    const serviceId = activeChatQuery.data?.serviceId?._id;
    if (serviceId) {
      socket.emit('join_service', serviceId);
    }

    return () => {
      if (conversationId) socket.emit('leave-chat', conversationId);
      // The socket is a module-level singleton, so handlers registered here
      // outlive the component unless they are removed. Without these three
      // socket.off calls, every conversation you opened added another copy: after
      // N opens a single inbound message ran the handler N times, each firing two
      // invalidateQueries — 2N duplicate refetches on the busiest screen in the
      // app. This effect also re-runs when serviceId resolves, so it registered
      // at least twice per conversation.
      socket.off('receive-message', handleReceiveMessage);
      socket.off('messages-read', handleMessagesRead);
      socket.off('get-online-users', handleUserOnline);
    };
  }, [conversationId, userId, queryClient, activeChatQuery.data?.serviceId?._id]);

  return {
    userId,
    user,
    onlineUsers,
    chatsQuery,
    activeChatQuery,
    sendMutation,
    playSendSound,
  };
};
