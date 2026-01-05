// import type { UserState } from "../types/userTypes.ts";
// import { create } from "zustand";
// import { persist } from "zustand/middleware";

// export const useUserStore = create<UserState>()(
//   persist(
//     (set) => ({
//       user: null,
//       tokens: null,
//       isAuthenticated: false,

//       setUser: (user) =>
//         set({
//           user,
//           isAuthenticated: true,
//         }),

//       setTokens: (tokens) => set({ tokens }),

//       login: (user, tokens) =>
//         set({
//           user,
//           tokens,
//           isAuthenticated: true,
//         }),

//       logout: () =>
//         set({
//           user: null,
//           tokens: null,
//           isAuthenticated: false,
//         }),
//     }),
//     {
//       name: "user-storage",
//     },
//   ),
// );


import type { UserState } from "../types/userTypes.ts";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import  mainLink  from "../api/mainURLs.ts";
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: false,
        }),

      setTokens: (tokens) => set({ tokens }),

      login: (user, tokens) =>
        set({
          user,
          tokens,
         isAuthenticated: !!user?._id,
        }),

      // 🔥 PROFILE API CALL
      fetchProfile: async () => {
        try {
        

          const res = await mainLink.get(`/api/auth/profile`, {
          });
          console.log(res.data);
          
          set({
            user: res.data,
            isAuthenticated: !!res.data?._id,
          });
        } catch (error) {
          set({
            user: null,
            tokens: null,
          });
        }
      },

      // 🔥 LOGOUT API CALL
      logout: async () => {
        try {
          await mainLink.post(`/api/auth/logout`);
          // navigator.reload();
        } catch (err) {
          // ignore
        }

        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "user-storage",
    },
  ),
);
