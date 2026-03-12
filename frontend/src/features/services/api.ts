import mainLink from "../../api/mainURLs";

export async function getMyPostedServices() {
  const res = await mainLink.get("/api/services/my-posted");
  return res.data;
}

export async function deleteService(serviceId: string) {
  const res = await mainLink.delete(`/api/services/${serviceId}`);
  return res.data;
}

export async function updateService(serviceId: string, jobData: any) {
  const res = await mainLink.put(`/api/services/${serviceId}`, jobData);
  return res.data;
}