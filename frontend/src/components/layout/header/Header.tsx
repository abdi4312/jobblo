import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { toast } from 'react-toastify';
import { useState, useEffect } from "react";
import { getMyChats } from "../../../api/chatAPI";
import { initSocket } from "../../../socket/socket";

export default function Header() {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Unread Messages Logic (Same as your original)
  useEffect(() => {
    if (!user) {
      setHasUnreadMessages(false);
      return;
    }

    const checkUnreadMessages = async () => {
      try {
        const chats = await getMyChats();
        const unreadChats = chats.filter(chat => {
          if (!chat.updatedAt) return false;
          const lastCheckedTime = localStorage.getItem(`lastChatCheck_${user._id}_${chat._id}`);
          if (!lastCheckedTime) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(chat.updatedAt) > weekAgo;
          }
          const lastChecked = new Date(lastCheckedTime);
          const chatUpdated = new Date(chat.updatedAt);
          return chatUpdated > lastChecked;
        });
        setHasUnreadMessages(unreadChats.length > 0);
      } catch (error) { /* Silent fail */ }
    };

    checkUnreadMessages();
    const handleChatRead = () => checkUnreadMessages();
    window.addEventListener('chat-read', handleChatRead);
    return () => window.removeEventListener('chat-read', handleChatRead);
  }, [user]);

  // Socket Logic (Same as your original)
  useEffect(() => {
    if (!user) return;
    const socket = initSocket();
    if (!socket) return;

    const joinUserChats = async () => {
      try {
        const chats = await getMyChats();
        chats.forEach(chat => { if (chat._id) socket.emit('join-chat', chat._id); });
      } catch (error) { console.error('Failed to join chat rooms:', error); }
    };

    const handleReceiveMessage = () => setHasUnreadMessages(true);

    if (socket.connected) joinUserChats();
    else socket.on('connect', () => joinUserChats());

    socket.on("receive-message", handleReceiveMessage);
    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off('connect');
    };
  }, [user]);

  // Scroll Handling Logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < lastScrollY) setShowHeader(true);
      else setShowHeader(false);
      setLastScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      toast.warning("Du må være logget inn for å få tilgang");
      navigate("/login");
    } else navigate(path);
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-[70px] z-[1000] bg-[#fcf9eb] flex justify-center transition-transform duration-300
        ${showHeader ? "translate-y-0" : "-translate-y-full"} 
        lg:translate-y-0`}
    >
      <div className="max-w-[1000px] w-full flex items-center justify-between px-5">
        
        {/* Logo Section */}
        <div className="cursor-pointer [&>svg]:w-[100px] [&>svg]:h-[32px]" onClick={() => navigate("/")}>
          <Icons.JobbloIcon />
        </div>

        {/* Icons Navigation */}
        <div className="flex items-center gap-[30px]">
          {/* Notifications */}
          <div 
            className="flex flex-row items-center gap-1 cursor-pointer group"
            onClick={() => handleProtectedNavigation("/Alert")}
          >
            <Icons.BellIcon />
            <span className="text-[12px] font-[800] text-[#555] whitespace-nowrap group-hover:text-[#2d4a3e] hidden md:block">Notifikasjoner</span>
          </div>

          {/* Add Ad */}
          <div 
            className="flex flex-row items-center gap-1 cursor-pointer group"
            onClick={() => handleProtectedNavigation("/publish-job")}
          >
            <Icons.PlusIcon />
            <span className="text-[12px] font-[800] text-[#555] whitespace-nowrap group-hover:text-[#2d4a3e] hidden md:block">Legg til annonse</span>
          </div>

          {/* Messages */}
          <div 
            className="flex flex-row items-center gap-1 cursor-pointer group"
            onClick={() => handleProtectedNavigation("/messages")}
          >
            <div className="relative flex items-center">
              <Icons.MessageIcon />
              {hasUnreadMessages && (
                <span className="absolute -top-[2px] -right-[2px] w-[10px] h-[10px] bg-[#EA1717] rounded-full border-[1.5px] border-[#fcf9eb]"></span>
              )}
            </div>
            <span className="text-[12px] font-[800] text-[#555] whitespace-nowrap group-hover:text-[#2d4a3e] hidden md:block">Meldinger</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-[10px] text-[14px] font-semibold">
          <VippsButton />
        </div>

      </div>
    </div>
  );
}