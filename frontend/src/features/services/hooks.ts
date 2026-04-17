import { useQuery } from "@tanstack/react-query";
import { getMyPostedServices, deleteService, updateService } from "./api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import type { ServiceUpdateData } from "./types";

export const useMyServices = () => {
  return useQuery({
    queryKey: ["my-services"],
    queryFn: getMyPostedServices,
  });
};

export const useServiceActions = () => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: (_, serviceId) => {
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobDetail", serviceId] });
      toast.success("Annonse slettet!");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Kunne ikke slette annonse");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceUpdateData }) =>
      updateService(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobDetail", variables.id] });
      toast.success("Oppdrag oppdatert!");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Kunne ikke oppdatere");
    },
  });

  return { deleteMutation, updateMutation };
};
