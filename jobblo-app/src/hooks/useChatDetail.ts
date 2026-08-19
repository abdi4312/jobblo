import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChatDetail, sendChatMessage, type ChatDetail, type ChatMessage } from '../services/messages.service';
import { queryKeys } from '../queryKeys';

export function useChatDetail(chatId: string) {
  return useInfiniteQuery<ChatDetail>({
    queryKey: queryKeys.chats.detail(chatId),
    queryFn: ({ pageParam }) => getChatDetail(chatId, pageParam as number, 50),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.messagePage.hasMore ? lastPage.messagePage.offset + lastPage.messagePage.limit : undefined,
    enabled: !!chatId,
  });
}

export function messageIdentity(message: ChatMessage) {
  if (message._id) return `id:${message._id}`;
  const senderId = typeof message.senderId === 'string' ? message.senderId : message.senderId?._id || '';
  const timestamp = message.createdAt ? new Date(message.createdAt).getTime() : 0;
  return `legacy:${senderId}:${timestamp}:${message.text?.trim() || ''}`;
}

export function upsertChatMessage(current: { pages: ChatDetail[]; pageParams: unknown[] } | undefined, message: ChatMessage) {
  if (!current?.pages.length) return current;
  const identity = messageIdentity(message);
  if (current.pages.some((page) => page.messages.some((item) => messageIdentity(item) === identity))) return current;
  return {
    ...current,
    pages: [{ ...current.pages[0], messages: [...current.pages[0].messages, message] }, ...current.pages.slice(1)],
  };
}

export function useSendChatMessage(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => sendChatMessage(chatId, text),
    onSuccess: (message) => {
      queryClient.setQueryData(queryKeys.chats.detail(chatId), (current: { pages: ChatDetail[]; pageParams: unknown[] } | undefined) => upsertChatMessage(current, message));
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
    },
  });
}
