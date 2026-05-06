import React from "react";
import { FilterButton } from "../../components/chat/ChatUiComponents";
import ConversationList from "../../components/chat/ConversationList";
import type { FilterType } from "../../features/chat/useChatLogic";

interface ChatSidebarProps {
  conversationId?: string;
  isMobile: boolean;
  activeFilter: FilterType;
  setActiveFilter: (filter: FilterType) => void;
  chatsLoading: boolean;
  filteredChats: any[];
  user: any;
  isUnread: (chat: any) => boolean;
  formatTime: (date?: string) => string;
  onlineUsers: string[];
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversationId,
  isMobile,
  activeFilter,
  setActiveFilter,
  chatsLoading,
  filteredChats,
  user,
  isUnread,
  formatTime,
  onlineUsers,
}) => {
  const filterTypes = ["All", "Purchases", "Sales"] as FilterType[];
  return (
    <div
      className={`${conversationId && isMobile ? "hidden" : "flex"} flex-col w-full md:max-w-90 border-r border-[#F1F3F5] overflow-hidden`}
    >
      <div className="p-6 flex items-center justify-between border-b border-[#F8F9FA]">
        <h1 className="text-[24px] font-bold text-[#212529] m-0">Chat</h1>
      </div>

      <div className="flex gap-2 box-card-custom mx-3 mb-3">
        {filterTypes.map((filter) => (
          <FilterButton
            key={filter}
            label={filter}
            isActive={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
          />
        ))}
      </div>

      <ConversationList
        loading={chatsLoading}
        filteredChats={filteredChats}
        user={user}
        conversationId={conversationId}
        isUnread={isUnread}
        formatTime={formatTime}
        onlineUsers={onlineUsers}
      />
    </div>
  );
};
