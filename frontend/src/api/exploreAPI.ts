import mainLink from './mainURLs';

interface DashboardStats {
  activeJobs: number;
  totalUsers: number;
  averageRating: number;
}

/**
 * Get dashboard stats (active jobs, total users, average rating)
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await mainLink.get('/api/explore/stats');
  return response.data;
};
