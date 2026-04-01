import { api } from '../../auth/api/client';

export const jobApi = {
    create: async (data: any) => {
        const response = await api.post('/services', data);
        return response.data;
    },
};
