import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, type DashboardStats } from '../services/explore.service';
import { queryKeys } from '../queryKeys';

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.explore.stats,
    queryFn: getDashboardStats,
    staleTime: 5 * 60 * 1000,
  });
}
