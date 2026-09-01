import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getSafePayHistory, type SafePayHistoryResponse } from '../services/safepayHistory.service';

export function useSafePayHistory() {
  return useQuery<SafePayHistoryResponse>({
    queryKey: queryKeys.safepay.history,
    queryFn: getSafePayHistory,
    refetchOnMount: 'always',
  });
}
