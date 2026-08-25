import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { createTicket, getMyTickets } from '../services/support.service';

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTicket,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.support.mine });
    },
  });
}

export function useMyTickets() {
  return useQuery({
    queryKey: queryKeys.support.mine,
    queryFn: getMyTickets,
  });
}
