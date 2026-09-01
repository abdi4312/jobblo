import { useQuery } from '@tanstack/react-query';
import { jobsService } from '../services/jobs.service';
import { queryKeys } from '../queryKeys';
import type { FetchJobsParams } from '../types/Jobs';

interface UseJobsParams extends FetchJobsParams {
  enabled?: boolean;
}

/**
 * Hook for fetching jobs/services with TanStack Query.
 *
 * Centralizes all job discovery queries. The mobile Home screen uses this
 * to fetch jobs with optional filtering by category, search, sort, etc.
 *
 * Query key: queryKeys.jobs.list(params)
 *
 * Example:
 *   const { data, isLoading, isError, error } = useJobs({
 *     categories: ['Cleaning'],
 *     sort: 'newest',
 *     limit: 8,
 *   });
 *
 * @param params - Fetch params including page, limit, categories, search, sort, etc.
 * @returns useQuery result with data, isLoading, isError, error
 */
export const useJobs = ({
  page = 1,
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
}: UseJobsParams) => {
  return useQuery({
    queryKey: queryKeys.jobs.list({
      page,
      limit,
      categories,
      search,
      sort,
      urgent,
    }),
    queryFn: () =>
      jobsService.fetchJobs({
        page,
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
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
};
