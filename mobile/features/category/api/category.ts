import { api } from '../../auth/api/client';
import { Category } from '../types';

export const categoryApi = {
    getAll: async (): Promise<Category[]> => {
        const response = await api.get('/categories');
        return response.data;
    },
};
