import { useQuery } from "@tanstack/react-query";
import { getCategories } from "./categoryAPI";
import type { CategoryType } from "./types";

export const useCategories = () => {
  return useQuery<CategoryType[]>({
    queryKey: ["categories"],
    queryFn: getCategories,

    staleTime: 1000 * 60 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 5,

    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
