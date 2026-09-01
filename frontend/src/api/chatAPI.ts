import mainLink from './mainURLs';

export interface ChatMessage {
  senderId?: string | { _id: string; name: string; avatarUrl?: string };
  text?: string;
  createdAt: string;
  _id?: string;
  seenBy?: string[];
  type?: 'text' | 'image' | 'system_payment' | 'system_contract' | 'system_status' | 'attachment';
  systemData?: any;
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
    images?: string[];
    price?: number;
    categories?: string[];
    isSold?: boolean;
  };
  /**
   * From `getChatById` this is one page of the thread (most recent first page by
   * default); from the inbox list it is only the single latest message.
   */
  messages: ChatMessage[];
  /** Present on getChatById — describes what remains to be loaded. */
  messagePage?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  lastMessage?: string;
  updatedAt?: string;
  deletedFor?: string[];
  orderId?: any;
  // `in_progress` and `disputed` are real backend values and were missing here, which
  // is why the conversation badge fell through to its default and read "Forespørsel"
  // for a job that was actually under way.
  status?:
    | 'requested'
    | 'agreed'
    | 'paid'
    | 'contracted'
    | 'in_progress'
    | 'completed'
    | 'disputed'
    | 'cancelled';
  agreedPrice?: number;
}

/**
 * Create a new chat or get existing chat with a provider
 */
export const createOrGetChat = async (providerId: string, serviceId: string): Promise<Chat> => {
  const response = await mainLink.post('/api/chats/create', { providerId, serviceId });
  return response.data;
};

/**
 * Get all chats for the current user
 */
export const getMyChats = async (): Promise<Chat[]> => {
  const response = await mainLink.get('/api/chats/get');
  return response.data;
};

/**
 * Get a specific chat by ID.
 *
 * The thread is paginated: without `offset` the server returns the most recent page
 * (50 by default) plus a `messagePage` block describing what is left. Pass
 * `offset = messages already loaded` to walk further back through the history.
 */
export const getChatById = async (
  chatId: string,
  opts?: { limit?: number; offset?: number }
): Promise<Chat> => {
  const response = await mainLink.get(`/api/chats/${chatId}`, {
    params: { limit: opts?.limit, offset: opts?.offset },
  });
  return response.data;
};

/**
 * Send a message in a chat
 */
export const sendMessage = async (chatId: string, text: string): Promise<ChatMessage> => {
  const response = await mainLink.post(`/api/chats/${chatId}/message`, {
    text,
  });
  return response.data;
};

/**
 * Create a payment session for a chat
 */
export const createPaymentSession = async (chatId: string): Promise<{ url: string }> => {
  const response = await mainLink.post(`/api/chats/${chatId}/payments`);
  return response.data;
};

/**
 * Create a contract for a chat
 */
export const createContract = async (chatId: string, agreedPrice?: number): Promise<Chat> => {
  const body = agreedPrice !== undefined ? { agreedPrice } : {};
  const response = await mainLink.post(`/api/chats/${chatId}/contracts`, body);
  return response.data;
};

/**
 * Delete a chat (permanent)
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  await mainLink.delete(`/api/chats/${chatId}`);
};

/**
 * Update agreed price for a chat
 */
export const updateAgreedPrice = async (chatId: string, agreedPrice: number): Promise<Chat> => {
  const response = await mainLink.patch(`/api/chats/${chatId}/agreed-price`, { agreedPrice });
  return response.data;
};

/**
 * Hide a chat (delete for me)
 */
export const deleteChatForMe = async (chatId: string): Promise<void> => {
  await mainLink.patch(`/api/chats/${chatId}/delete-for-me`);
};
