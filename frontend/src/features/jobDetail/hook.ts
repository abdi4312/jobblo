import { useMutation, useQuery } from "@tanstack/react-query";
import { getJobDetail, checkIsFavorited,createChat, createStripeSession, getNearbyJobs} from "./jobApi";

export const useJobDetailQuery = (id: string) => {
  return useQuery({
    queryKey: ["jobDetail", id],
    queryFn: () => getJobDetail(id),
    enabled: !!id,
  });
};

export const useFavoriteStatusQuery = (id: string, isAuth: boolean) => {
  return useQuery({
    queryKey: ["favoriteStatus", id],
    queryFn: () => checkIsFavorited(id),
    enabled: !!id && isAuth,
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
        .filter((job: any) => job._id !== currentJobId)
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