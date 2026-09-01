import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import apiClient from '../api/client';
import type { PublicUser, PublicService } from '../types/UserProfile';

async function getUserProfile(userId: string): Promise<PublicUser> {
  const { data } = await apiClient.get<PublicUser>(`/users/${userId}`);
  return data;
}

async function getUserServices(userId: string): Promise<PublicService[]> {
  const { data } = await apiClient.get<PublicService[]>(`/users/${userId}/services`);
  return data;
}

export function usePublicProfile(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.users.profile(userId ?? ''),
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function usePublicUserServices(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.users.services(userId ?? ''),
    queryFn: () => getUserServices(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
