import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { registerUser, type RegisterRequest, type LoginResponse } from '@/services/auth.service';
import { queryKeys } from '@/queryKeys';

/**
 * Register mutation.
 * Navigation after success is handled by the calling screen —
 * hooks must not call useRouter() and navigate themselves because the
 * hook may be instantiated before the navigation context is ready.
 */
export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, Error, RegisterRequest>({
    mutationFn: registerUser,
    onSuccess: (data) => {
      useAuthStore.getState().login(data.accessToken, data.user);
      queryClient.setQueryData(queryKeys.auth.profile, data.user);
    },
  });
}
