import mainLink from "../../api/mainURLs";
import type { Hero } from "./types";

export const heroApi = {
  // Public Fetch (for banners.tsx)
  getPublicHeroes: async (): Promise<Hero[]> => {
    const response = await mainLink.get("/api/hero");
    return response.data;
  },

  // Admin CRUD
  getAllHeroes: async (): Promise<Hero[]> => {
    const response = await mainLink.get("/api/admin/hero");
    return response.data;
  },

  createHero: async (formData: FormData): Promise<Hero> => {
    const response = await mainLink.post("/api/admin/hero", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  updateHero: async (id: string, formData: FormData): Promise<Hero> => {
    const response = await mainLink.put(`/api/admin/hero/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  deleteHero: async (id: string): Promise<void> => {
    await mainLink.delete(`/api/admin/hero/${id}`);
  },
};
