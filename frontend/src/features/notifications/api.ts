import mainLink from '../../api/mainURLs';

export async function getNotifications(page: number = 1, type?: string) {
  let url = `/api/notifications?page=${page}`;
  if (type) {
    url += `&type=${type}`;
  }
  const res = await mainLink.get(url);
  return res.data;
}

export async function markAsRead(id: string) {
  const res = await mainLink.put(`/api/notifications/${id}/read`);
  return res.data;
}

export async function markAllAsRead() {
  const res = await mainLink.put(`/api/notifications/read-all`);
  return res.data;
}

export async function deleteNotification(id: string) {
  const res = await mainLink.delete(`/api/notifications/${id}`);
  return res.data;
}

export async function deleteAllNotifications() {
  const res = await mainLink.delete(`/api/notifications/delete-all`);
  return res.data;
}

export async function getUnreadCount() {
  const res = await mainLink.get(`/api/notifications/unread-count`);
  return res.data;
}
