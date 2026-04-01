import { useInfiniteQuery } from '@tanstack/react-query';
import { getJobs } from '../api/job';
import { JobsResponse } from '../types';

export const useInfiniteJobs = (params: { limit?: number; search?: string; category?: string } = {}) => {
    return useInfiniteQuery<JobsResponse>({
        queryKey: ['jobs', params.search, params.category],
        queryFn: ({ pageParam = 1 }) => getJobs({ 
            page: pageParam as number, 
            limit: params.limit || 10,
            search: params.search,
            category: params.category,
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pagination;
            return page < totalPages ? page + 1 : undefined;
        },
    });
};
