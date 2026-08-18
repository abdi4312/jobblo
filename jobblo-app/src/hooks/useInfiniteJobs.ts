import { useInfiniteQuery } from '@tanstack/react-query';
import { jobsService } from '../services/jobs.service';
import { queryKeys } from '../queryKeys';
import type { FetchJobsParams, JobsResponse } from '../types/Jobs';

interface UseInfiniteJobsParams extends Omit<FetchJobsParams, 'page'> {
  enabled?: boolean;
}

/**
 * Hook for infinite query pagination using TanStack Query's useInfiniteQuery.
 *
 * Used by Explore/Search screen for true infinite scroll pagination.
 * Each page is fetched separately and accumulated in TanStack Query's internal pages array.
 *
 * Query key: queryKeys.jobs.infinite(params)
 *
 * Example:
 *   const {
 *     data,
 *     hasNextPage,
 *     fetchNextPage,
 *     isFetchingNextPage,
 *     isLoading,
 *   } = useInfiniteJobs({
 *     search: 'maling',
 *     categories: ['Maling'],
 *     sort: 'newest',
 *   });
 *
 * Rendering:
 *   const flatJobs = data?.pages.flatMap(page => page.data) ?? [];
 *
 * @param params - Fetch params (excluding page; managed by pagination)
 * @returns useInfiniteQuery result with pages, hasNextPage, fetchNextPage, etc.
 */
export const useInfiniteJobs = ({
  limit = 16,
  categories = [],
  locations = [],
  countyCodes = [],
  municipalityCodes = [],
  areaCodes = [],
  search = '',
  sort = '',
  userId = '',
  urgent = false,
  minPrice,
  maxPrice,
  lat,
  lng,
  radius,
  enabled = true,
}: UseInfiniteJobsParams) => {
  return useInfiniteQuery({
    queryKey: queryKeys.jobs.infinite({
      limit,
      categories,
      search,
      sort,
      urgent,
    }),
    queryFn: ({ pageParam = 1 }) =>
      jobsService.fetchJobs({
        page: pageParam,
        limit,
        categories,
        locations,
        countyCodes,
        municipalityCodes,
        areaCodes,
        search,
        sort,
        userId,
        urgent,
        minPrice,
        maxPrice,
        lat,
        lng,
        radius,
      }),
    getNextPageParam: (lastPage: JobsResponse) => {
      // Return next page number if there are more pages
      if (
        lastPage.pagination &&
        lastPage.pagination.page < lastPage.pagination.totalPages
      ) {
        return lastPage.pagination.page + 1;
      }
      // Return undefined to signal no more pages
      return undefined;
    },
    initialPageParam: 1,
    enabled,
  });
};
