import mainLink from "../../api/mainURLs";

export async function getNotifications(userId: string, page: number = 1, type?: string) {
  // Backend query params ke mutabiq URL update kiya
  let url = `/api/notifications?userId=${userId}&page=${page}`;
  if (type) {
    url += `&type=${type}`;
  }
  const res = await mainLink.get(url);
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

export async function deleteAllNotifications(userId: string) {
  const res = await mainLink.delete(`/api/notifications/delete-all`, {
    data: { userId },
  });
  return res.data;
}

export async function getUnreadCount(userId: string) {
  const res = await mainLink.get(
    `/api/notifications/unread-count?userId=${userId}`,
  );
  return res.data;
}
