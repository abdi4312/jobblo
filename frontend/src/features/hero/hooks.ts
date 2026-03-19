import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { heroApi } from "./api";
import type { Hero } from "./types";

export const heroKeys = {
  all: ["heroes"] as const,
  public: ["heroes", "public"] as const,
  admin: ["heroes", "admin"] as const,
};

// Public Hook (for banners.tsx)
export const usePublicHeroes = () => {
  return useQuery<Hero[]>({
    queryKey: heroKeys.public,
    queryFn: heroApi.getPublicHeroes,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Admin Hook (for CarouselPage.tsx)
export const useAdminHeroes = () => {
  return useQuery<Hero[]>({
    queryKey: heroKeys.admin,
    queryFn: heroApi.getAllHeroes,
  });
};

// Create Hook
export const useCreateHero = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => heroApi.createHero(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: heroKeys.all });
    },
  });
};

// Update Hook
export const useUpdateHero = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      heroApi.updateHero(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: heroKeys.all });
    },
  });
};

// Delete Hook
export const useDeleteHero = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => heroApi.deleteHero(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: heroKeys.all });
    },
  });
};
