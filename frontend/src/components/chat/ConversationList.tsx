import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ConversationListProps {
  loading: boolean;
  filteredChats: any[];
  user: any;
  conversationId: string | undefined;
  isUnread: (chat: any) => boolean;
  formatTime: (date: string) => string;
}

const ConversationList: React.FC<ConversationListProps> = ({
  loading,
  filteredChats,
  user,
  conversationId,
  isUnread,
  formatTime,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-1">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[#999] p-10">
          <p className="animate-pulse">Laster...</p>
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[#999] p-10 text-center">
          <span className="material-symbols-outlined text-[36px] text-[#ccc]">
            chat_bubble_outline
          </span>
          <p className="text-sm text-[#666] mt-2">Ingen meldinger</p>
        </div>
      ) : (
        filteredChats.map((chat) => {
          const otherPerson =
            chat.clientId?._id === user?._id
              ? chat.providerId
              : chat.clientId;

          const hasUnread = isUnread(chat);
          const isActive = conversationId === chat._id;

          return (
            <div
              key={chat._id}
              onClick={() => navigate(`/messages/${chat._id}`)}
            >
              <div
                className={`bg-white rounded-xl shadow-md overflow-hidden mb-4 hover:bg-gray-50 transition-all cursor-pointer border mr-4 ${isActive ? "border-[#2F7E47]" : "border-transparent"
                  } hover:border-[#2F7E47] active:border-[#2F7E47]`}
              >
                <div className="flex items-start p-4 gap-4">
                  {/* 1. Avatar Section */}
                  <div className="shrink-0">
                    {otherPerson?.avatarUrl ? (
                      <img
                        src={otherPerson.avatarUrl}
                        alt={otherPerson.name}
                        className="w-12 h-12 rounded-full object-cover border border-gray-100 shrink-0"
                      />
                    ) : (
                      <span className="w-12 h-12 rounded-full bg-linear-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-white font-semibold shrink-0">
                        {otherPerson?.name?.charAt(0) || "A"}
                      </span>
                    )}
                  </div>

                  {/* 2. Content & Date Section */}
                  <div className="flex flex-1 justify-between min-w-0">
                    {/* Name and Message */}
                    <div className="min-w-0 pr-2">
                      <h2 className="text-[20px] font-bold text-[#0A0A0A] truncate">
                        {otherPerson?.name || "Ukjent bruker"}
                      </h2>
                      <p className="text-[14px] text-[#6A7282] truncate leading-relaxed">
                        {chat.lastMessage || "Start samtalen..."}
                      </p>
                    </div>

                    {/* Date and Unread Indicator */}
                    <div className="flex flex-col items-end shrink-0 gap-2">
                      <h2 className="text-[12px] text-[#999] font-medium whitespace-nowrap">
                        {formatTime(chat.updatedAt)}
                      </h2>
                      {hasUnread && (
                        <span className="w-2.5 h-2.5 bg-[#EA1717] rounded-full shadow-sm"></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ConversationList;