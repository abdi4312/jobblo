import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { getMyChats, getChatById, sendMessage } from '../../api/chatAPI';
import { getErrorMessage } from '../../utils/getErrorMessage';

export const useChatQueries = (conversationId?: string) => {
  const queryClient = useQueryClient();

  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: getMyChats,
    refetchOnWindowFocus: false,
  });

  const activeChatQuery = useQuery({
    queryKey: ['chat', conversationId],
    queryFn: () => getChatById(conversationId!),
    enabled: !!conversationId,
    refetchOnWindowFocus: false,
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => sendMessage(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    // A failed send produced nothing at all: no toast, no retry, no failed state.
    // The message simply vanished and the user believed it had been delivered.
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Meldingen ble ikke sendt. Prøv igjen.'));
    },
  });

  return { chatsQuery, activeChatQuery, sendMutation };
};
