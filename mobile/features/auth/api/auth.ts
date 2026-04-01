import { api } from './client';
import { AuthResponse } from '../types';

export const authApi = {
    login: async (data: any): Promise<AuthResponse> => {
        const response = await api.post('/auth/login', data);
        return response.data;
    },
    register: async (data: any): Promise<AuthResponse> => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
};
