import { useQuery } from '@tanstack/react-query';
import { jobsService } from '../services/jobs.service';
import { queryKeys } from '../queryKeys';

export function useJobDetails(jobId: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => jobsService.getJob(jobId),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
