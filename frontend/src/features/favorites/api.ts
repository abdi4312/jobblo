import mainLink from "../../api/mainURLs";
import type { FavoritesResponse } from "./types/favorites.types";

export const getFavorites = async (): Promise<FavoritesResponse> => {
  const response = await mainLink.get("/api/favorites");
  return response.data;
};

export const checkIsFavorited = async (id: string) => {
  const res = await getFavorites();
  return res.data.some((fav: any) => fav.service._id === id);
};

export const setFavorite = async (serviceId: string): Promise<any> => {
  const response = await mainLink.post(`/api/favorites/${serviceId}`);
  return response.data;
};

export const deleteFavorite = async (serviceId: string): Promise<void> => {
    console.log("serviceId",serviceId);
    
  await mainLink.delete(`/api/favorites/${serviceId}`);
};
