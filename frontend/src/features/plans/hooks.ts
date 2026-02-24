import { useQuery } from "@tanstack/react-query";
import { getPlans } from "./api";
import type { Plan } from "../plans/types";


export const usePlans = () => {
  return useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: getPlans,

    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,

    refetchOnWindowFocus: false,
    refetchOnMount: false,

    select: (data) => data?.filter((plan) => plan.isActive),
  });
};
