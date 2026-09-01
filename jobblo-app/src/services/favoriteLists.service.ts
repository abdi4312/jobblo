import apiClient from '../api/client';
import type {
  AddServiceToFavoriteListPayload,
  CreateFavoriteListPayload,
  FavoriteList,
  UpdateFavoriteListPayload,
} from '../types/FavoriteList';

/**
 * Favorite / saved list service — the only place mobile talks to `/api/lists`.
 *
 * `apiClient.baseURL` already ends in `/api`, so paths here are relative.
 *
 * The endpoints are exactly the seven that exist on the backend
 * (`backend/routes/lists.js`); nothing here is invented:
 *
 *   GET    /lists
 *   GET    /lists/:listId
 *   POST   /lists
 *   PUT    /lists/:listId
 *   POST   /lists/add-service
 *   DELETE /lists/remove-service/:listId/:serviceId
 *   DELETE /lists/:listId
 *
 * The contributor endpoints (`POST /lists/:listId/contributors`,
 * `DELETE /lists/:listId/contributors/:userId`) are intentionally NOT wrapped —
 * contributor collaboration is deferred for mobile, and an unused client method would
 * imply a surface that does not exist in the app.
 */
export const favoriteListsService = {
  /**
   * The signed-in user's own lists (owned + lists they contribute to).
   *
   * Deliberately sends no `userId` query parameter. The backend derives the owner from
   * the authenticated `req.userId`; passing an id from the client would make the client
   * the authority on whose lists to return, and the `userId !== currentUserId` branch
   * would silently narrow the result to public lists only.
   */
  async fetchMyLists(): Promise<FavoriteList[]> {
    const response = await apiClient.get<FavoriteList[]>('/lists');
    return Array.isArray(response.data) ? response.data : [];
  },

  async fetchList(listId: string): Promise<FavoriteList> {
    const response = await apiClient.get<FavoriteList>(`/lists/${listId}`);
    return response.data;
  },

  /** Backend accepts `name` only at creation — description/public are set afterwards. */
  async createList(payload: CreateFavoriteListPayload): Promise<FavoriteList> {
    const response = await apiClient.post<FavoriteList>('/lists', { name: payload.name });
    return response.data;
  },

  /** Owner-only on the backend; the caller is responsible for gating the UI. */
  async updateList(listId: string, payload: UpdateFavoriteListPayload): Promise<FavoriteList> {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.public !== undefined) body.public = payload.public;

    const response = await apiClient.put<FavoriteList>(`/lists/${listId}`, body);
    return response.data;
  },

  async addServiceToList(payload: AddServiceToFavoriteListPayload): Promise<FavoriteList> {
    const response = await apiClient.post<FavoriteList>('/lists/add-service', {
      listId: payload.listId,
      serviceId: payload.serviceId,
    });
    return response.data;
  },

  async removeServiceFromList(listId: string, serviceId: string): Promise<FavoriteList> {
    const response = await apiClient.delete<FavoriteList>(
      `/lists/remove-service/${listId}/${serviceId}`
    );
    return response.data;
  },

  async deleteList(listId: string): Promise<void> {
    await apiClient.delete(`/lists/${listId}`);
  },
};
