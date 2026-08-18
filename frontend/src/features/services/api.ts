import mainLink from '../../api/mainURLs';
import type { Service, ServiceUpdateData } from './types';

export async function getMyPostedServices(): Promise<Service[]> {
  const res = await mainLink.get<Service[]>('/api/services/my-posted');
  return res.data;
}

export async function deleteService(serviceId: string) {
  const res = await mainLink.delete(`/api/services/${serviceId}`);
  return res.data;
}

export async function updateService(serviceId: string, jobData: ServiceUpdateData) {
  const res = await mainLink.put(`/api/services/${serviceId}`, jobData);
  return res.data;
}
