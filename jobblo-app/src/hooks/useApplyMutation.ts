/**
 * useApplyMutation - TanStack Query mutation for applying to a job.
 * Handles submission, loading, errors, and cache invalidation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applyToJob } from '../services/applications.service';
import { queryKeys } from '../queryKeys';
import type { CreateJobRequestPayload, JobRequest } from '../types/Application';

interface UseApplyMutationOptions {
  onSuccess?: (data: JobRequest) => void;
  onError?: (error: any) => void;
}

export function useApplyMutation(options?: UseApplyMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateJobRequestPayload) => applyToJob(payload),
    onSuccess: (data) => {
      // Invalidate job requests list to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current });

      // Invalidate the specific job's detail query so the button state updates
      if (typeof data.serviceId === 'object' && data.serviceId._id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobs.detail(data.serviceId._id),
        });
      }

      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
