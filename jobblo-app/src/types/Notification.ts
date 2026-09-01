export interface NotificationSender {
  _id: string;
  name: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface NotificationOrder {
  _id: string;
  status: string;
  customerId?: string;
  providerId?: string;
  paymentStatus?: string;
}

export interface NotificationRequest {
  _id: string;
  status: string;
  serviceId?: string | { _id?: string };
}

export interface Notification {
  _id: string;
  userId: { _id: string; name: string; email: string } | null;
  senderId?: NotificationSender | null;
  type: string;
  content: string;
  orderId?: NotificationOrder | string | null;
  requestId?: NotificationRequest | string | null;
  read: boolean;
  readBy?: string[];
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsPageResponse {
  success: boolean;
  total: number;
  currentPage: number;
  totalPages: number;
  data: Notification[];
}

export interface UnreadCountResponse {
  count: number;
}
