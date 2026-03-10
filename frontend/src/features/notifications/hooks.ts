import { useInfiniteQuery, } from "@tanstack/react-query";
import { getNotifications } from "./api";

export const useNotifications = (userId: string | undefined) => {
  return useInfiniteQuery({
    queryKey: ["notifications", userId],
    queryFn: ({ pageParam = 1 }) => getNotifications(userId!, pageParam),
    getNextPageParam: (lastPage) => {
      // Backend response fields: lastPage.currentPage aur lastPage.totalPages
      const nextPage = lastPage.currentPage + 1;
      
      // Agar agla page totalPages se zyada nahi hai, toh return karo, warna undefined
      return nextPage <= lastPage.totalPages ? nextPage : undefined;
    },
    initialPageParam: 1,
    enabled: !!userId,
  });
};
