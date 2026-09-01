import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getMyConversations, type MessageConversation } from '../services/messages.service';

export function useMessages() {
  return useQuery<MessageConversation[]>({
    queryKey: queryKeys.chats.all,
    queryFn: getMyConversations,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}
