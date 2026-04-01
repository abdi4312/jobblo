import { api } from '../../auth/api/client';
import { Hero } from '../types';

export const heroApi = {
    getActive: async (): Promise<Hero[]> => {
        const response = await api.get('/hero');
        return response.data;
    },
};
