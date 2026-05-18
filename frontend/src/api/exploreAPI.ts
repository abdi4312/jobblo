import mainLink from "./mainURLs";

export interface FavouriteItem {
  id: string;
  title: string;
  image: string;
  badge?: string;
  type: "job" | "provider" | "business";
  originalId: string;
}

/**
 * Get featured favourites for exploration
 */
export const getFeaturedFavourites = async (): Promise<FavouriteItem[]> => {
  const response = await mainLink.get("/api/explore/favorites");
  return response.data;
};
