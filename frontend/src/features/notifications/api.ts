import mainLink from "../../api/mainURLs";

export async function getNotifications(userId: string, page: number = 1) {
  // Backend query params ke mutabiq URL update kiya
  const res = await mainLink.get(
    `/api/notifications?userId=${userId}&page=${page}`,
  );
  return res.data; // Expected: { data: [], totalPages: 10, page: 1 }
}

export async function markAsRead(id: string) {
  const res = await mainLink.put(`/api/notifications/${id}/read`);
  return res.data;
}

export async function markAllAsRead(userId: string) {
  const res = await mainLink.put(`/api/notifications/read-all`, { userId });
  return res.data;
}

export async function deleteNotification(id: string) {
  const res = await mainLink.delete(`/api/notifications/${id}`);
  return res.data;
}

export async function getUnreadCount(userId: string) {
  const res = await mainLink.get(
    `/api/notifications/unread-count?userId=${userId}`,
  );
  return res.data;
}
