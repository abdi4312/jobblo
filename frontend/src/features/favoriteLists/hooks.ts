import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { favoriteListsApi } from "./api";
import type { CreateListDTO, AddServiceToListDTO } from "./types";
import { toast } from "react-hot-toast";

export const favoriteListsKeys = {
  all: ["favoriteLists"] as const,
  userLists: ["favoriteLists", "user"] as const,
};

export const useFavoriteLists = () => {
  return useQuery({
    queryKey: favoriteListsKeys.userLists,
    queryFn: favoriteListsApi.getUserLists,
  });
};

export const useFavoriteList = (listId: string) => {
  return useQuery({
    queryKey: [...favoriteListsKeys.userLists, listId],
    queryFn: () => favoriteListsApi.getListById(listId),
    enabled: !!listId,
  });
};

export const useCreateFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateListDTO) => favoriteListsApi.createList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.userLists });
      toast.success("List created successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create list");
    },
  });
};

export const useUpdateFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, data }: { listId: string, data: any }) => favoriteListsApi.updateList(listId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.userLists });
      queryClient.invalidateQueries({ queryKey: [...favoriteListsKeys.userLists, variables.listId] });
      toast.success("List updated successfully");
    },
  });
};

export const useAddContributor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      favoriteListsApi.addContributor(listId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...favoriteListsKeys.userLists, variables.listId] });
      toast.success("Contributor added successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to add contributor");
    },
  });
};

export const useRemoveContributor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      favoriteListsApi.removeContributor(listId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...favoriteListsKeys.userLists, variables.listId] });
      toast.success("Contributor removed");
    },
  });
};

export const useAddServiceToFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddServiceToListDTO) => favoriteListsApi.addServiceToList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.userLists });
      toast.success("Added to list");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to add to list");
    },
  });
};

export const useRemoveServiceFromFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, serviceId }: { listId: string; serviceId: string }) =>
      favoriteListsApi.removeServiceFromList(listId, serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.userLists });
      toast.success("Removed from list");
    },
  });
};

export const useDeleteFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => favoriteListsApi.deleteList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.userLists });
      toast.success("List deleted successfully");
    },
  });
};
