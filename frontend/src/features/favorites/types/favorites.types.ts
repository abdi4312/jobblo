export interface FavoriteService {
  _id: string;
  title: string;
  category: string;
  price?: number;
  images?: string[];
}

export interface FavoriteItem {
  _id: string;
  service: FavoriteService;
  user: string;
  createdAt: string;
}

export interface FavoritesResponse {
  favorites: FavoriteItem[];
  data: FavoriteItem[];
}