import type { UserState } from '../types/userTypes.ts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchProfile as fetchProfileApi, logoutUser } from '../features/auth/Api';
import { disconnectSocket } from '../socket/socket';

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
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
    }),
    {
      name: 'user-storage',
    }
  )
);
