import mainLink from './mainURLs';

export interface FavouriteItem {
  id: string;
  title: string;
  image: string;
  badge?: string;
  type: 'job' | 'provider' | 'business';
  originalId: string;
}

export interface DashboardStats {
  activeJobs: number;
  totalUsers: number;
  averageRating: number;
}

/**
 * Get featured favourites for exploration
 */
export const getFeaturedFavourites = async (): Promise<FavouriteItem[]> => {
  const response = await mainLink.get('/api/explore/favorites');
  return response.data;
};

/**
 * Get dashboard stats (active jobs, total users, average rating)
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await mainLink.get('/api/explore/stats');
  return response.data;
};
