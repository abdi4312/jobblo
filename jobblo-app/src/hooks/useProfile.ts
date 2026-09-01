import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getCurrentProfile, updateCurrentProfile, type CurrentProfile, type ProfileUpdate } from '../services/profile.service';
import { useAuthStore } from '../store/authStore';

export function useProfile() {
  return useQuery<CurrentProfile>({
    queryKey: queryKeys.auth.profile,
    queryFn: getCurrentProfile,
    refetchOnMount: 'always',
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<CurrentProfile, Error, { userId: string; data: ProfileUpdate | FormData }>({
    mutationFn: ({ userId, data }) => updateCurrentProfile(userId, data),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.auth.profile, profile);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });
      const { _id, name, lastName, avatarUrl, companyName } = profile;
      await useAuthStore.getState().updateUser({ _id, name, lastName, avatarUrl, companyName });
    },
  });
}