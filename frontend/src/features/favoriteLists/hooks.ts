import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { favoriteListsApi } from './api';
import type { CreateListDTO, AddServiceToListDTO, UpdateListDTO } from './types';
import { useUserStore } from '../../stores/userStore';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../utils/getErrorMessage';

/**
 * Four of these eight mutations had no onError at all, and their callers also
 * swallowed the rejection — a failed save was doubly silent. All eight now share
 * one handler, and the toasts are in Norwegian rather than English.
 */
const onErrorToast = (fallback: string) => (error: unknown) =>
  toast.error(getErrorMessage(error, fallback));

export const favoriteListsKeys = {
  all: ['favoriteLists'] as const,
  userLists: (userId?: string) => ['favoriteLists', 'user', userId] as const,
  list: (listId: string) => ['favoriteLists', 'detail', listId] as const,
};

export const useFavoriteLists = (userId?: string) => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: favoriteListsKeys.userLists(userId),
    queryFn: () => favoriteListsApi.getUserLists(userId),
    enabled: isAuthenticated,
  });
};

export const useFavoriteList = (listId: string) => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: favoriteListsKeys.list(listId),
    queryFn: () => favoriteListsApi.getListById(listId),
    enabled: isAuthenticated && !!listId,
  });
};

export const useCreateFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateListDTO) => favoriteListsApi.createList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.all });
      toast.success('Listen ble opprettet.');
    },
    onError: onErrorToast('Kunne ikke opprette listen.'),
  });
};

export const useUpdateFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: UpdateListDTO }) =>
      favoriteListsApi.updateList(listId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.all });
      queryClient.invalidateQueries({
        queryKey: favoriteListsKeys.list(variables.listId),
      });
      toast.success('Listen ble oppdatert.');
    },
    onError: onErrorToast('Kunne ikke oppdatere listen.'),
  });
};

export const useAddContributor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      favoriteListsApi.addContributor(listId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: favoriteListsKeys.list(variables.listId),
      });
      toast.success('Deltakeren ble lagt til.');
    },
    onError: onErrorToast('Kunne ikke legge til deltakeren.'),
  });
};

export const useRemoveContributor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      favoriteListsApi.removeContributor(listId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: favoriteListsKeys.list(variables.listId),
      });
      toast.success('Deltakeren ble fjernet.');
    },
    onError: onErrorToast('Kunne ikke fjerne deltakeren.'),
  });
};

export const useAddServiceToFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddServiceToListDTO) => favoriteListsApi.addServiceToList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.all });
      toast.success('Lagt til i listen.');
    },
    onError: onErrorToast('Kunne ikke legge til i listen.'),
  });
};

export const useRemoveServiceFromFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, serviceId }: { listId: string; serviceId: string }) =>
      favoriteListsApi.removeServiceFromList(listId, serviceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.all });
      queryClient.invalidateQueries({
        queryKey: favoriteListsKeys.list(variables.listId),
      });
      toast.success('Fjernet fra listen.');
    },
    onError: onErrorToast('Kunne ikke fjerne fra listen.'),
  });
};

export const useDeleteFavoriteList = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => favoriteListsApi.deleteList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteListsKeys.all });
      toast.success('Listen ble slettet.');
    },
    onError: onErrorToast('Kunne ikke slette listen.'),
  });
};
