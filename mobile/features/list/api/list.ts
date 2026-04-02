import { api } from '../../auth/api/client';
import { List } from '../types';

export const getLists = async (userId?: string): Promise<List[]> => {
    const response = await api.get('/lists', {
        params: {
            userId,
        },
    });
    return response.data;
};

export const getListById = async (listId: string): Promise<List> => {
    const response = await api.get(`/lists/${listId}`);
    return response.data;
};

export const createList = async (name: string): Promise<List> => {
    const response = await api.post('/lists', { name });
    return response.data;
};

export const addServiceToList = async (listId: string, serviceId: string): Promise<List> => {
    const response = await api.post('/lists/add-service', { listId, serviceId });
    return response.data;
};

export const removeServiceFromList = async (listId: string, serviceId: string): Promise<void> => {
    await api.delete(`/lists/remove-service/${listId}/${serviceId}`);
};
