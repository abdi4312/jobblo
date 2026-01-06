import mainLink from "./mainURLs";

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

export async function getNearbyJobs(lat: number, lng: number, radius = 50000) {
  const res = await mainLink.get(
    `/api/services/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
  );
  return res.data;
}
