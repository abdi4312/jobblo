import { useQuery } from '@tanstack/react-query';
import { getFeaturedFavourites, getDashboardStats } from '../../api/exploreAPI';

export const useFeaturedFavourites = () => {
  return useQuery({
    queryKey: ['featuredFavourites'],
    queryFn: getFeaturedFavourites,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
