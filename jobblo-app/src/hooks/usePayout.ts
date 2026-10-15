import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { createAccountLink, getConnectStatus, refreshAccountStatus } from '../services/payout.service';

export function useConnectStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.payout.status,
    queryFn: getConnectStatus,
    enabled,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useCreateAccountLinkMutation() {
  return useMutation({
    mutationFn: createAccountLink,
  });
}

export function useRefreshStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshAccountStatus,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.payout.status }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile }),
      ]);
    },
  });
}
