import { useQuery } from '@tanstack/react-query';
import * as systemApi from '../../api/admin/system';

export const useSystemHealth = () =>
    useQuery({
        queryKey: ['admin', 'system', 'health'],
        queryFn: systemApi.fetchSystemHealth,
        refetchInterval: 30_000,
        staleTime: 10_000,
    });

export const useSystemMetrics = () =>
    useQuery({
        queryKey: ['admin', 'system', 'metrics'],
        queryFn: systemApi.fetchSystemMetrics,
        refetchInterval: 30_000,
        staleTime: 10_000,
    });

export const useSystemErrors = (query?: { page?: number; limit?: number }) =>
    useQuery({
        queryKey: ['admin', 'system', 'errors', query],
        queryFn: () => systemApi.fetchSystemErrors(query),
        refetchInterval: 30_000,
        staleTime: 10_000,
    });

export const useDiskInfo = () =>
    useQuery({
        queryKey: ['admin', 'system', 'disk'],
        queryFn: systemApi.fetchDiskInfo,
        refetchInterval: 60_000,
        staleTime: 30_000,
    });
