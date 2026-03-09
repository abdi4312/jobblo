import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { VerticalDivider } from "../../component/divider/verticalDivider/VerticalDivider.tsx";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { toast } from "react-toastify";
import { useState, useEffect } from "react";
import { getMyChats } from "../../../api/chatAPI";
import { initSocket } from "../../../socket/socket";
import { NavLink } from "react-router-dom";
import { Bell, Heart, MessageCircle, Plus, User } from "lucide-react";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const Auth = useUserStore((state) => state.isAuthenticated);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setHasUnreadMessages(false);
      return;
    }

    const checkUnreadMessages = async () => {
      if (!user?._id) return;

      try {
        const chats = await getMyChats();

        // Debugging ke liye:
        // console.log("Sab chats:", chats);

        if (!Array.isArray(chats)) return;

        const unreadChats = chats.filter((chat) => {
          // 1. Check karein ke last message kisne bheja
          // Agar lastMessage object mojud hai aur uska sender MERI id hai, toh false return karein
          const lastSenderId = chat.clientId?._id || chat.lastMessage?.sender;

          if (lastSenderId === user._id) {
            return false;
          }

          // 2. Agar koi update hi nahi hai toh skip
          if (!chat.updatedAt) return false;

          // 3. LocalStorage check
          const lastCheckedTime = localStorage.getItem(
            `lastChatCheck_${user._id}_${chat._id}`
          );

          const chatUpdatedTime = new Date(chat.updatedAt).getTime();

          // 4. Time Comparison
          if (!lastCheckedTime) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return chatUpdatedTime > weekAgo.getTime();
          }

          const lastCheckedTimestamp = new Date(lastCheckedTime).getTime();
          return chatUpdatedTime > lastCheckedTimestamp;
        });

        setHasUnreadMessages(unreadChats.length > 0);
        setUnreadCount(unreadChats.length);
      } catch (error) {
        console.error("Error fetching chats for unread count:", error);
      }
    };

    checkUnreadMessages();

    // Listen for when user opens a chat (to clear red dot immediately)
    const handleChatRead = () => {
      checkUnreadMessages();
    };

    window.addEventListener("chat-read", handleChatRead);

    return () => {
      window.removeEventListener("chat-read", handleChatRead);
    };
  }, [user]);

  // Separate effect for socket listener to avoid re-subscribing
  useEffect(() => {
    if (!user) return;

    // Socket setup for real-time notifications - ensure connection
    const socket = initSocket();

    if (!socket) return;

    // Join all chat rooms for real-time notifications
    const joinUserChats = async () => {
      try {
        const chats = await getMyChats();
        chats.forEach((chat) => {
          if (chat._id) {
            socket.emit("join-chat", chat._id);
          }
        });
      } catch (error) {
        console.error("Failed to join chat rooms:", error);
      }
    };

    const handleReceiveMessage = (data: any) => {
      // Always show notification when receiving a message
      // It will be cleared when user actually opens that specific chat
      setHasUnreadMessages(true);
    };

    // Wait for socket to be connected before joining rooms
    if (socket.connected) {
      joinUserChats();
    } else {
      socket.on("connect", () => {
        joinUserChats();
      });
    }

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("connect");
    };
  }, [user]);

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      toast.warning("Du må være logget inn for å få tilgang");
      navigate("/login");
    } else {
      navigate(path);
    }
  };

  const handleMessagesClick = () => {
    // Don't clear unread status here - it should only clear when all chats are checked
    handleProtectedNavigation("/messages");
  };

  interface NavLink {
    name: string;
    path: string;
  }
  interface NavLinkItem {
    name: string;
    icon: React.ReactNode;
    path: string;
    badgeCount?: number;
  }

  const navLinks: NavLink[] = [
    { name: "Om oss", path: "/om-oss" },
    { name: "Slik fungerer det", path: "/slik-fungerer-det" },
    { name: "Tjenester", path: "/job-listing" },
    { name: "Priser", path: "/priser" },
  ];

  const navLinkUse: NavLinkItem[] = [
    { name: "Legg ut oppdrag", icon: <Plus size={20} />, path: "/publish-job" },
    { name: "Meldinger", icon: <MessageCircle size={18} />, path: "/messages", badgeCount: unreadCount },
    { name: "Varsler", icon: <Bell size={18} />, path: "/alerts" },
    { name: "Favoritter", icon: <Heart size={18} />, path: "/favoritter" },
    { name: "Profil", icon: <User size={18} />, path: "/profile" },
  ];
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < lastScrollY) {
        // Bruker scroller opp
        setShowHeader(true);
      } else {
        // Bruker scroller ned
        setShowHeader(false);
      }
      setLastScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  return (
    <>
      {/* <header className={`${showHeader ? "translate-y-0" : "-translate-y-full"} bg-white transition-transform duration-300 fixed top-0 left-0 right-0 z-50`}> */}
      <header className="bg-white relative mb-5 md:mb-16">
        <div className="h-14 md:h-22.75 max-w-300 mx-auto flex justify-between items-center px-4 lg:px-0">

          {/* LOGO */}
          <div className="h-10.75 w-40 sm:w-40.5 cursor-pointer" onClick={() => navigate("/")}>
            <Icons.JobbloIcon />
          </div>

          {/* DESKTOP NAV */}
          {!Auth && (
            <ul className="hidden md:flex gap-8 list-none">
              {navLinks.map((link, index) => (
                <li key={index}>
                  <NavLink
                    to={link.path}
                    className={({ isActive }) =>
                      `transition-all font-light text-[16px] cursor-pointer ${isActive ? "text-black font-semibold" : "text-[#0A0A0A9E]! hover:text-black!"
                      }`
                    }
                  >
                    {link.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}

          {Auth && (
            <div className="hidden md:flex items-center gap-6 px-4 py-3">
              {navLinkUse.map((link, index) => {
                const isButton = link.path === "/publish-job";
                if (isButton) {
                  return (
                    <button
                      key={index}
                      onClick={() => handleProtectedNavigation(link.path)}
                      className="flex items-center gap-2 bg-[#3F8F6B] text-white px-5 py-2.5 rounded-full font-medium transition-hover hover:bg-[#387a5d]"
                    >
                      {link.icon} <span className="text-sm font-semibold">{link.name}</span>
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={index}
                    to={link.path}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2 cursor-pointer group py-2 ${isActive ? "border-b-2 border-[#44916F]" : ""
                      }`
                    }
                  >
                    <div className="relative text-[#364153]! group-hover:text-black">
                      {link.icon}
                      {(link.badgeCount !== undefined && link.badgeCount > 0) && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                          {link.badgeCount}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-[#0A0A0A9E]! group-hover:text-black">{link.name}</span>
                  </NavLink>
                );
              })}
            </div>
          )}

          {/* RIGHT SIDE (MOBILE TOGGLE) */}
          <div className="md:hidden">
            <button className="text-2xl" onClick={() => setMenuOpen(true)}>☰</button>
          </div>
          {!Auth &&
            <div className="md:flex items-center gap-4 hidden">
              <div className="hidden md:block"><VippsButton /></div>
            </div>}
        </div>

        {/* SIDEBAR MOBILE */}
        {menuOpen && (
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMenuOpen(false)} />
        )}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 md:hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="flex justify-between items-center p-4 border-b">
            <span className="font-semibold">Meny</span>
            <button onClick={() => setMenuOpen(false)}>✕</button>
          </div>

          <ul className="flex flex-col gap-2 p-4">
            {/* Logic: If Auth show navLinkUse else navLinks */}
            {(Auth ? navLinkUse : navLinks).map((link: any, index: number) => (
              <li key={index}>
                <NavLink
                  to={link.path}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg ${isActive ? "bg-green-50 text-[#44916F] font-bold" : "text-gray-700"
                    }`
                  }
                >
                  {link.icon && <span className="text-[#0A0A0A9E]! group-hover:text-black">{link.icon}</span>}
                  <span className="text-sm font-medium text-[#0A0A0A9E]! group-hover:text-black">{link.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Vipps Button in Sidebar for mobile logout users */}
          {!Auth && <div className="p-4"><VippsButton /></div>}
        </div>
      </header>
    </>
  );
}
