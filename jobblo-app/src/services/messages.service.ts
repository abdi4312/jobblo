import apiClient from '../api/client';

export interface MessageParticipant {
  _id: string;
  name?: string;
  avatarUrl?: string;
}

export interface MessageConversation {
  _id: string;
  clientId: MessageParticipant;
  providerId: MessageParticipant;
  serviceId?: {
    _id: string;
    title?: string;
    categories?: string[];
    price?: number;
    images?: string[];
    image?: string;
    isSold?: boolean;
    userId?: string;
  } | null;
  orderId?: {
    _id: string;
    status?: string;
    paymentStatus?: string;
  } | string | null;
  messages?: Array<{
    _id?: string;
    text?: string;
    createdAt?: string;
    senderId?: string | { _id: string };
    seenBy?: string[];
  }>;
  lastMessage?: string;
  updatedAt?: string;
  status?: string;
}

export interface ChatMessage {
  _id?: string;
  senderId?: string | { _id: string; name?: string; avatarUrl?: string };
  text?: string;
  createdAt?: string;
  seenBy?: string[];
  type?: 'text' | 'image' | 'system_payment' | 'system_contract' | 'system_status' | 'attachment';
  systemData?: { orderId?: string };
}

export interface MessagePage {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ChatDetail extends Omit<MessageConversation, 'messages'> {
  messages: ChatMessage[];
  messagePage: MessagePage;
}

export async function getMyConversations(): Promise<MessageConversation[]> {
  const response = await apiClient.get<MessageConversation[]>('/chats/get');
  return Array.isArray(response.data) ? response.data : [];
}

export async function getChatDetail(chatId: string, offset = 0, limit = 50): Promise<ChatDetail> {
  if (!chatId.trim()) throw new Error('Mangler chatId');
  const response = await apiClient.get<ChatDetail>(`/chats/${chatId.trim()}`, { params: { offset, limit } });
  return response.data;
}

export async function sendChatMessage(chatId: string, text: string): Promise<ChatMessage> {
  const response = await apiClient.post<ChatMessage>(`/chats/${chatId.trim()}/message`, { text: text.trim() });
  return response.data;
}
