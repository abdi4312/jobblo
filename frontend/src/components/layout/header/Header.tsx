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

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasUnreadMessages(false);
      return;
    }

    const checkUnreadMessages = async () => {
      try {
        const chats = await getMyChats();

        // Check if any chat has unread messages based on individual chat timestamps
        const unreadChats = chats.filter((chat) => {
          if (!chat.updatedAt) return false;

          const lastCheckedTime = localStorage.getItem(
            `lastChatCheck_${user._id}_${chat._id}`,
          );

          // If never checked before, only mark as unread if updated in last 7 days
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
      } catch (error) {
        // Silently fail - don't show unread indicator if we can't check
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

  const navLinks: NavLink[] = [
    { name: "Om oss", path: "/om-oss" },
    { name: "Slik fungerer det", path: "/slik-fungerer-det" },
    { name: "Tjenester", path: "/tjenester" },
    { name: "Priser", path: "/priser" },
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
          <div
            className="h-10.75 w-40 sm:w-53.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Icons.JobbloIcon />
          </div>

          {/* NAV LINKS (DESKTOP) */}
          <div>
            <ul className="hidden md:flex gap-8 list-none">
              {navLinks.map((link: NavLink, index: number) => (
                <li key={index}>
                  <NavLink
                    to={link.path}
                    className={({ isActive }) =>
                      `transition-all font-light text-[16px]! text-[#0A0A0A9E]! cursor-pointer ${isActive
                        ? "text-black"
                        : "text-[#4b4b4b] hover:text-black"
                      }`
                    }
                  >
                    {link.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-4">

            {/* HAMBURGER */}
            <button
              className="md:hidden text-2xl"
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>

            {/* VIPPS BUTTON */}
            <div className="hidden md:block">
              <VippsButton />
            </div>
          </div>
        </div>

        {/* BACKDROP */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 md:hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          {/* HEADER */}
          <div className="flex justify-between items-center p-4 border-b">
            <span className="font-semibold">Menu</span>
            <button onClick={() => setMenuOpen(false)}>✕</button>
          </div>

          {/* LINKS */}
          <ul className="flex flex-col gap-4 p-4">
            {navLinks.map((link: NavLink, index: number) => (
              <li key={index}>
                <NavLink
                  to={link.path}
                  onClick={() => setMenuOpen(false)}
                  className="block text-gray-700! hover:text-black!"
                >
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* BUTTON */}
          <div className="p-4 border-t">
            <VippsButton />
          </div>
        </div>
      </header>
    </>
  );
}
