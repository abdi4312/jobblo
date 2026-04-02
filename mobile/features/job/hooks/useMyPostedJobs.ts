import { useQuery } from '@tanstack/react-query';
import { getMyPostedJobs } from '../api/job';
import { JobsResponse } from '../types';

export const useMyPostedJobs = () => {
    return useQuery<JobsResponse>({
        queryKey: ['my-jobs'],
        queryFn: getMyPostedJobs,
    });
};
