import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLists, getListById, createList, addServiceToList, removeServiceFromList } from '../api/list';
import { List } from '../types';

export const useLists = (userId?: string) => {
    return useQuery<List[]>({
        queryKey: ['lists', userId],
        queryFn: () => getLists(userId),
    });
};

export const useList = (listId: string) => {
    return useQuery<List>({
        queryKey: ['list', listId],
        queryFn: () => getListById(listId),
        enabled: !!listId,
    });
};

export const useCreateList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createList,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lists'] });
        },
    });
};

export const useAddServiceToList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ listId, serviceId }: { listId: string; serviceId: string }) => 
            addServiceToList(listId, serviceId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['lists'] });
            queryClient.invalidateQueries({ queryKey: ['list', data._id] });
        },
    });
};

export const useRemoveServiceFromList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ listId, serviceId }: { listId: string; serviceId: string }) => 
            removeServiceFromList(listId, serviceId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['lists'] });
            queryClient.invalidateQueries({ queryKey: ['list', variables.listId] });
        },
    });
};
