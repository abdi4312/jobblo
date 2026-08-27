import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { cancelCurrentSubscription, getCurrentSubscription, getPurchaseHistory, resumeCurrentSubscription } from '../services/subscription.service';

export function useCurrentSubscription() {
  return useQuery({ queryKey: queryKeys.subscription.current, queryFn: getCurrentSubscription, refetchOnMount: 'always' });
}

export function useSubscriptionHistory() {
  return useQuery({ queryKey: queryKeys.subscription.history, queryFn: getPurchaseHistory, retry: false });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: cancelCurrentSubscription, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current }) });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: resumeCurrentSubscription, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current }) });
}
