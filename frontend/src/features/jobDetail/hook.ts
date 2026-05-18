import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getJobDetail,
  createChat,
  createStripeSession,
  getNearbyJobs,
} from "./jobApi";
import { fetchJobs } from "../jobsList/jobListingAPI";
import {
  createOrder,
  updateOrderStatus,
  getAllOrders,
  createJobRequest,
  getMyJobRequests,
  updateJobRequestStatus,
} from "../../api/orderAPI";
import type { Jobs } from "../../types/Jobs";

export const useJobDetailQuery = (id: string) => {
  return useQuery({
    queryKey: ["jobDetail", id],
    queryFn: () => getJobDetail(id),
    enabled: !!id,
  });
};

export const useAllOrdersQuery = (isAuthenticated: boolean) => {
  return useQuery({
    queryKey: ["orders"],
    queryFn: getAllOrders,
    enabled: isAuthenticated,
  });
};

export const useMyJobRequestsQuery = (isAuthenticated: boolean) => {
  return useQuery({
    queryKey: ["jobRequests"],
    queryFn: getMyJobRequests,
    enabled: isAuthenticated,
  });
};

export const useCreateJobRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJobRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobRequests"] });
    },
  });
};

export const useUpdateJobRequestStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      status,
    }: {
      requestId: string;
      status: string;
    }) => updateJobRequestStatus(requestId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobRequests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useCreateOrderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useUpdateOrderStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useRecommendedJobsQuery = (
  coordinates: [number, number] | undefined,
  categories: string[] | undefined,
  currentJobId: string,
) => {
  return useQuery({
    queryKey: ["recommendedJobs", coordinates, categories, currentJobId],
    queryFn: async () => {
      let jobs: Jobs[] = [];

      // 1. Try nearby jobs if coordinates exist
      if (coordinates && coordinates.length === 2) {
        const [longitude, latitude] = coordinates;
        try {
          const nearbyData = await getNearbyJobs(latitude, longitude, 50000);
          if (Array.isArray(nearbyData)) {
            jobs = nearbyData;
          }
        } catch (error) {
          console.error("Error fetching nearby jobs:", error);
        }
      }

      // 2. If no nearby jobs or no coordinates, try by category
      if (jobs.length < 7 && categories && categories.length > 0) {
        try {
          const categoryData = await fetchJobs({
            categories: categories,
            limit: 12, // Get more to filter out current job
          });
          if (categoryData && Array.isArray(categoryData.data)) {
            // Merge and avoid duplicates
            const categoryJobs = categoryData.data.filter(
              (cj) => !jobs.some((nj) => nj._id === cj._id),
            );
            jobs = [...jobs, ...categoryJobs];
          }
        } catch (error) {
          console.error("Error fetching category jobs:", error);
        }
      }

      // 3. If still not enough, just get any latest jobs
      if (jobs.length < 7) {
        try {
          const latestData = await fetchJobs({ limit: 12 });
          if (latestData && Array.isArray(latestData.data)) {
            const latestJobs = latestData.data.filter(
              (lj) => !jobs.some((j) => j._id === lj._id),
            );
            jobs = [...jobs, ...latestJobs];
          }
        } catch (error) {
          console.error("Error fetching latest jobs:", error);
        }
      }

      // Filter current job and take only first 6
      return jobs.filter((job: Jobs) => job._id !== currentJobId).slice(0, 6);
    },
    staleTime: 1000 * 60 * 60 * 5, // 5 hours
    gcTime: 1000 * 60 * 60 * 5,
  });
};

export const useNearbyJobsQuery = (
  coordinates: [number, number] | undefined,
  currentJobId: string,
) => {
  return useQuery({
    queryKey: ["nearbyJobs", coordinates, currentJobId],
    queryFn: async () => {
      if (!coordinates || coordinates.length !== 2) return [];

      const [longitude, latitude] = coordinates;
      // getNearbyJobs(lat, lng, radius)
      const data = await getNearbyJobs(latitude, longitude, 50000);

      // Filter current job and take only first 6
      return data.filter((job: Jobs) => job._id !== currentJobId).slice(0, 6);
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
