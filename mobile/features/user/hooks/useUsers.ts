import { useQuery } from '@tanstack/react-query';
import { searchUsers } from '../api/user';
import { ListUser } from '../../list/types';

export const useSearchUsers = (query: string) => {
    return useQuery<ListUser[]>({
        queryKey: ['users', 'search', query],
        queryFn: () => searchUsers(query),
        enabled: query.length > 1,
    });
};
