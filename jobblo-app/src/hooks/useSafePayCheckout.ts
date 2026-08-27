import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { createSafePaySession, getSafePayCheckout } from '../services/safepay.service';
import { getSafePaySessionStatus } from '../services/safepay.service';
import type { SafePayCheckoutResponse, SafePaySessionStatusResponse } from '../types/SafePay';

export function useSafePayCheckout(orderId: string) {
  const queryClient = useQueryClient();
  const query = useQuery<SafePayCheckoutResponse>({
    queryKey: queryKeys.safepay.checkout(orderId),
    queryFn: () => getSafePayCheckout(orderId),
    enabled: !!orderId,
    staleTime: 0,
  });

  useEffect(() => {
    const order = query.data?.order;
    if (!order || !['paid', 'in_progress', 'ready_for_review', 'completed'].includes(order.status)) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.applicants.detailRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applicants.overview });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.all });
  }, [query.data, queryClient]);

  return query;
}

export function useCreateSafePaySessionMutation(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createSafePaySession(orderId),
    // Explicit rather than relying on the library default: a retried create-session is a
    // second Stripe Checkout Session for the same order. The server does dedupe an `open`
    // session, but a payment call is not something to leave to a default that a future
    // global `defaultOptions.mutations` could change underneath us.
    retry: 0,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.safepay.checkout(orderId) });
    },
  });
}

export function useSafePaySessionStatus(sessionId: string) {
  const queryClient = useQueryClient();
  const query = useQuery<SafePaySessionStatusResponse>({
    queryKey: queryKeys.safepay.status(sessionId),
    queryFn: () => getSafePaySessionStatus(sessionId),
    enabled: !!sessionId,
    staleTime: 0,
  });

  useEffect(() => {
    const data = query.data;
    if (data?.payment_status !== 'paid' || !data.orderId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.safepay.checkout(data.orderId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applicants.detailRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applicants.overview });
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.providerOrders.all });
  }, [query.data, queryClient]);

  return query;
}