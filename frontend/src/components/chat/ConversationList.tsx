import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ConversationUser {
  _id: string;
  name?: string;
  avatarUrl?: string;
}

interface ChatItem {
  _id: string;
  clientId?: ConversationUser;
  providerId?: ConversationUser;
  serviceId?: { images?: string[]; image?: string; title?: string; isSold?: boolean };
  lastMessage?: { text?: string; createdAt?: string };
  updatedAt?: string;
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
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[#999] p-10">
          <p className="animate-pulse">Loading...</p>
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[#999] p-10 text-center">
          <span className="material-symbols-outlined text-[36px] text-[#ccc]">
            chat_bubble_outline
          </span>
          <p className="text-sm text-[#666] mt-2">No messages</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {filteredChats.map((chat) => {
            const otherPerson =
              chat.clientId?._id === user?._id
                ? chat.providerId
                : chat.clientId;

            const hasUnread = isUnread(chat);
            const isActive = conversationId === chat._id;
            const serviceImage = chat.serviceId?.images?.[0] || chat.serviceId?.image;
            const isOnline = otherPerson?._id && onlineUsers.includes(otherPerson._id);

            return (
              <div
                key={chat._id}
                onClick={() => navigate(`/messages/${chat._id}`)}
                className={`relative flex items-center p-4 gap-4 cursor-pointer transition-all ${isActive
                    ? "bg-[#EF790933] opacity-80"
                    : "bg-white hover:bg-[#F8F9FA]"
                  }`}
              >
                {/* Avatar Section */}
                <div className="relative shrink-0">
                  <div className="w-[56px] h-[56px] rounded-full p-[2px] bg-white border border-[#E9ECEF]">
                    {otherPerson?.avatarUrl ? (
                      <img
                        src={otherPerson.avatarUrl}
                        alt={otherPerson.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#F1F3F5] flex items-center justify-center text-[#495057] font-bold text-lg">
                        {otherPerson?.name?.charAt(0) || "U"}
                      </div>
                    )}
                  </div>
                  {isOnline && (
                    <div className="absolute bottom-[2px] right-[2px] w-[14px] h-[14px] bg-[#22C55E] rounded-full border-2 border-white shadow-sm"></div>
                  )}
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <h2 className={`text-[17px] font-bold truncate ${isActive ? "text-[#212529]" : "text-[#495057]"}`}>
                      {otherPerson?.name || "Unknown"}
                    </h2>
                    <span className="text-[13px] text-[#868E96] font-normal whitespace-nowrap">
                      {formatTime(chat.updatedAt || "")}
                    </span>
                  </div>
                  <p className={`text-[15px] truncate leading-tight ${hasUnread ? "text-[#212529] font-bold" : "text-[#868E96]"}`}>
                    {chat.lastMessage || "Start conversation..."}
                  </p>
                </div>

                {/* Service Image / Thumbnail */}
                {serviceImage && (
                  <div className="shrink-0 ml-2 relative">
                    <img
                      src={serviceImage}
                      alt="Service"
                      className="w-14 h-14 rounded-2xl object-cover border border-[#F1F3F5] shadow-sm"
                    />
                    {chat.serviceId?.isSold && (
                      <div className="absolute top-0 right-0 bg-[#FF8E8E] text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg uppercase tracking-tighter">
                        Sold
                      </div>
                    )}
                  </div>
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