import apiClient from '../api/client';

export type TopUser = {
  _id: string;
  name?: string;
  lastName?: string;
  avatarUrl?: string;
  averageRating?: number;
  reviewCount?: number;
  skills?: string[];
  locations?: string[];
  postSted?: string;
  hourlyRate?: number;
};

type TopUsersResponse = {
  data?: TopUser[];
};

export async function getTopUsers(params: {
  page?: number;
  limit?: number;
  postNumber?: string;
  postSted?: string;
  address?: string;
}): Promise<TopUsersResponse> {
  const response = await apiClient.get<TopUsersResponse>('/users/top', { params });
  return response.data;
}
