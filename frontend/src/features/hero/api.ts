import mainLink from '../../api/mainURLs';
import type { Hero } from './types';

export const heroApi = {
  // Public Fetch (for banners.tsx)
  getPublicHeroes: async (): Promise<Hero[]> => {
    const response = await mainLink.get('/api/hero');
    return response.data;
  },
};
