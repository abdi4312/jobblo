import { useMutation } from '@tanstack/react-query';
import { createOrGetChat } from '../services/chat.service';

export function useCreateOrGetChatMutation() {
  return useMutation({
    mutationFn: ({ providerId, serviceId }: { providerId: string; serviceId: string }) =>
      createOrGetChat(providerId, serviceId),
  });
}