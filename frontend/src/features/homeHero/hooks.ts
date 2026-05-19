import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getHomeHero,
  getAllHeroes,
  createHomeHero,
  updateHomeHero,
  deleteHomeHero,
} from "./api";

export const useHomeHero = () => {
  return useQuery({
    queryKey: ["homeHero"],
    queryFn: getHomeHero,
  });
};

export const useAllHeroes = () => {
  return useQuery({
    queryKey: ["allHeroes"],
    queryFn: getAllHeroes,
  });
};

export const useCreateHeroMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHomeHero,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allHeroes"] });
      queryClient.invalidateQueries({ queryKey: ["homeHero"] });
    },
  });
};

export const useUpdateHeroMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      updateHomeHero(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allHeroes"] });
      queryClient.invalidateQueries({ queryKey: ["homeHero"] });
    },
  });
};

export const useDeleteHeroMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteHomeHero,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allHeroes"] });
      queryClient.invalidateQueries({ queryKey: ["homeHero"] });
    },
  });
};
