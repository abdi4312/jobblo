import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ConversationSkeleton } from '../Loading/ConversationSkeleton';

interface ConversationUser {
  _id: string;
  name?: string;
  avatarUrl?: string;
}

interface ChatItem {
  _id: string;
  clientId?: ConversationUser;
  providerId?: ConversationUser;
  serviceId?: {
    images?: string[];
    image?: string;
    title?: string;
    isSold?: boolean;
  };
  lastMessage?: string;
  messages?: any[];
  updatedAt: string;
}

interface ConversationListProps {
  loading: boolean;
  filteredChats: ChatItem[];
  user: { _id?: string } | null;
  conversationId: string | undefined;
  isUnread: (chat: ChatItem) => boolean;
  formatTime: (date: string) => string;
  onlineUsers?: string[];
}

const ConversationList: React.FC<ConversationListProps> = ({
  loading,
  filteredChats,
  user,
  conversationId,
  isUnread,
  formatTime,
  onlineUsers = [],
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {loading ? (
        <ConversationSkeleton />
      ) : filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[#999] p-10 text-center">
          <span className="material-symbols-outlined text-[36px] text-[#ccc]">
            chat_bubble_outline
          </span>
          <p className="text-sm text-[#666] mt-2">Ingen meldinger</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {filteredChats.map((chat) => {
            const otherPerson = chat.clientId?._id === user?._id ? chat.providerId : chat.clientId;

            const hasUnread = isUnread(chat);
            const isActive = conversationId === chat._id;
            const hasSafePay = chat.serviceId;
            const isOnline = otherPerson?._id && onlineUsers.includes(otherPerson._id);

            return (
              <div
                key={chat._id}
                onClick={() => navigate(`/messages/${chat._id}`)}
                className={`relative flex items-center gap-[10px] px-[14px] py-[11px] cursor-pointer border-b border-black/[0.04] transition-all ${
                  isActive ? 'bg-[#f0faf0]' : 'hover:bg-[#f9f9f7]'
                }`}
              >
                {/* Avatar-seksjon */}
                <div className="relative shrink-0">
                  <div className="w-[38px] h-[38px] rounded-full bg-[#dcfce7] text-[#166534] text-[13px] font-medium flex items-center justify-center overflow-hidden">
                    {otherPerson?.avatarUrl ? (
                      <img
                        src={otherPerson.avatarUrl}
                        alt={otherPerson.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{otherPerson?.name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  {isOnline && (
                    <div className="absolute bottom-[1px] right-[1px] w-[8px] h-[8px] bg-[#16a34a] rounded-full border-[1.5px] border-white"></div>
                  )}
                </div>

                {/* Innholdsseksjon */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span
                      className={`text-[13px] truncate ${
                        hasUnread ? 'font-bold text-custom-black' : 'text-custom-black'
                      }`}
                    >
                      {otherPerson?.name || 'Ukjent'}
                    </span>
                    <span className="text-[11px] text-[#aaa]">
                      {formatTime(chat.updatedAt || '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-[12px] truncate flex-1 ${
                        hasUnread ? 'text-[#333] font-medium' : 'text-[#888]'
                      }`}
                    >
                      {chat.lastMessage || 'Start samtale...'}
                    </p>
                    {hasUnread && (
                      <div className="w-[8px] h-[8px] bg-[#16a34a] rounded-full shrink-0"></div>
                    )}
                  </div>
                </div>

                {hasSafePay && (
                  <span className="text-[9px] bg-[#f0faf0] text-[#166534] rounded-full px-[6px] py-[2px] border border-[#c6f0d8] shrink-0">
                    SafePay
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConversationList;
