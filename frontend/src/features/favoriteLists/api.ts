import mainLink from "../../api/mainURLs";
import type { FavoriteList, CreateListDTO, AddServiceToListDTO } from "./types";

export const favoriteListsApi = {
  getUserLists: async (): Promise<FavoriteList[]> => {
    const response = await mainLink.get("/api/lists");
    return response.data;
  },

  getListById: async (listId: string): Promise<FavoriteList> => {
    const response = await mainLink.get(`/api/lists/${listId}`);
    return response.data;
  },

  createList: async (data: CreateListDTO): Promise<FavoriteList> => {
    const response = await mainLink.post("/api/lists", data);
    return response.data;
  },

  updateList: async (listId: string, data: Partial<CreateListDTO> & { public?: boolean, description?: string }): Promise<FavoriteList> => {
    const response = await mainLink.put(`/api/lists/${listId}`, data);
    return response.data;
  },

  addServiceToList: async (data: AddServiceToListDTO): Promise<FavoriteList> => {
    const response = await mainLink.post("/api/lists/add-service", data);
    return response.data;
  },

  addContributor: async (listId: string, userId: string): Promise<FavoriteList> => {
    const response = await mainLink.post(`/api/lists/${listId}/contributors`, { userId });
    return response.data;
  },

  removeContributor: async (listId: string, userId: string): Promise<FavoriteList> => {
    const response = await mainLink.delete(`/api/lists/${listId}/contributors/${userId}`);
    return response.data;
  },

  removeServiceFromList: async (listId: string, serviceId: string): Promise<FavoriteList> => {
    const response = await mainLink.delete(`/api/lists/remove-service/${listId}/${serviceId}`);
    return response.data;
  },

  deleteList: async (listId: string): Promise<void> => {
    await mainLink.delete(`/api/lists/${listId}`);
  },
};
