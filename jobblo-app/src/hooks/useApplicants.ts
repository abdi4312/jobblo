import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  declineApplicant,
  createSafePayContract,
  getApplicants,
  toggleApplicantArchive,
  toggleApplicantFavorite,
} from '../services/applicants.service';
import type { ApplicantsDetailResponse } from '../types/Applicants';

export function useApplicants(serviceId: string, sort = 'createdAt', filter = 'notArchived') {
  return useQuery<ApplicantsDetailResponse>({
    queryKey: queryKeys.applicants.detail({ serviceId, sort, filter }),
    queryFn: () => getApplicants(serviceId, sort, filter),
    enabled: !!serviceId,
    staleTime: 30_000,
  });
}

function useApplicantActionMutation<TVariables>(mutationFn: (value: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.applicants.detailRoot });
    },
  });
}

export function useToggleApplicantFavoriteMutation() {
  return useApplicantActionMutation(toggleApplicantFavorite);
}

export function useToggleApplicantArchiveMutation() {
  return useApplicantActionMutation(toggleApplicantArchive);
}

export function useDeclineApplicantMutation() {
  return useApplicantActionMutation((value: { requestId: string; archive?: boolean }) =>
    declineApplicant(value.requestId, value.archive),
  );
}

export function useCreateSafePayContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSafePayContract,
    onSuccess: async (data, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.applicants.detailRoot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applicants.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(variables.serviceId) }),
      ];

      if (typeof data.orderId === 'string' && data.orderId.trim()) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.safepay.checkout(data.orderId.trim()) }));
      }

      await Promise.all(invalidations);
    },
  });
}