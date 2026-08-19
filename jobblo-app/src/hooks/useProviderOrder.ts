import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { createProviderReview, deleteProviderEvidence, getProviderDispute, getProviderOrder, getProviderOrderReviews, markProviderReadyForReview, openProviderDispute, startProviderJob, updateProviderChecklist, uploadProviderEvidence } from '../services/providerWork.service';
import type { ProviderOrderResponse } from '../types/ProviderOrder';

export function useProviderOrder(orderId: string) {
  return useQuery<ProviderOrderResponse>({
    queryKey: queryKeys.providerOrders.detail(orderId),
    queryFn: () => getProviderOrder(orderId),
    enabled: !!orderId,
    refetchInterval: 30_000,
  });
}

function invalidateProviderOrderQueries(queryClient: ReturnType<typeof useQueryClient>, orderId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.detail(orderId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.safepay.checkout(orderId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.applicants.overview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.applicants.detailRoot }),
  ]);
}

function useProviderOrderMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.all }),
  });
}

export function useStartProviderJobMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startProviderJob(orderId),
    onSuccess: () => invalidateProviderOrderQueries(queryClient, orderId),
    onError: () => invalidateProviderOrderQueries(queryClient, orderId),
  });
}

export function useProviderChecklistMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, providerCompleted }: { itemId: string; providerCompleted: boolean }) => updateProviderChecklist(orderId, itemId, providerCompleted),
    onSuccess: () => invalidateProviderOrderQueries(queryClient, orderId),
    onError: () => invalidateProviderOrderQueries(queryClient, orderId),
  });
}

export function useProviderEvidenceMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { evidenceType: 'before' | 'after'; files: Array<{ uri: string; name: string; type: string }>; completionNote?: string }) => uploadProviderEvidence(orderId, input.evidenceType, input.files, input.completionNote),
    onSuccess: () => invalidateProviderOrderQueries(queryClient, orderId),
    onError: () => invalidateProviderOrderQueries(queryClient, orderId),
  });
}

export function useDeleteProviderEvidenceMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { url: string; evidenceType: 'before' | 'after' }) => deleteProviderEvidence(orderId, input.url, input.evidenceType),
    onSuccess: () => invalidateProviderOrderQueries(queryClient, orderId),
    onError: () => invalidateProviderOrderQueries(queryClient, orderId),
  });
}

export function useMarkReadyForReviewMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markProviderReadyForReview(orderId),
    onSuccess: () => invalidateProviderOrderQueries(queryClient, orderId),
    onError: () => invalidateProviderOrderQueries(queryClient, orderId),
  });
}

export function useProviderDispute(orderId: string) {
  return useQuery({ queryKey: queryKeys.disputes.byOrder(orderId), queryFn: () => getProviderDispute(orderId), enabled: !!orderId, retry: false });
}

export function useOpenProviderDisputeMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (payload: { reasonCategory: string; title: string; description: string }) => openProviderDispute(orderId, payload), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.detail(orderId) }); void queryClient.invalidateQueries({ queryKey: queryKeys.disputes.byOrder(orderId) }); } });
}

export function useProviderOrderReviews(orderId: string) {
  return useQuery({ queryKey: queryKeys.providerOrders.reviews(orderId), queryFn: () => getProviderOrderReviews(orderId), enabled: !!orderId });
}

export function useCreateProviderReviewMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createProviderReview, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.reviews(orderId) }) });
}