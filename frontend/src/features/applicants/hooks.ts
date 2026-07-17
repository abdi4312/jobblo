import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getApplicants,
  createSafePayContract,
  getMyApplicantsOverview,
  getMyApplicationsOverview,
  withdrawMyApplication,
  toggleApplicantFavorite,
  toggleApplicantArchive,
  declineApplicant,
} from '../../api/applicantAPI';

export const useApplicantsQuery = (serviceId: string, sort?: string, filter?: string) => {
  return useQuery({
    queryKey: ['applicants', serviceId, sort, filter],
    queryFn: () => getApplicants(serviceId, sort, filter),
    enabled: !!serviceId,
  });
};

export const useMyApplicantsOverviewQuery = () => {
  return useQuery({
    queryKey: ['applicants-overview'],
    queryFn: getMyApplicantsOverview,
  });
};

export const useMyApplicationsOverviewQuery = (status?: string) => {
  return useQuery({
    queryKey: ['my-applications-overview', status],
    queryFn: () => getMyApplicationsOverview(status),
  });
};

export const useWithdrawApplicationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withdrawMyApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-applications-overview'] });
    },
  });
};

export const useCreateSafePayContractMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSafePayContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
    },
  });
};

export const useToggleApplicantFavoriteMutation = (serviceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleApplicantFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
  });
};

export const useToggleApplicantArchiveMutation = (serviceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleApplicantArchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
  });
};

export const useDeclineApplicantMutation = (serviceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { requestId: string; archive?: boolean }) =>
      declineApplicant(data.requestId, data.archive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
  });
};
