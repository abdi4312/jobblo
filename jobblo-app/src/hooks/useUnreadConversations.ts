import { useAuthStore } from '../store/authStore';
import { useMessages } from './useMessages';

/**
 * Number of conversations with unread messages, derived from the cached
 * conversation list (queryKeys.chats.all) using the same latest-message/seenBy
 * rule as the Messages list row. This is a count of unread conversations, NOT a
 * total of individual unread messages. Reuses the shared query cache, so no
 * separate network request is made by the tab badge.
 */
export function useUnreadConversations() {
  const user = useAuthStore((s) => s.user);
  const userId = user && typeof user === 'object' && '_id' in user && typeof user._id === 'string' ? user._id : null;
  const { data } = useMessages();
  const count = (data ?? []).filter((chat) => {
    const latest = chat.messages?.[0];
    return Boolean(userId && latest?.senderId && String(typeof latest.senderId === 'string' ? latest.senderId : latest.senderId._id) !== userId && !latest.seenBy?.includes(userId));
  }).length;
  return count;
}
