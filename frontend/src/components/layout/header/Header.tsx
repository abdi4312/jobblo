import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { toast } from "react-hot-toast";
import { useState, useEffect } from "react";
import { getMyChats } from "../../../api/chatAPI";
import { initSocket } from "../../../socket/socket";
import { NavLink } from "react-router-dom";
import { Bell, FileText, Home, MessageCircle, Plus, User } from "lucide-react";
import { useUnreadCount } from "../../../features/notifications/hooks";
import { useNotificationSound } from "../../../hooks/useNotificationSound";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const Auth = useUserStore((state) => state.isAuthenticated);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const { playMessageSound, playAlertSound } = useNotificationSound();

  // Get unread notifications count using our new hook
  const { data: unreadNotificationsData } = useUnreadCount(user?._id);
  const unreadNotificationsCount = unreadNotificationsData?.count || 0;

  useEffect(() => {
    if (!user?._id) {
      setUnreadMessagesCount(0);
      return;
    }

    const socket = initSocket();

    const initializeChatState = async () => {
      try {
        const chats = await getMyChats();
        if (!Array.isArray(chats)) return;

        // 1. Calculate unread count
        const unreadChats = chats.filter((chat) => {
          if (!chat.messages || chat.messages.length === 0) return false;
          const lastMessage = chat.messages[chat.messages.length - 1];

          const currentUserId = String(user?._id || user?.id || "");
          if (!currentUserId) return false;

          const getMsgSenderId = (msg: any) => {
            if (!msg.senderId) return "";
            // If senderId is an object (populated), get _id. If it's a string, use it.
            if (typeof msg.senderId === "string") return msg.senderId;
            if (typeof msg.senderId === "object") {
              return String(msg.senderId._id || msg.senderId.id || "");
            }
            return String(msg.senderId);
          };

          const senderId = getMsgSenderId(lastMessage);
          if (!senderId) return false;

          // If you are the sender, it is NOT unread for you
          if (senderId === currentUserId) return false;

          // Check if you are in the seenBy array
          const seenBy = Array.isArray(lastMessage.seenBy)
            ? lastMessage.seenBy
            : [];
          const isSeenByMe = seenBy.some((id: any) => {
            const idStr = String(id?._id || id?.id || id || "");
            return idStr === currentUserId;
          });

          return !isSeenByMe;
        });

        setUnreadMessagesCount(unreadChats.length);

        // 2. Join socket rooms
        if (socket) {
          socket.emit("join", user?._id);
          chats.forEach((chat) => {
            if (chat._id) {
              socket.emit("join-chat", chat._id);
            }
          });
        }
      } catch (error) {
        console.error("Error initializing chat state in Header:", error);
      }
    };

    initializeChatState();

    // Listen for real-time messages
    const handleReceiveMessage = (data: any) => {
      // Re-fetch or re-calculate. Simplest is to re-initialize
      initializeChatState();

      // Play sound if message is from someone else
      const currentUserId = String(user?._id || user?.id || "");

      const getMsgSenderId = (msg: any) => {
        if (!msg) return "";
        const sId = msg.senderId || msg.sender;
        if (!sId) return "";
        if (typeof sId === "string") return sId;
        if (typeof sId === "object") return String(sId._id || sId.id || "");
        return String(sId);
      };

      const senderId = getMsgSenderId(data?.message);

      if (senderId && currentUserId && senderId !== currentUserId) {
        // 1. Play sound
        if (useUserStore.getState().notificationsEnabled) {
          playMessageSound();
        }

        // 2. Show browser notification if minimized/background
        if (
          useUserStore.getState().browserNotificationsEnabled &&
          document.hidden &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const notification = new Notification(`Ny melding fra Jobblo`, {
            body: data?.message?.text || "Du har fått en ny melding",
            icon: "/logo192.png",
          });

          notification.onclick = () => {
            window.focus();
            if (data?.chatId) navigate(`/messages/${data.chatId}`);
            notification.close();
          };

          // Auto-close after 5 seconds
          setTimeout(() => notification.close(), 5000);
        }
      }
    };

    // Listen for new notifications (alerts)
    const handleNewNotification = (data: any) => {
      if (useUserStore.getState().notificationsEnabled) {
        playAlertSound();
      }

      if (
        useUserStore.getState().browserNotificationsEnabled &&
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("Ny varsel fra Jobblo", {
          body: data?.content || "Du har fått et nytt varsel",
          icon: "/logo192.png",
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      }
    };

    // Listen for real-time read status
    const handleMessagesRead = (data: any) => {
      initializeChatState();
    };

    // Listen for local tab updates
    const handleChatRead = () => {
      initializeChatState();
    };

    if (socket) {
      if (socket.connected) {
        initializeChatState();
      } else {
        socket.on("connect", initializeChatState);
      }
      socket.on("receive-message", handleReceiveMessage);
      socket.on("messages-read", handleMessagesRead);
      socket.on("new_notification", handleNewNotification);
    }

    window.addEventListener("chat-read", handleChatRead);

    return () => {
      if (socket) {
        socket.off("receive-message", handleReceiveMessage);
        socket.off("messages-read", handleMessagesRead);
        socket.off("new_notification", handleNewNotification);
        socket.off("connect");
      }
      window.removeEventListener("chat-read", handleChatRead);
    };
  }, [user?._id, playMessageSound, playAlertSound]);

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      toast("Du må være logget inn for å få tilgang");
      navigate("/login");
    } else {
      navigate(path);
    }
  };

  interface NavLinkItem {
    name: string;
    icon?: React.ReactNode;
    path: string;
    badgeCount?: number;
  }

  const navLinks: NavLinkItem[] = [
    { name: "Slik fungerer det", path: "/slik-fungerer-det" },
    { name: "Tjenester", path: "/job-listing" },
    { name: "Priser", path: "/priser" },
  ];

  const navLinkUse: NavLinkItem[] = [
    { name: "Legg ut oppdrag", icon: <Plus size={20} />, path: "/publish-job" },
    { name: "Hjem", icon: <Home size={25} />, path: "/home" },
    {
      name: "Meldinger",
      icon: <MessageCircle size={18} />,
      path: "/messages",
      badgeCount: unreadMessagesCount,
    },
    {
      name: "Varsler",
      icon: <Bell size={18} />,
      path: "/alerts",
      badgeCount: unreadNotificationsCount,
    },
    { name: "Kontrakt", icon: <FileText size={18} />, path: "/contracts" },
    { name: "Profil", icon: <User size={18} />, path: "/profile" },
  ];

  const isMessagesPage = location.pathname.startsWith("/messages");

  return (
    <>
      <header
        className={`bg-[#F6F1E8] relative ${isMessagesPage ? "mb-0" : "mb-6"}`}
      >
        <div className="h-14 md:h-22.75 max-w-300 mx-auto flex justify-between items-center px-4 lg:px-0">
          {/* LOGO */}
          <div
            className="h-10.75 w-40 sm:w-40.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Icons.JobbloIcon />
          </div>

          {/* DESKTOP NAV */}
          {!Auth && <div className="hidden md:flex flex-1"></div>}

          {Auth && (
            <div className="hidden md:flex items-center gap-6 px-4 py-3">
              {navLinkUse.map((link, index) => {
                const homeButton = link.path === "/home";
                const isHomeButtonActive =
                  homeButton && location.pathname === link.path;

                if (homeButton) {
                  return (
                    <button
                      key={index}
                      onClick={() => handleProtectedNavigation(link.path)}
                      className={`flex items-center mx-auto ${isHomeButtonActive ? "text-[#2F7E47]" : "hover:text-[#2F7E47]"}`}
                    >
                      {link.icon}
                    </button>
                  );
                }
                const jobButton = link.path === "/publish-job";
                const isJobButtonActive =
                  jobButton && location.pathname === link.path;
                if (jobButton) {
                  return (
                    <button
                      key={index}
                      onClick={() => handleProtectedNavigation(link.path)}
                      className={`flex items-center mx-auto ${isJobButtonActive ? "bg-[#2F7E47]" : "bg-[#2F7E47]"} text-white px-4 py-2 rounded-full font-medium transition-hover hover:bg-[#2F7E47]`}
                    >
                      {link.icon}
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={index}
                    to={link.path}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2 cursor-pointer group py-2 ${
                        isActive ? "border-b-2 border-[#2F7E47]" : ""
                      }`
                    }
                  >
                    <div className="relative text-[#364153]! group-hover:text-black">
                      {link.icon}
                      {link.badgeCount !== undefined && link.badgeCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                          {link.badgeCount}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-[#0A0A0A9E]! group-hover:text-black">
                      {link.name}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          )}

          {/* RIGHT SIDE (MOBILE TOGGLE) */}
          <div className="md:hidden">
            <button className="text-2xl" onClick={() => setMenuOpen(true)}>
              ☰
            </button>
          </div>
          {!Auth && (
            <div className="md:flex items-center gap-6 hidden">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `transition-all cursor-pointer ${
                    isActive
                      ? "text-[#2F7E47]!"
                      : "text-[#2F7E47]!"
                  }`
                }
              >
                <Home size={30} strokeWidth={1.5} />
              </NavLink>

              <button
                onClick={() => navigate("/login")}
                className="bg-[#2F7E47] text-white px-8 py-3 rounded-[20px] font-semibold transition-all hover:bg-[#25633a] active:scale-95 shadow-sm"
              >
                Register/Log in
              </button>
            </div>
          )}
        </div>

        {/* SIDEBAR MOBILE */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 md:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex justify-between items-center p-4 border-b">
            <span className="font-semibold">Meny</span>
            <button onClick={() => setMenuOpen(false)}>✕</button>
          </div>

          <ul className="flex flex-col gap-2 p-4">
            {!Auth ? (
              <>
                <li>
                  <NavLink
                    to="/home"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 p-3 rounded-lg ${
                        isActive
                          ? "bg-green-50 text-[#2F7E47]! font-bold"
                          : "text-gray-700!"
                      }`
                    }
                  >
                    <Home size={20} />
                    <span className="text-sm font-medium">Hjem</span>
                  </NavLink>
                </li>
                {/* <li>
                  <NavLink
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg text-gray-700 hover:bg-green-50 hover:text-[#2F7E47]"
                  >
                    <User size={20} />
                    <span className="text-sm font-medium">Register/Log in</span>
                  </NavLink>
                </li> */}
              </>
            ) : (
              navLinkUse.map((link, index) => (
                <li key={index}>
                  <NavLink
                    to={link.path}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 p-3 rounded-lg ${
                        isActive
                          ? "bg-green-50 text-[#2F7E47]! font-bold"
                          : "text-gray-700!"
                      }`
                    }
                  >
                    {link.icon && (
                      <div className="relative text-[#0A0A0A9E]! group-hover:text-black">
                        {link.icon}
                        {link.badgeCount !== undefined &&
                          link.badgeCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                              {link.badgeCount}
                            </span>
                          )}
                      </div>
                    )}
                    <span className="text-sm font-medium text-[#0A0A0A9E]! group-hover:text-black">
                      {link.name}
                    </span>
                  </NavLink>
                </li>
              ))
            )}
          </ul>

          {/* Vipps Button in Sidebar for mobile logout users */}
          {!Auth && (
            <div className="p-4">
              <VippsButton />
            </div>
          )}
        </div>
      </header>
    </>
  );
}
