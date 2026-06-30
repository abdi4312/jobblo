import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatSocket } from './useChatSocket';
import { useQueryClient } from '@tanstack/react-query';

export type FilterType = 'All' | 'Purchases' | 'Sales';

export const useChatLogic = () => {
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [newMessage, setNewMessage] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1200);

  const { userId, user, onlineUsers, chatsQuery, activeChatQuery, sendMutation, playSendSound } =
    useChatSocket(conversationId);

  const chats = chatsQuery.data || [];
  const activeChat = activeChatQuery.data;
  const messages = activeChat?.messages || [];

  const otherUser = activeChat
    ? activeChat.clientId?._id === userId
      ? activeChat.providerId
      : activeChat.clientId
    : null;

  const isOtherUserOnline = !!(otherUser?._id && onlineUsers.includes(otherUser._id));

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1200);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll to latest message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sendMutation.isPending) return;
    sendMutation.mutate(
      { id: conversationId, text: newMessage.trim() },
      {
        onSuccess: () => {
          setNewMessage('');
          playSendSound();
        },
      }
    );
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 24)
      return date.toLocaleTimeString('no-NO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    return date.toLocaleDateString('no-NO', { day: '2-digit', month: 'short' });
  };

  const filteredChats = chats.filter((chat) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Sales') return chat.providerId?._id === userId;
    return chat.clientId?._id === userId;
  });

  const isUnread = (chat: any) => {
    const lastMsg = chat.messages?.[chat.messages.length - 1];
    if (!lastMsg || !userId) return false;
    const senderId =
      typeof lastMsg.senderId === 'string' ? lastMsg.senderId : lastMsg.senderId?._id;
    if (senderId === userId) return false;
    return !lastMsg.seenBy?.some((id: any) => (id?._id || id) === userId);
  };

  return {
    conversationId,
    queryClient,
    messagesEndRef,
    navigate,
    activeFilter,
    setActiveFilter,
    newMessage,
    setNewMessage,
    isMobile,
    userId,
    user,
    onlineUsers,
    chatsQuery,
    activeChatQuery,
    sendMutation,
    chats,
    activeChat,
    messages,
    otherUser,
    isOtherUserOnline,
    handleSend,
    formatTime,
    filteredChats,
    isUnread,
  };
};
