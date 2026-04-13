import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchJobs, toggleLikeService } from "./jobListingAPI";
import type { Tab } from "../../types/tabs";

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
  tab?: Tab;
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
  tab = "Discover",
}: UseJobsParams) => {
  return useInfiniteQuery({
    queryKey: [
      "jobs",
      categories,
      locations,
      search,
      sort,
      userId,
      urgent,
      minPrice,
      maxPrice,
      tab,
    ],

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
        tab,
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

export const useToggleLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceId: string) => toggleLikeService(serviceId),
    onSuccess: (_, serviceId) => {
      // Invalidate normal jobs list, feeds AND the specific job detail
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobDetail", serviceId] });
    },
  });
};
