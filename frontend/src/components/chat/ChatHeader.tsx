import { useState, useEffect, useRef } from "react";
import { ReceiptText, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChatHeaderProps {
  isMobile: boolean;
  otherUser?: { avatarUrl?: string; name?: string; _id?: string };
  contract?: { status?: string; _id?: string };
  setShowCreateContract: (show: boolean) => void;
  isOnline: boolean;
  hasService: boolean;
}

function ChatHeader({
  isMobile,
  otherUser,
  contract,
  setShowCreateContract,
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

  return (
    <div className="px-6 py-4 flex bg-white border-b border-[#F8F9FA] justify-between items-center shrink-0">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Back button for mobile */}
        {isMobile && (
          <button
            className="p-2 hover:bg-[#F8F9FA] rounded-full transition-all shrink-0 text-[#495057]"
            onClick={() => navigate("/messages")}
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-[24px]">
              arrow_back
            </span>
          </button>
        )}

        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#F1F3F5] flex items-center justify-center text-[#495057] font-bold text-lg overflow-hidden border border-[#E9ECEF]">
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
          <div
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? "bg-[#22C55E]" : "bg-[#ADB5BD]"}`}
          ></div>
        </div>

        <div className="min-w-0 flex flex-col">
          <h3 className="m-0 text-[18px] font-bold text-[#212529] truncate leading-tight">
            {otherUser?.name || "Chat"}
          </h3>
          <p
            className={`text-[13px] font-medium m-0 ${isOnline ? "text-[#22C55E]" : "text-[#868E96]"}`}
          >
            {isOnline ? "Online now" : "Offline"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Send Contract Button (Desktop only) */}
        {!contract?._id && !isMobile && hasService && (
          <button
            className="flex items-center bg-[#212529] hover:bg-black rounded-xl px-4 py-2 gap-2 text-white transition-colors shrink-0"
            onClick={() => setShowCreateContract(true)}
          >
            <ReceiptText size={16} />
            <span className="text-[14px] font-semibold whitespace-nowrap">
              Send Contract
            </span>
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            aria-label="More options"
            className={`p-2 rounded-full transition-colors text-[#495057] ${showMenu ? "bg-[#F8F9FA]" : "hover:bg-[#F8F9FA]"}`}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreHorizontal size={24} />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-[#F1F3F5] py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
              {/* Send Contract Option (Mobile only) */}
              {isMobile && !contract?._id && hasService && (
                <button
                  className="w-full text-left px-6 py-4 text-[16px] font-bold text-[#FF8E8E] hover:bg-[#F8F9FA] transition-colors border-b border-[#F8F9FA]"
                  onClick={() => {
                    setShowCreateContract(true);
                    setShowMenu(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <ReceiptText size={18} />
                    <span>Send Contract</span>
                  </div>
                </button>
              )}

              <button
                className="w-full text-left px-6 py-4 text-[16px] font-bold text-[#212529] hover:bg-[#F8F9FA] transition-colors"
                onClick={() => {
                  // Add archive logic here
                  setShowMenu(false);
                }}
              >
                Archive this thread
              </button>
              <button
                className="w-full text-left px-6 py-4 text-[16px] font-bold text-[#212529] hover:bg-[#F8F9FA] transition-colors"
                onClick={() => {
                  // Add report logic here
                  setShowMenu(false);
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
