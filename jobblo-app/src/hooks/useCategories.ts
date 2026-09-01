import { useQuery } from '@tanstack/react-query';
import { categoriesService } from '../services/categories.service';
import { queryKeys } from '../queryKeys';

/**
 * Hook to fetch available categories and filter options.
 *
 * Caches results with a long stale time since categories rarely change.
 * Uses the same TanStack Query pattern as useJobs.
 */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesService.getFilterOptions(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}
