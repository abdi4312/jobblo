import { useQuery } from "@tanstack/react-query";
import { getLocationTree, getLocationStats } from "./locationAPI";
import type { LocationNode, LocationStats } from "../../api/locationAPI";

export const useLocationTree = () => {
  return useQuery<LocationNode[]>({
    queryKey: ["locationTree"],
    queryFn: getLocationTree,

    staleTime: 1000 * 60 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 5,

    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

export const useLocationStats = () => {
  return useQuery<LocationStats>({
    queryKey: ["locationStats"],
    queryFn: getLocationStats,

    staleTime: 1000 * 60 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 5,

    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
