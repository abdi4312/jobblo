import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import {
  getLists,
  getListById,
  createList,
  addServiceToList,
  removeServiceFromList,
  updateList,
  deleteList,
  addContributors,
  removeContributor,
} from "../api/list";
import { List } from "../types";

export const useLists = (userId?: string) => {
  return useQuery<List[]>({
    queryKey: ["lists", userId],
    queryFn: () => getLists(userId),
  });
};

export const useList = (listId: string) => {
  return useQuery<List>({
    queryKey: ["list", listId],
    queryFn: () => getListById(listId),
    enabled: !!listId,
  });
};

export const useCreateList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
};

export const useAddServiceToList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      serviceId,
    }: {
      listId: string;
      serviceId: string;
    }) => addServiceToList(listId, serviceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list", data._id] });
    },
  });
};

export const useRemoveServiceFromList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      serviceId,
    }: {
      listId: string;
      serviceId: string;
    }) => removeServiceFromList(listId, serviceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list", variables.listId] });
    },
  });
};

export const useUpdateList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: Partial<List> }) =>
      updateList(listId, data),
    onSuccess: (data, variables) => {
      // Invalidate the specific list to force a re-fetch since backend return is unpopulated
      queryClient.invalidateQueries({ queryKey: ["list", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (error: any) => {
      console.error(
        "Update List Error:",
        error.response?.data || error.message,
      );
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to update list",
      );
    },
  });
};

export const useDeleteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
};

export const useAddContributors = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, userIds }: { listId: string; userIds: string[] }) =>
      addContributors(listId, userIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list", data._id] });
    },
  });
};

export const useRemoveContributor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      removeContributor(listId, userId),
    onSuccess: (data, variables) => {
      // Force a re-fetch since backend return is unpopulated
      queryClient.invalidateQueries({ queryKey: ["list", variables.listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
};
