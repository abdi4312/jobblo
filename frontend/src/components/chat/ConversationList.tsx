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
                className={`relative flex items-center gap-[12px] px-[14px] py-[12px] cursor-pointer border-b border-black/[0.04] transition-all ${
                  isActive ? 'bg-[#f0faf0]' : 'hover:bg-[#f9f9f7]'
                }`}
              >
                {/* Product Image */}
                <div className="relative shrink-0">
                  <div className="w-[54px] h-[54px] rounded-[10px] bg-gray-100 overflow-hidden">
                    {(chat.serviceId?.images && chat.serviceId.images.length > 0) ||
                    chat.serviceId?.image ? (
                      <img
                        src={
                          chat.serviceId.images && chat.serviceId.images.length > 0
                            ? chat.serviceId.images[0]
                            : chat.serviceId.image
                        }
                        alt={chat.serviceId?.title || 'Produkt'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#f0faf0]">
                        <span className="material-symbols-outlined text-[#16a34a] text-[24px]">
                          local_mall
                        </span>
                      </div>
                    )}
                  </div>
                  {/* User Avatar Overlay */}
                  <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-white border-2 border-white overflow-hidden">
                    {otherPerson?.avatarUrl ? (
                      <img
                        src={otherPerson.avatarUrl}
                        alt={otherPerson.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#dcfce7] flex items-center justify-center">
                        <span className="text-[#166534] text-[10px] font-medium">
                          {otherPerson?.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                  {isOnline && (
                    <div className="absolute bottom-3 right-0 w-[8px] h-[8px] bg-[#16a34a] rounded-full border-[1.5px] border-white"></div>
                  )}
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3
                      className={`text-[14px] font-medium truncate flex-1 mr-2 ${
                        hasUnread ? 'text-custom-black' : 'text-custom-black'
                      }`}
                    >
                      {chat.serviceId?.title || otherPerson?.name || 'Ukjent'}
                    </h3>
                    <span className="text-[12px] text-[#888] shrink-0">
                      {formatTime(chat.updatedAt || '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-[13px] truncate flex-1 ${
                        hasUnread ? 'text-[#555]' : 'text-[#999]'
                      }`}
                    >
                      {chat.lastMessage || 'Start samtale...'}
                    </p>
                    {hasUnread && (
                      <div className="w-[8px] h-[8px] bg-[#16a34a] rounded-full shrink-0"></div>
                    )}
                  </div>
                </div>

                {/* Solgt Badge */}
                {chat.serviceId?.isSold && (
                  <span className="text-[10px] font-medium bg-[#fef3c7] text-[#d97706] rounded-full px-[8px] py-[3px] shrink-0">
                    Solgt
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
