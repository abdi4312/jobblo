import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getMyApplicantsOverview } from '../services/applicants.service';
import type { MyApplicantsOverviewResponse } from '../types/Applicants';

export function useMyApplicantsOverview(enabled = true) {
  return useQuery<MyApplicantsOverviewResponse>({
    queryKey: queryKeys.applicants.overview,
    queryFn: getMyApplicantsOverview,
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}