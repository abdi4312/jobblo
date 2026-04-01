import { api } from '../../auth/api/client';
import { JobsResponse } from '../types';

export const getJobs = async ({ page = 1, limit = 10, search = '', category = '' }): Promise<JobsResponse> => {
    const response = await api.get('/services', {
        params: {
            page,
            limit,
            search,
            category,
        },
    });
    return response.data;
};
