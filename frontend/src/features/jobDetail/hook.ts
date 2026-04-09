import { useMutation, useQuery } from "@tanstack/react-query";
import { getJobDetail ,createChat, createStripeSession, getNearbyJobs} from "./jobApi";
import type { Jobs } from "../../types/Jobs";

export const useJobDetailQuery = (id: string) => {
  return useQuery({
    queryKey: ["jobDetail", id],
    queryFn: () => getJobDetail(id),
    enabled: !!id,
  });
};

export const useNearbyJobsQuery = (coordinates: [number, number] | undefined, currentJobId: string) => {
  return useQuery({
    queryKey: ["nearbyJobs", coordinates, currentJobId],
    queryFn: async () => {
      if (!coordinates || coordinates.length !== 2) return [];
      
      const [longitude, latitude] = coordinates;
      // getNearbyJobs(lat, lng, radius)
      const data = await getNearbyJobs(latitude, longitude, 50000);

      // Filter current job and take only first 4
      return data
        .filter((job: Jobs) => job._id !== currentJobId)
        .slice(0, 4);
    },
    enabled: !!coordinates && coordinates.length === 2,
    staleTime: 1000 * 60 * 60 * 5, // 5 hours
    gcTime: 1000 * 60 * 60 * 5,
  });
};

export const useSendMessageMutation = () => {
  return useMutation({
    mutationFn: createChat,
  });
};

// Mutation for Stripe
export const useStripeMutation = () => {
  return useMutation({
    mutationFn: createStripeSession,
  });
};