import apiClient from '../api/client';

export type DashboardStats = {
  activeJobs: number;
  totalUsers: number;
  averageRating: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>('/explore/stats');
  return response.data;
}
