import { useState, useEffect, useRef } from "react";
import { User, MoreHorizontal, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

interface ChatHeaderProps {
  isMobile: boolean;
  otherUser?: { avatarUrl?: string; name?: string; _id?: string };
  isOnline: boolean;
  hasService: boolean;
}

function ChatHeader({
  isMobile,
  otherUser,
  isOnline,
  hasService,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUserClick = () => {
    if (otherUser?._id) {
      navigate(`/profile/${otherUser._id}`);
    }
  };

  return (
    <div className="bg-white border-b border-black/[0.08] px-[18px] py-[11px] flex items-center gap-[10px] shrink-0">
      {/* Back button for mobile */}
      {isMobile && (
        <button
          className="p-2 hover:bg-[#f9f9f7] rounded-full transition-all shrink-0 text-custom-black"
          onClick={() => navigate("/messages")}
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      <div className="relative shrink-0">
        <div className="w-[50px] h-[50px] rounded-full bg-[#dcfce7] text-[#166534] text-[18px] font-medium flex items-center justify-center overflow-hidden">
          {otherUser?.avatarUrl ? (
            <img
              src={otherUser.avatarUrl}
              alt={otherUser.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{otherUser?.name?.charAt(0) || "U"}</span>
          )}
        </div>
        {/* Online Status Indicator */}
        {isOnline && (
          <div className="absolute bottom-[2px] right-[2px] w-[10px] h-[10px] bg-[#16a34a] rounded-full border-[2px] border-white"></div>
        )}
      </div>

      <div className="min-w-0 flex flex-col flex-1">
        <h3 className="m-0 text-[18px] font-bold text-custom-black truncate leading-tight">
          {otherUser?.name || "Chat"}
        </h3>
        <p className="text-[13px] font-medium m-0 text-[#888]">
          {isOnline ? "Online" : "Offline"} · 4.9 ★ · 38 oppdrag
        </p>
      </div>

      <div className="flex items-center gap-[8px]">
        {!isMobile && (
          <button
            onClick={handleUserClick}
            className="w-[40px] h-[40px] border border-black/[0.1] rounded-[10px] bg-white flex items-center justify-center cursor-pointer text-[#16a34a] hover:bg-[#f9f9f7] transition-colors"
          >
            <User size={18} />
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            aria-label="More options"
            className={`w-[40px] h-[40px] border border-black/[0.1] rounded-[10px] bg-white flex items-center justify-center cursor-pointer text-[#16a34a] transition-colors ${showMenu ? "bg-[#f9f9f7]" : "hover:bg-[#f9f9f7]"}`}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreHorizontal size={18} />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-black/[0.08] py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
              {isMobile && (
                <button
                  className="w-full text-left px-6 py-4 text-[16px] font-bold text-custom-black hover:bg-[#f9f9f7] transition-colors"
                  onClick={() => {
                    setShowMenu(false);
                    if (otherUser?._id) {
                      navigate(`/profile/${otherUser._id}`);
                    }
                  }}
                >
                  View Profile
                </button>
              )}
              <button
                className="w-full text-left px-6 py-4 text-[16px] font-bold text-custom-black hover:bg-[#f9f9f7] transition-colors"
                onClick={() => {
                  setShowMenu(false);
                  toast("Archive feature coming soon!");
                }}
              >
                Archive this thread
              </button>
              <button
                className="w-full text-left px-6 py-4 text-[16px] font-bold text-custom-black hover:bg-[#f9f9f7] transition-colors"
                onClick={() => {
                  setShowMenu(false);
                  toast("Report feature coming soon!");
                }}
              >
                Report chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatHeader;
