import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
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

/**
 * The conversation list.
 *
 * Each row is a job first and a person second — the job title is what someone scans for,
 * and the person's face is what confirms it, so the thumbnail is the job photo with the
 * avatar tucked into its corner rather than the other way round.
 *
 * Unread is carried by weight, not just a dot: the title goes semibold and the preview
 * goes to full ink. A single green dot on its own is easy to miss in a list of twenty, and
 * invisible to anyone who cannot separate the green from the grey beside it.
 *
 * The icons here were Google's Material Symbols web font — an extra render-blocking font
 * request for two glyphs, in a codebase that already bundles lucide.
 */
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

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <ConversationSkeleton />
      </div>
    );
  }

  if (filteredChats.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
        <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
          <MessagesSquare size={20} strokeWidth={2} />
        </span>
        <p className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Ingen samtaler</p>
        <p className="mt-1.5 max-w-50 text-[0.8125rem] leading-relaxed text-[#63665F]">
          Meldinger om oppdragene dine dukker opp her.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
      <ul className="flex flex-col gap-0.5">
        {filteredChats.map((chat) => {
          const otherPerson = chat.clientId?._id === user?._id ? chat.providerId : chat.clientId;
          const hasUnread = isUnread(chat);
          const isActive = conversationId === chat._id;
          const isOnline = !!otherPerson?._id && onlineUsers.includes(otherPerson._id);
          const photo =
            chat.serviceId?.images?.[0] || chat.serviceId?.image || undefined;

          return (
            <li key={chat._id}>
              <button
                type="button"
                onClick={() => navigate(`/messages/${chat._id}`)}
                aria-current={isActive ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                  isActive ? 'bg-[#EAF1E9]' : 'hover:bg-[#F4F6F0]'
                }`}
              >
                {/* Job photo, with the person tucked into its corner. */}
                <span className="relative shrink-0">
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-[#EAF1E9]">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <MessagesSquare size={17} strokeWidth={2} className="text-[#2E6641]" />
                    )}
                  </span>

                  <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#EAF1E9] text-[0.625rem] font-semibold text-[#2E6641]">
                    {otherPerson?.avatarUrl ? (
                      <img
                        src={otherPerson.avatarUrl}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      (otherPerson?.name?.charAt(0) || 'U').toUpperCase()
                    )}
                  </span>

                  {isOnline && (
                    <span
                      title="Pålogget"
                      className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-[#2E6641]"
                    />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={`truncate text-[0.875rem] tracking-[-0.01em] ${
                        hasUnread ? 'font-semibold text-[#0B0B0B]' : 'font-medium text-[#0B0B0B]'
                      }`}
                    >
                      {chat.serviceId?.title || otherPerson?.name || 'Ukjent'}
                    </span>
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9B9E96]">
                      {formatTime(chat.updatedAt || '')}
                    </span>
                  </span>

                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`truncate text-[0.8125rem] ${
                        hasUnread ? 'font-medium text-[#0B0B0B]' : 'text-[#63665F]'
                      }`}
                    >
                      {chat.lastMessage || 'Start samtalen…'}
                    </span>
                    {hasUnread && (
                      <span
                        aria-label="Ulest"
                        className="size-2 shrink-0 rounded-full bg-[#2E6641]"
                      />
                    )}
                    {chat.serviceId?.isSold && (
                      <span className="ml-auto shrink-0 rounded-full bg-[#F4F6F0] px-2 py-0.5 text-[0.625rem] font-semibold text-[#63665F]">
                        Solgt
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ConversationList;
