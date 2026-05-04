export interface AlertType {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  } | null;
  senderId?: {
    _id: string;
    name: string;
    lastName?: string;
    avatarUrl?: string;
  } | null;
  type: string;
  content: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UnreadCountResponse {
  count: number;
}
