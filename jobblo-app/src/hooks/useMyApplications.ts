import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getMyApplications, getMyJobRequests, withdrawApplication } from '../services/applications.service';
import type { MyApplicationsResponse } from '../types/Application';

export function useMyApplications(params?: { page?: number; limit?: number; status?: string; enabled?: boolean }) {
  const { enabled = true, ...queryParams } = params ?? {};

  return useQuery<MyApplicationsResponse>({
    queryKey: queryKeys.applications.list(queryParams),
    queryFn: () => getMyApplications(queryParams),
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

export function useMyJobRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.applications.requests,
    queryFn: getMyJobRequests,
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

export function useWithdrawApplicationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => withdrawApplication(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['applications'] });
      await queryClient.refetchQueries({ queryKey: ['applications'] });
    },
  });
}
