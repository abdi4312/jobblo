import { useQuery } from '@tanstack/react-query';
import { heroApi } from './api';
import type { Hero } from './types';

export const heroKeys = {
  all: ['heroes'] as const,
  public: ['heroes', 'public'] as const,
};

// Public Hook (for banners.tsx)
export const usePublicHeroes = () => {
  return useQuery<Hero[]>({
    queryKey: heroKeys.public,
    queryFn: heroApi.getPublicHeroes,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
