import type { UserState } from '../types/userTypes.ts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchProfile as fetchProfileApi,
  logoutUser,
  refreshToken as refreshTokenApi,
} from '../features/auth/Api';
import { disconnectSocket } from '../socket/socket';

/**
 * Only these preferences are written to localStorage.
 *
 * The whole store used to be persisted, so `tokens.accessToken` sat in localStorage for
 * any XSS to read, and `user` / `isAuthenticated` were read back as if they proved who
 * was signed in — editing `role` there opened the admin UI. Auth state now lives in
 * memory only and is rebuilt on every page load from the httpOnly refresh cookie
 * (bootstrap below); nothing in storage is trusted as identity.
 */
const PERSISTED_KEYS = [
  'notificationsEnabled',
  'browserNotificationsEnabled',
  'emailNotificationsEnabled',
  'smsNotificationsEnabled',
] as const;

const pickPreferences = (state: unknown) => {
  const source = (state && typeof state === 'object' ? state : {}) as Record<string, unknown>;
  const prefs: Record<string, boolean> = {};
  for (const key of PERSISTED_KEYS) {
    if (typeof source[key] === 'boolean') prefs[key] = source[key] as boolean;
  }
  return prefs;
};

/** One in-flight bootstrap per page load, shared by main.tsx and OAuthSuccess. */
let bootstrapInFlight: Promise<void> | null = null;

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      authReady: false,
      notificationsEnabled: true,
      browserNotificationsEnabled: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),

      setBrowserNotificationsEnabled: (enabled) => set({ browserNotificationsEnabled: enabled }),

      setEmailNotificationsEnabled: (enabled) => set({ emailNotificationsEnabled: enabled }),

      setSmsNotificationsEnabled: (enabled) => set({ smsNotificationsEnabled: enabled }),

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user?._id,
        }),

      setTokens: (tokens) => set({ tokens }),

      login: (user, tokens) =>
        set({
          user,
          tokens,
          isAuthenticated: !!user?._id,
          authReady: true,
        }),

      logout: async () => {
        // Prevent multiple simultaneous logout calls
        const { isAuthenticated, tokens } = useUserStore.getState();
        if (!isAuthenticated && !tokens) return;

        // Clear state immediately to prevent other triggers
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
        });

        // Disconnect BEFORE the network call. This used to sit inside the try
        // after `await logoutUser()`, so if the server 500'd or the user was
        // offline the socket stayed connected as the old user.
        disconnectSocket();

        try {
          await logoutUser();
        } catch (error) {
          console.error('Logout error:', error);
        }
      },

      fetchProfile: async () => {
        try {
          const user = await fetchProfileApi();
          set({
            user,
            isAuthenticated: !!user?._id,
          });
        } catch (error) {
          console.error('Fetch profile error:', error);
          throw error;
        }
      },

      /**
       * Restore the session for this page load from the server: the httpOnly refresh
       * cookie is traded for an in-memory access token, then the profile is loaded with
       * it. No cookie / revoked / expired -> signed out. `authReady` flips either way, so
       * route guards can wait instead of redirecting on a not-yet-known state.
       */
      bootstrap: () => {
        if (!bootstrapInFlight) {
          bootstrapInFlight = (async () => {
            try {
              const { accessToken } = await refreshTokenApi();
              if (!accessToken) throw new Error('No access token returned');
              set({ tokens: { accessToken } });
              const user = await fetchProfileApi();
              set({ user, isAuthenticated: !!user?._id });
            } catch {
              set({ user: null, tokens: null, isAuthenticated: false });
            } finally {
              set({ authReady: true });
            }
          })();
        }
        return bootstrapInFlight;
      },
    }),
    {
      name: 'user-storage',
      // v0 persisted everything, including the access token. Migrating to v1 rewrites
      // the stored value with preferences only, so existing tokens are erased from disk.
      version: 1,
      partialize: (state) => pickPreferences(state),
      migrate: (persisted) => pickPreferences(persisted),
      // Never let stored (or hand-edited) values set user / tokens / isAuthenticated.
      merge: (persisted, current) => ({ ...current, ...pickPreferences(persisted) }),
    }
  )
);
