import { create } from "zustand";

export const useThemeStore = create((set) => ({
  mode: "light",
  toggle: () => set((s) => ({ mode: s.mode === "light" ? "dark" : "light" })),
  setMode: (mode) => set({ mode }),
}));
