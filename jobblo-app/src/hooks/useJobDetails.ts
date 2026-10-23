import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { jobsService } from '../services/jobs.service';
import { queryKeys } from '../queryKeys';
import type { Job } from '../types/Jobs';

/** A job already loaded by a feed/search list, so the detail screen opens without a spinner. */
function jobFromListCache(client: QueryClient, jobId: string): Job | undefined {
  const find = (value: unknown, depth: number): Job | undefined => {
    if (!value || depth > 3) return undefined;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === 'object' && (entry as Job)._id === jobId) return entry as Job;
        const nested = find(entry, depth + 1);
        if (nested) return nested;
      }
      return undefined;
    }
    if (typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        if (Array.isArray(nested) || (nested && typeof nested === 'object')) {
          const hit = find(nested, depth + 1);
          if (hit) return hit;
        }
      }
    }
    return undefined;
  };
  for (const [key, data] of client.getQueriesData({ queryKey: ['jobs'] })) {
    if (key[1] === 'detail') continue;
    const hit = find(data, 0);
    if (hit) return hit;
  }
  return undefined;
}


export function useJobDetails(jobId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => jobsService.getJob(jobId),
    enabled: !!jobId,
    placeholderData: () => jobFromListCache(client, jobId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
