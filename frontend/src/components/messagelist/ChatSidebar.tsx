import React from 'react';
import ConversationList from '../../components/chat/ConversationList';
import type { FilterType } from '../../features/chat/useChatLogic';

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
  const filterTypes = ['Alle', 'Forespørsler Sendt', 'Forespørsel Mottatt'] as const;
  const filterMap: Record<(typeof filterTypes)[number], FilterType> = {
    Alle: 'All',
    'Forespørsler Sendt': 'Purchases',
    'Forespørsel Mottatt': 'Sales',
  };

  return (
    <div
      className={`${conversationId && isMobile ? 'hidden' : 'flex'} flex-col w-full md:w-[260px] bg-white border-r border-black/[0.08] overflow-hidden shrink-0`}
    >
      <div className="p-[14px] pb-[10px]">
        <h1 className="text-[15px] font-medium text-custom-black mb-[10px]">Meldinger</h1>
        {/* The "Søk i samtaler..." box had no value, no onChange and no
            consumer — typing in it did nothing at all. Removed rather than left
            as a control that looks functional. */}
      </div>

      <div className="flex border-b border-black/[0.07] px-[10px]">
        {filterTypes.map((label) => (
          <button
            key={label}
            onClick={() => setActiveFilter(filterMap[label])}
            className={`px-[10px] py-[8px] text-[12px] font-medium cursor-pointer border-b-[2px] transition-colors ${activeFilter === filterMap[label]
                ? 'text-[#16a34a] border-[#16a34a]'
                : 'text-[#888] border-transparent'
              }`}
          >
            {label}
          </button>
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
