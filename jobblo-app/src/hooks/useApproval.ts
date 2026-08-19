import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { approveSafePayJob, updateCustomerChecklist, uploadReviewPhotos } from '../services/approval.service';

function invalidateApprovalQueries(queryClient: ReturnType<typeof useQueryClient>, orderId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.safepay.checkout(orderId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.detail(orderId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.applicants.overview });
  void queryClient.invalidateQueries({ queryKey: queryKeys.applicants.detailRoot });
  void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.reviews(orderId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });
}

export function useCustomerChecklistMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) => updateCustomerChecklist(orderId, itemId, checked), onSuccess: () => invalidateApprovalQueries(queryClient, orderId) });
}

export function useReviewPhotoUploadMutation(orderId: string) {
  return useMutation({ mutationFn: (photos: Array<{ uri: string; name: string; type: string }>) => uploadReviewPhotos(orderId, photos) });
}

export function useApproveSafePayJobMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: approveSafePayJob, onSuccess: () => invalidateApprovalQueries(queryClient, orderId) });
}