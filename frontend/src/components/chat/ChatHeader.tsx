import { useState, useEffect, useRef } from 'react';
import { User, MoreHorizontal, ChevronLeft, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ChatReportDialog } from '../admin/chat/ChatReportDialog';

interface ChatHeaderProps {
  isMobile: boolean;
  otherUser?: { avatarUrl?: string; name?: string; _id?: string };
  isOnline: boolean;
  hasService: boolean;
  chatId?: string;
}

const ICON_BUTTON =
  'flex size-9 items-center justify-center rounded-full text-[#63665F] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15';

function ChatHeader({ isMobile, otherUser, isOnline, chatId }: ChatHeaderProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToProfile = () => {
    if (otherUser?._id) navigate(`/profile/${otherUser._id}`);
  };

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[#E6E7E1] bg-white px-4 py-3 sm:px-6">
      {isMobile && (
        <button className={ICON_BUTTON} onClick={() => navigate('/messages')} aria-label="Tilbake">
          <ChevronLeft size={19} />
        </button>
      )}

      {/* The name and face are one target — tapping a person to see who they are is the
          expectation, and it was previously only reachable via a separate icon button
          that did not exist on mobile at all. */}
      <button
        type="button"
        onClick={goToProfile}
        disabled={!otherUser?._id}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:hover:opacity-100"
      >
        <span className="relative shrink-0">
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] text-[0.9375rem] font-semibold text-[#2E6641]">
            {otherUser?.avatarUrl ? (
              <img src={otherUser.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              (otherUser?.name?.charAt(0) || 'U').toUpperCase()
            )}
          </span>
          {isOnline && (
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-[#2E6641]" />
          )}
        </span>

        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
            {otherUser?.name || 'Samtale'}
          </span>
          <span
            className={`block text-[0.75rem] ${isOnline ? 'text-[#2E6641]' : 'text-[#9B9E96]'}`}
          >
            {isOnline ? 'Pålogget' : 'Frakoblet'}
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {!isMobile && (
          <button onClick={goToProfile} aria-label="Se profil" className={ICON_BUTTON}>
            <User size={17} />
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            aria-label="Flere valg"
            aria-expanded={showMenu}
            className={`${ICON_BUTTON} ${showMenu ? 'bg-[#F4F6F0] text-[#0B0B0B]' : ''}`}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreHorizontal size={17} />
          </button>

          {showMenu && (
            <div className="animate-in fade-in zoom-in absolute right-0 z-100 mt-2 w-56 origin-top-right rounded-2xl border border-[#E6E7E1] bg-white p-1.5 shadow-[0_18px_48px_rgba(11,11,11,0.12)] duration-150">
              {isMobile && (
                <button
                  className="w-full rounded-xl px-3.5 py-2.5 text-left text-[0.875rem] font-medium text-[#0B0B0B] transition-colors hover:bg-[#F4F6F0]"
                  onClick={() => {
                    setShowMenu(false);
                    goToProfile();
                  }}
                >
                  Se profil
                </button>
              )}
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-[0.875rem] font-medium text-[#0B0B0B] transition-colors hover:bg-[#F4F6F0]"
                onClick={() => {
                  setShowMenu(false);
                  if (chatId) {
                    setShowReportDialog(true);
                  } else {
                    toast('Samtalen kan ikke rapporteres ennå.');
                  }
                }}
              >
                <Flag size={15} className="text-[#63665F]" /> Rapporter samtalen
              </button>
            </div>
          )}
        </div>
      </div>

      {chatId && (
        <ChatReportDialog
          chatId={chatId}
          open={showReportDialog}
          onClose={() => setShowReportDialog(false)}
          scope="chat"
        />
      )}
    </div>
  );
}

export default ChatHeader;
