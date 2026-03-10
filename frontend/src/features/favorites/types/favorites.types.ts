export interface FavoriteService {
  _id: string;
  title: string;
  category: string;
  price?: number;
  images?: string[];
  // Baki fields jo aapke service object mein hain wo yahan add karein
}

export interface FavoritesResponse {
  favorites: FavoriteService[];
}