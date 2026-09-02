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
  pagination?: { total: number; page?: number; limit?: number };
};

export type BlockedUser = {
  _id: string;
  name?: string;
  lastName?: string;
  avatarUrl?: string;
};

export type BlockedUsersResponse = {
  data: BlockedUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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

export async function getBlockedUsers(page = 1, limit = 10): Promise<BlockedUsersResponse> {
  const response = await apiClient.get<BlockedUsersResponse>('/users/blocked', { params: { page, limit } });
  return response.data;
}

export type BlockUserResponse = { message: string; isBlocked: boolean };

export async function unblockUser(userId: string): Promise<BlockUserResponse> {
  const response = await apiClient.post<BlockUserResponse>(`/users/${userId}/block`);
  return response.data;
}
