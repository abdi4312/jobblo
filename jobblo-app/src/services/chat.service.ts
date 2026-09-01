import apiClient from '../api/client';

export interface CreatedChat {
  _id: string;
}

export async function createOrGetChat(providerId: string, serviceId: string): Promise<CreatedChat> {
  const response = await apiClient.post('/chats/create', { providerId, serviceId });
  return response.data;
}