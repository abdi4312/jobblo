import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApplicants,
  createSafePayContract,
  getMyApplicantsOverview,
} from "../../api/applicantAPI";

export const useApplicantsQuery = (serviceId: string) => {
  return useQuery({
    queryKey: ["applicants", serviceId],
    queryFn: () => getApplicants(serviceId),
    enabled: !!serviceId,
  });
};

export const useMyApplicantsOverviewQuery = () => {
  return useQuery({
    queryKey: ["applicants-overview"],
    queryFn: getMyApplicantsOverview,
  });
};

export const useCreateSafePayContractMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSafePayContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["jobRequests"] });
    },
  });
};
