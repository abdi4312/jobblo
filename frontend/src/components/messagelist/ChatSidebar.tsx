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

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'Alle', value: 'All' },
  { label: 'Sendt', value: 'Purchases' },
  { label: 'Mottatt', value: 'Sales' },
];

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
  const unreadCount = chatsLoading ? 0 : filteredChats.filter((c) => isUnread(c)).length;

  return (
    <div
      // 260 px was too narrow for the job titles it has to hold — nearly every row
      // truncated after three or four words, which made the list unreadable at a glance.
      className={`${
        conversationId && isMobile ? 'hidden' : 'flex'
      } w-full shrink-0 flex-col overflow-hidden border-r border-[#E6E7E1] bg-white md:w-80`}
    >
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
            Meldinger
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[#2E6641] px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {/* The "Søk i samtaler…" box had no value, no onChange and no consumer — typing
            in it did nothing at all. Removed rather than left as a control that looks
            functional. */}
      </div>

      {/* Segmented rather than underlined tabs: the labels are short and the pill makes
          the active one obvious without relying on a 2 px rule under 12 px text. */}
      <div
        role="tablist"
        aria-label="Filtrer samtaler"
        className="mx-4 mb-3 flex gap-1 rounded-full border border-[#E6E7E1] bg-[#F4F6F0] p-1"
      >
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveFilter(filter.value)}
              className={`h-8 flex-1 rounded-full text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                active
                  ? 'bg-white text-[#0B0B0B] shadow-[0_1px_2px_rgba(11,11,11,0.06)]'
                  : 'text-[#63665F] hover:text-[#0B0B0B]'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
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
