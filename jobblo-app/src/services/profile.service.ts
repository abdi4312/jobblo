import apiClient from '../api/client';

export type CurrentProfile = {
  _id?: string;
  name?: string;
  lastName?: string;
  companyName?: string;
  role?: string;
  avatarUrl?: string;
  verified?: boolean;
  identityVerified?: boolean;
  bio?: string;
  skills?: string[];
  availabilityText?: string;
  locations?: string[];
  address?: string;
  postNumber?: string;
  postSted?: string | { city?: string };
  orgNumber?: string;
  website?: string;
  averageRating?: number;
  reviewCount?: number;
  completedJobs?: number;
  postedJobsCount?: number;
  responseRate?: number;
  averageResponseTime?: number;
  repeatCustomersCount?: number;
  createdAt?: string;
  [key: string]: unknown;
};

export async function getCurrentProfile(): Promise<CurrentProfile> {
  const response = await apiClient.get<CurrentProfile>('/auth/profile');
  return response.data;
}

export type ProfileUpdate = Partial<{
  name: string;
  lastName: string;
  bio: string;
  skills: string[];
  availabilityText: string;
  address: string;
  postNumber: string;
  postSted: string;
  companyName: string;
  orgNumber: string;
  website: string;
}>;

export async function updateCurrentProfile(userId: string, data: ProfileUpdate | FormData): Promise<CurrentProfile> {
  const response = await apiClient.put<CurrentProfile>(`/users/${userId}`, data);
  return response.data;
}