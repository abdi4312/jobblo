import { useMutation } from "@tanstack/react-query";
import { updateUser } from "./api";
import { useUserStore } from "../../stores/userStore";
import { toast } from "react-toastify";

export const useUpdateUser = () => {
  const setUser = useUserStore((state) => state.setUser);

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) => 
      updateUser(userId, data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      toast.success('Oppdatert!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kunne ikke oppdatere');
    }
  });
};