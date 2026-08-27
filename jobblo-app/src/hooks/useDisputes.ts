import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { addDisputeMessage, getDisputeByOrder, openDispute } from '../services/disputes.service';
import type { Dispute, OpenDisputeInput, OpenDisputeResponse } from '../types/Dispute';

/**
 * There is no user-facing "list my disputes" endpoint, so disputes are only ever
 * read one order at a time — hence a single `disputes.byOrder` key and no list key.
 */
export function useDisputeByOrder(orderId: string) {
  return useQuery<Dispute | null>({
    queryKey: queryKeys.disputes.byOrder(orderId),
    queryFn: () => getDisputeByOrder(orderId),
    enabled: !!orderId,
    // No auto-retry: a failed load shows an in-screen "Prøv igjen" instead.
    retry: false,
  });
}

/** Targeted invalidation only — the order screens carry the activeDispute flag. */
function invalidateDisputeQueries(queryClient: QueryClient, orderId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.byOrder(orderId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.detail(orderId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.safepay.checkout(orderId) });
}

export function useOpenDisputeMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation<OpenDisputeResponse, unknown, OpenDisputeInput>({
    mutationFn: (payload) => openDispute(orderId, payload),
    retry: 0,
    onSuccess: () => invalidateDisputeQueries(queryClient, orderId),
  });
}

export function useAddDisputeMessageMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ disputeId, message }: { disputeId: string; message: string }) => addDisputeMessage(disputeId, message),
    retry: 0,
    // No optimistic insert: message _ids are server-generated, so the thread waits
    // for the refetch rather than reconciling a fake id.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.disputes.byOrder(orderId) }),
  });
}

/**
 * Fetches the order's dispute on demand. Used to recover from the backend's
 * "already an active dispute" 400 by opening the real dispute instead of guessing an id.
 */
export function useFetchDisputeByOrder() {
  const queryClient = useQueryClient();
  return useCallback(
    (orderId: string) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.disputes.byOrder(orderId),
        queryFn: () => getDisputeByOrder(orderId),
        staleTime: 0,
        retry: false,
      }),
    [queryClient],
  );
}
