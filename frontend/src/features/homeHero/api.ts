import mainLink from "../../api/mainURLs";

export interface HomeHeroData {
  _id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  isActive: boolean;
}

export const getHomeHero = async (): Promise<HomeHeroData> => {
  const { data } = await mainLink.get("/api/home-hero");
  return data;
};

export const getAllHeroes = async (): Promise<HomeHeroData[]> => {
  const { data } = await mainLink.get("/api/home-hero/all");
  return data;
};

export const createHomeHero = async (formData: FormData) => {
  const { data } = await mainLink.post("/api/home-hero", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateHomeHero = async (id: string, formData: FormData) => {
  const { data } = await mainLink.put(`/api/home-hero/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteHomeHero = async (id: string) => {
  const { data } = await mainLink.delete(`/api/home-hero/${id}`);
  return data;
};
