import type { FavoritesResponse } from "../types/FavoritesTypes.ts";
import mainLink from "./mainURLs.ts";

export async function getFavorites() {
  const res = await mainLink.get<FavoritesResponse>("/api/favorites");
  return res.data;
}

export async function setFavorites(serviceId: string) {
  const res = await mainLink.post(`/api/favorites/${serviceId}`);
  return res.data;
}

export async function deleteFavorites(serviceId: string) {
  const res = await mainLink.delete(`/api/favorites/${serviceId}`);
  return res.data;
}
