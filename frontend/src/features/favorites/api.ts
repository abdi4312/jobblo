import mainLink from "../../api/mainURLs";
import type { FavoritesResponse, FavoriteItem } from "./types/favorites.types";

export const getFavorites = async (): Promise<FavoritesResponse> => {
  const response = await mainLink.get("/api/favorites");
  return response.data;
};

export const checkIsFavorited = async (id: string) => {
  const res = await getFavorites();
  return res.favorites.some((fav: FavoriteItem) => fav.service._id === id);
};

export const setFavorite = async (serviceId: string): Promise<{ success: boolean }> => {
  const response = await mainLink.post(`/api/favorites/${serviceId}`);
  return response.data;
};

export const deleteFavorite = async (serviceId: string): Promise<void> => {
    console.log("serviceId",serviceId);
    
  await mainLink.delete(`/api/favorites/${serviceId}`);
};
