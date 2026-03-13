import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFavorites, deleteFavorite, setFavorite, checkIsFavorited } from "../api"; 
// import { toast } from "react-toastify";
import toast from "react-hot-toast";

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    staleTime: 1000 * 60 * 5, 
  });
}

export const useFavoriteStatusQuery = (id: string, isAuth: boolean) => {
  return useQuery({
    queryKey: ["favoriteStatus", id],
    queryFn: () => checkIsFavorited(id),
    enabled: !!id && isAuth,
  });
};

export function useFavoriteActions(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();

  // Mutation for adding to favorites
  const addMutation = useMutation({
    mutationFn: (id: string) => setFavorite(id), // Explicitly passing ID
    onSuccess: (_, id) => {
      toast.success("Lagt til i favoritter");
      // Specific status aur list dono refresh honge
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteStatus", id] });
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      console.error("Failed to add favorite", err);
      toast.error(err?.response?.data?.error || "Kunne ikke legge til favoritt");
    },
  });

  // Mutation for removing from favorites
  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteFavorite(id), // Explicitly passing ID
    onSuccess: (_, id) => {
      toast.success("Fjernet fra favoritter");
      // Specific status aur list dono refresh honge
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteStatus", id] });
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      console.error("Failed to remove favorite", err);
      // 404 error yahan catch hoga agar ID galat hai
      toast.error(err?.response?.data?.error || "Kunne ikke fjerne favoritt");
    },
  });

  return {
    addFavorite: addMutation.mutate,
    isAdding: addMutation.isPending,
    removeFavorite: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  };
}