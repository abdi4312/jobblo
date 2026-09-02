import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getTopUsers } from '../services/users.service';

export function useTopUsers(params: {
  page?: number;
  limit?: number;
  postNumber?: string;
  postSted?: string;
  address?: string;
}) {
  return useQuery({
    queryKey: queryKeys.users.top(params),
    queryFn: () => getTopUsers(params),
    enabled: true,
  });
}
