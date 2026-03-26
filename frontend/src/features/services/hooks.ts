import { useQuery } from "@tanstack/react-query";
import { getMyPostedServices, deleteService, updateService } from "./api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
      toast.success("Annonse slettet!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Kunne ikke slette annonse");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-services"] });
      toast.success("Oppdrag oppdatert!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Kunne ikke oppdatere");
    }
  });

  return { deleteMutation, updateMutation };
};