import apiClient from '../api/client';
import type { NotificationsPageResponse, UnreadCountResponse } from '../types/Notification';

export const notificationsService = {
  async getNotifications(page: number = 1, type?: string): Promise<NotificationsPageResponse> {
    let url = `/notifications?page=${page}`;
    if (type) url += `&type=${type}`;
    const res = await apiClient.get(url);
    return res.data;
  },

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data;
  },

  async markAsRead(id: string) {
    const res = await apiClient.put(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllAsRead() {
    const res = await apiClient.put('/notifications/read-all');
    return res.data;
  },

  async deleteNotification(id: string) {
    const res = await apiClient.delete(`/notifications/${id}`);
    return res.data;
  },

  async deleteAllNotifications() {
    const res = await apiClient.delete('/notifications/delete-all');
    return res.data;
  },
};
