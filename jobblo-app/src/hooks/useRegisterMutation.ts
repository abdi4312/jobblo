import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useRegistrationStore } from '@/store/registrationStore';
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
    onSuccess: async (data) => {
      // Awaited like login: the screen navigates into (app) right after, and the token must
      // already be in storage for the first authenticated request.
      await useAuthStore.getState().login(data.accessToken, data.user);
      queryClient.setQueryData(queryKeys.auth.profile, data.user);
      // The form lives in a module-level store; without this the next visit to /register
      // (e.g. after logout on a shared phone) opens pre-filled with this user's password.
      useRegistrationStore.getState().reset();
    },
  });
}
