import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { loginUser, type LoginRequest, type LoginResponse } from '@/services/auth.service';
import { queryKeys } from '@/queryKeys';

/**
 * Login mutation.
 * Navigation after success is handled by the calling screen —
 * hooks must not call useRouter() and navigate themselves because the
 * hook may be instantiated before the navigation context is ready.
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: loginUser,
    onSuccess: (data) => {
      useAuthStore.getState().login(data.accessToken, data.user);
      queryClient.setQueryData(queryKeys.auth.profile, data.user);
    },
  });
}
