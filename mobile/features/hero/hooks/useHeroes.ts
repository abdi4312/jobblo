import { useQuery } from '@tanstack/react-query';
import { heroApi } from '../api/hero';

export const useHeroes = () => {
    return useQuery({
        queryKey: ['heroes'],
        queryFn: heroApi.getActive,
    });
};
