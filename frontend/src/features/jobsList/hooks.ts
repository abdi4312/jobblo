import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchJobs } from "./jobListingAPI";

interface UseJobsParams {
  categories?: string[];
  search?: string;
  limit?: number;
}

export const useJobs = ({
  categories = [],
  search = "",
  limit = 16,
}: UseJobsParams) => {
  return useInfiniteQuery({
    queryKey: ["jobs", categories, search],

    // TanStack Query v5 mein pageParam ko queryFn ke andar destruct karte hain
    queryFn: ({ pageParam }) =>
      fetchJobs({
        page: pageParam as number, // TypeScript safety ke liye casting
        limit,
        categories,
        search,
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