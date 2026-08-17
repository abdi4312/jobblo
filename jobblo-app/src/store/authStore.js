import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const loadStored = async (set) => {
  try {
    const [token, user] = await Promise.all([
      AsyncStorage.getItem("token"),
      AsyncStorage.getItem("user"),
    ]);
    if (token) {
      set({
        token,
        user: user ? JSON.parse(user) : null,
        isAuthenticated: true,
      });
    }
  } catch {}
};

export const useAuthStore = create((set) => {
  loadStored(set);
  return {
    token: null,
    user: null,
    isAuthenticated: false,

    login: async (token, user) => {
      await Promise.all([
        AsyncStorage.setItem("token", token),
        AsyncStorage.setItem("user", JSON.stringify(user)),
      ]);
      set({ token, user, isAuthenticated: true });
    },

    logout: async () => {
      await AsyncStorage.multiRemove(["token", "user"]);
      set({ token: null, user: null, isAuthenticated: false });
    },

    updateUser: (patch) =>
      set(async (state) => {
        const next = { ...state.user, ...patch };
        await AsyncStorage.setItem("user", JSON.stringify(next));
        return { user: next };
      }),
  };
});
