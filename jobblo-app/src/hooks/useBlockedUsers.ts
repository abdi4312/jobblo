import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getBlockedUsers, unblockUser, type BlockUserResponse, type BlockedUsersResponse } from '../services/users.service';
import { useAuthStore } from '../store/authStore';

export function useBlockedUsers(page = 1, limit = 10) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<BlockedUsersResponse>({
    queryKey: queryKeys.users.blocked(page, limit),
    queryFn: () => getBlockedUsers(page, limit),
    enabled: isAuthenticated,
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation<BlockUserResponse, Error, string>({
    mutationFn: unblockUser,
    onSuccess: async (result, userId) => {
      await queryClient.invalidateQueries({ queryKey: ['users', 'blocked'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });

      if (!result.isBlocked) {
        const currentUser = useAuthStore.getState().user;
        const blockedUsers = currentUser && Array.isArray(currentUser.blockedUsers)
          ? currentUser.blockedUsers.filter((blockedId) => String(blockedId) !== userId)
          : [];
        await useAuthStore.getState().updateUser({ blockedUsers });
      }
    },
  });
}
