import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchJobs } from "./jobListingAPI";

interface UseJobsParams {
  categories?: string[];
  locations?: string[];
  search?: string;
  sort?: string;
  limit?: number;
  userId?: string;
  urgent?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export const useJobs = ({
  categories = [],
  locations = [],
  search = "",
  sort = "",
  limit = 16,
  userId = "",
  urgent = false,
  minPrice,
  maxPrice,
}: UseJobsParams) => {
  return useInfiniteQuery({
    queryKey: ["jobs", categories, locations, search, sort, userId, urgent, minPrice, maxPrice],

    // TanStack Query v5 mein pageParam ko queryFn ke andar destruct karte hain
    queryFn: ({ pageParam }) =>
      fetchJobs({
        page: pageParam as number, // TypeScript safety ke liye casting
        limit,
        categories,
        locations,
        search,
        sort,
        userId,
        urgent,
        minPrice,
        maxPrice,
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