import mainLink from "../../api/mainURLs";

export async function getNotifications(userId: string, page: number = 1) {
  // Backend query params ke mutabiq URL update kiya
  const res = await mainLink.get(`/api/notifications?userId=${userId}&page=${page}`);
  return res.data; // Expected: { data: [], totalPages: 10, page: 1 }
}