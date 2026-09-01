import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  getActiveSessions,
  revokeOtherSessions,
  revokeSession,
} from '../services/auth.service';

/**
 * Active login sessions for the authenticated user.
 *
 * `staleTime: 0` + `refetchOnMount: 'always'` because a security screen showing a
 * stale device list is actively misleading — a session the user revoked from
 * another device must not still be listed when they open this screen.
 *
 * The data lives only in the TanStack cache. It is never persisted to
 * AsyncStorage or Zustand, so authStore's `clearAuthenticatedSession()`
 * (`cancelQueries()` + `removeQueries()`) fully disposes of it on logout and on
 * a switch to a different account.
 */
export function useActiveSessions() {
  return useQuery({
    queryKey: queryKeys.auth.sessions,
    queryFn: getActiveSessions,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * Revoke ONE other session.
 *
 * Only the session list is invalidated. Revoking a different device says nothing
 * about this device's own auth state, so we deliberately do NOT clear the whole
 * QueryClient and do NOT touch authStore — that would log the user out of the
 * phone they are holding.
 */
export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    // Runs for both success and failure. A 404 means the session was already
    // gone (revoked from another device, or expired by the TTL index), which is
    // still a reason to resync the list rather than leave a phantom row.
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
    },
  });
}

/**
 * Revoke every session except the current one.
 *
 * The current session is preserved by the backend query itself
 * (`_id: { $ne: currentSessionId }`), so this must not trigger any local logout.
 */
export function useRevokeOtherSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeOtherSessions,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
    },
  });
}
