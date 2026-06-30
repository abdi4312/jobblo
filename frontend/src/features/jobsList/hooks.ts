import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchJobs } from './jobListingAPI';
import type { Tab } from '../../types/tabs';

interface UseJobsParams {
  categories?: string[];
  locations?: string[];
  countyCodes?: string[];
  municipalityCodes?: string[];
  areaCodes?: string[];
  search?: string;
  sort?: string;
  limit?: number;
  userId?: string;
  urgent?: boolean;
  minPrice?: number;
  maxPrice?: number;
  tab?: Tab;
  lat?: number;
  lng?: number;
  radius?: number;
}

export const useJobs = ({
  categories = [],
  locations = [],
  countyCodes = [],
  municipalityCodes = [],
  areaCodes = [],
  search = '',
  sort = '',
  limit = 16,
  userId = '',
  urgent = false,
  minPrice,
  maxPrice,
  tab = "Discover",
  lat,
  lng,
  radius,
}: UseJobsParams) => {
  return useInfiniteQuery({
    queryKey: [
      'jobs',
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
      tab,
      lat,
      lng,
      radius,
    ],

    // TanStack Query v5 mein pageParam ko queryFn ke andar destruct karte hain
    queryFn: ({ pageParam }) =>
      fetchJobs({
        page: pageParam as number, // TypeScript safety ke liye casting
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
        tab,
        lat,
        lng,
        radius,
      }),

    // FIXED: Yeh property add karna zaroori hai
    initialPageParam: 1,

    getNextPageParam: (lastPage, allPages) => {
      const currentPage = allPages.length;
      const totalPages = lastPage.pagination.totalPages;

      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
  });
};
