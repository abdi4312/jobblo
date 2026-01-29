import mainLink from "./mainURLs";

export interface ChatMessage {
  senderId: string;
  text: string;
  createdAt: string;
  _id?: string;
}

export interface Chat {
  _id: string;
  clientId: {
    _id: string;
    name: string;
    role?: string;
    avatarUrl?: string;
  };
  providerId: {
    _id: string;
    name: string;
    role?: string;
    avatarUrl?: string;
  };
  serviceId: {
    _id: string;
    title?: string;
    description?: string;
  };
  messages: ChatMessage[];
  lastMessage?: string;
  updatedAt?: string;
  deletedFor?: string[];
  orderId?: string;
  contractId?: string;
}

/**
 * Create a new chat or get existing chat with a provider
 */
export const createOrGetChat = async (providerId: string): Promise<Chat> => {
  const response = await mainLink.post("/api/chats/create", { providerId });
  return response.data;
};

/**
 * Get all chats for the current user
 */
export const getMyChats = async (): Promise<Chat[]> => {
  const response = await mainLink.get("/api/chats/get");
  return response.data;
};

/**
 * Get a specific chat by ID
 */
export const getChatById = async (chatId: string): Promise<Chat> => {
  const response = await mainLink.get(`/api/chats/${chatId}`);
  return response.data;
};

/**
 * Send a message in a chat
 */
export const sendMessage = async (chatId: string, text: string): Promise<ChatMessage> => {
  const response = await mainLink.post(`/api/chats/${chatId}/message`, { text });
  return response.data;
};

/**
 * Delete a chat (permanent)
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  await mainLink.delete(`/api/chats/${chatId}`);
};

/**
 * Hide a chat (delete for me)
 */
export const deleteChatForMe = async (chatId: string): Promise<void> => {
  await mainLink.patch(`/api/chats/${chatId}/delete-for-me`);
};
