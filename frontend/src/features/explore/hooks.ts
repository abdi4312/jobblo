import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '../../api/exploreAPI';

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
