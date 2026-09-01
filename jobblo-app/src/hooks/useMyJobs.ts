import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsService } from '../services/jobs.service';
import { queryKeys } from '../queryKeys';
import type { MyJob } from '../types/Jobs';

/** Owner listings from GET /api/services/my-posted. */
export function useMyJobs() {
  return useQuery<MyJob[]>({
    queryKey: queryKeys.jobs.mine,
    queryFn: jobsService.fetchMyJobs,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

/**
 * Delete an owner listing. Invalidation is scoped to the lists that can now show
 * a stale row — the owner list, public discovery lists and the applicant overview.
 */
export function useDeleteMyJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => jobsService.deleteMyJob(serviceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.mine }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.infinite() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applicants.overview }),
      ]);
    },
  });
}
