import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyChats, getChatById, sendMessage } from "../../api/chatAPI";

export const useChatQueries = (conversationId?: string) => {
  const queryClient = useQueryClient();

  const chatsQuery = useQuery({
    queryKey: ["chats"],
    queryFn: getMyChats,
    refetchOnWindowFocus: false,
  });

  const activeChatQuery = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: () => getChatById(conversationId!),
    enabled: !!conversationId,
    refetchOnWindowFocus: false,
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => sendMessage(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  return { chatsQuery, activeChatQuery, sendMutation };
};