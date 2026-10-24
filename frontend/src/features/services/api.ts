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

/** Create (no id) or update a listing from the CreateJobForm multipart payload. Returns the raw response. */
export function saveServiceForm(formData: FormData, id?: string) {
  const config = { headers: { 'Content-Type': 'multipart/form-data' } };
  return id ? mainLink.put(`/api/services/${id}`, formData, config) : mainLink.post('/api/services', formData, config);
}
