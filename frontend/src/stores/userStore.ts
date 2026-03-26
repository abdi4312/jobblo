import type { UserState } from "../types/userTypes.ts";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchProfile as fetchProfileApi, logoutUser } from "../features/auth/Api";

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

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
        try {
          await logoutUser();
        } catch (error) {
          console.error("Logout error:", error);
        } finally {
          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
          });
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
          console.error("Fetch profile error:", error);
          throw error;
        }
      },
    }),
    {
      name: "user-storage",
    },
  ),
);
