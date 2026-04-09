import mainLink from "../../api/mainURLs";
import type { ServiceUpdateData } from "./types";

export async function getMyPostedServices() {
  const res = await mainLink.get("/api/services/my-posted");
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