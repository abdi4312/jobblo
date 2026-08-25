import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { favoriteListsService } from '../services/favoriteLists.service';
import { queryKeys } from '../queryKeys';
import { useAuthStore } from '../store/authStore';
import {
  isServiceInAnyList,
  type CreateFavoriteListPayload,
  type FavoriteList,
  type UpdateFavoriteListPayload,
} from '../types/FavoriteList';

/**
 * TanStack Query layer for saved lists / Lagrede lister.
 *
 * Screens never call the service directly. Every mutation sets `retry: false` — a
 * create, a rename, a delete and an add-service are all non-idempotent enough that a
 * silent second attempt is worse than an error message, and `service_already_in_list`
 * would be the visible result of retrying a save that actually succeeded.
 *
 * Invalidation is scoped. `queryKeys.favoriteLists.all` is the overview, and
 * `detail(listId)` is one list — nothing here touches the rest of the app's cache.
 */

/** Overview + the one detail affected. Used after every write. */
async function invalidateList(queryClient: QueryClient, listId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.favoriteLists.all }),
    ...(listId
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.favoriteLists.detail(listId) })]
      : []),
  ]);
}

/**
 * The signed-in user's saved lists.
 *
 * Shared by the overview, the save sheet and the bookmark on every job card — TanStack
 * dedupes on the key, so a grid of cards produces one request, not one per card.
 */
export function useFavoriteLists() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<FavoriteList[]>({
    queryKey: queryKeys.favoriteLists.all,
    queryFn: favoriteListsService.fetchMyLists,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

/** One saved list with its populated services. */
export function useFavoriteList(listId: string | undefined) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<FavoriteList>({
    queryKey: queryKeys.favoriteLists.detail(listId ?? ''),
    queryFn: () => favoriteListsService.fetchList(listId as string),
    enabled: isAuthenticated && !!listId,
  });
}

/**
 * Whether a service is saved anywhere, derived from the shared lists query.
 *
 * There is no server-side `isFavorite` flag and a boolean would be misleading anyway,
 * because one service can sit in several lists. `isLoading` is exposed so callers can
 * avoid rendering an empty bookmark as though it were a confirmed "not saved".
 */
export function useIsServiceSaved(serviceId: string | undefined) {
  const { data: lists, isLoading, isError } = useFavoriteLists();

  return {
    isSaved: isServiceInAnyList(lists, serviceId),
    isLoading,
    isError,
  };
}

export function useCreateFavoriteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateFavoriteListPayload) => favoriteListsService.createList(payload),
    retry: false,
    onSuccess: () => invalidateList(queryClient),
  });
}

export function useUpdateFavoriteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: UpdateFavoriteListPayload }) =>
      favoriteListsService.updateList(listId, data),
    retry: false,
    onSuccess: (_result, variables) => invalidateList(queryClient, variables.listId),
  });
}

export function useDeleteFavoriteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listId: string) => favoriteListsService.deleteList(listId),
    retry: false,
    onSuccess: async (_result, listId) => {
      // The detail entry is dropped rather than refetched — the route is unmounting and
      // a refetch would only produce a 404.
      queryClient.removeQueries({ queryKey: queryKeys.favoriteLists.detail(listId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.favoriteLists.all });
    },
  });
}

export function useAddServiceToFavoriteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, serviceId }: { listId: string; serviceId: string }) =>
      favoriteListsService.addServiceToList({ listId, serviceId }),
    retry: false,
    onSuccess: (_result, variables) => invalidateList(queryClient, variables.listId),
  });
}

export function useRemoveServiceFromFavoriteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, serviceId }: { listId: string; serviceId: string }) =>
      favoriteListsService.removeServiceFromList(listId, serviceId),
    retry: false,
    onSuccess: (_result, variables) => invalidateList(queryClient, variables.listId),
  });
}

/**
 * "Create a list, then put this service in it" as one user-visible action.
 *
 * The new list's id comes from the create response — it is never guessed. If the create
 * succeeds and the add then fails, the list is KEPT: there is no transactional endpoint
 * to undo it, and deleting a list the user just named would be a worse lie than telling
 * them the save failed. The caller gets `{ list, added }` so it can say which half
 * happened.
 */
export function useCreateFavoriteListAndSave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, serviceId }: { name: string; serviceId: string }) => {
      const list = await favoriteListsService.createList({ name });

      try {
        await favoriteListsService.addServiceToList({ listId: list._id, serviceId });
        return { list, added: true as const, addError: null };
      } catch (addError) {
        return { list, added: false as const, addError };
      }
    },
    retry: false,
    onSuccess: (result) => invalidateList(queryClient, result.list._id),
    onError: () => invalidateList(queryClient),
  });
}
