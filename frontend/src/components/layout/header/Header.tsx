import jobbloWordmark from '../../../assets/images/Login/jobblo-wordmark.png';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../../../stores/userStore';
import { toast } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { getMyChats } from '../../../api/chatAPI';
import { initSocket } from '../../../socket/socket';
import { Link, NavLink } from 'react-router-dom';
import { Bell, Home, Menu, MessageCircle, Plus, User, Users, Crown, X } from 'lucide-react';
import { useUnreadCount } from '../../../features/notifications/hooks';
import { useNotificationSound } from '../../../hooks/useNotificationSound';

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

          const currentUserId = String(user?._id || user?.id || '');
          if (!currentUserId) return false;

          const getMsgSenderId = (msg: any) => {
            if (!msg.senderId) return '';
            // If senderId is an object (populated), get _id. If it's a string, use it.
            if (typeof msg.senderId === 'string') return msg.senderId;
            if (typeof msg.senderId === 'object') {
              return String(msg.senderId._id || msg.senderId.id || '');
            }
            return String(msg.senderId);
          };

          const senderId = getMsgSenderId(lastMessage);
          if (!senderId) return false;

          // If you are the sender, it is NOT unread for you
          if (senderId === currentUserId) return false;

          // Check if you are in the seenBy array
          const seenBy = Array.isArray(lastMessage.seenBy) ? lastMessage.seenBy : [];
          const isSeenByMe = seenBy.some((id: any) => {
            const idStr = String(id?._id || id?.id || id || '');
            return idStr === currentUserId;
          });

          return !isSeenByMe;
        });

        setUnreadMessagesCount(unreadChats.length);

        // 2. Join socket rooms
        if (socket) {
          socket.emit('join', user?._id);
          chats.forEach((chat) => {
            if (chat._id) {
              socket.emit('join-chat', chat._id);
            }
          });
        }
      } catch (error) {
        console.error('Error initializing chat state in Header:', error);
      }
    };

    initializeChatState();

    // Listen for real-time messages
    const handleReceiveMessage = (data: any) => {
      // Re-fetch or re-calculate. Simplest is to re-initialize
      initializeChatState();

      // Play sound if message is from someone else
      const currentUserId = String(user?._id || user?.id || '');

      const getMsgSenderId = (msg: any) => {
        if (!msg) return '';
        const sId = msg.senderId || msg.sender;
        if (!sId) return '';
        if (typeof sId === 'string') return sId;
        if (typeof sId === 'object') return String(sId._id || sId.id || '');
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
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const notification = new Notification(`Ny melding fra Jobblo`, {
            body: data?.message?.text || 'Du har fått en ny melding',
            icon: '/logo192.png',
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
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const notification = new Notification('Ny varsel fra Jobblo', {
          body: data?.content || 'Du har fått et nytt varsel',
          icon: '/logo192.png',
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
        socket.on('connect', initializeChatState);
      }
      socket.on('receive-message', handleReceiveMessage);
      socket.on('messages-read', handleMessagesRead);
      socket.on('new_notification', handleNewNotification);
    }

    window.addEventListener('chat-read', handleChatRead);

    return () => {
      if (socket) {
        socket.off('receive-message', handleReceiveMessage);
        socket.off('messages-read', handleMessagesRead);
        socket.off('new_notification', handleNewNotification);
        socket.off('connect');
      }
      window.removeEventListener('chat-read', handleChatRead);
    };
  }, [user?._id, playMessageSound, playAlertSound]);

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      toast('Du må være logget inn for å få tilgang');
      navigate('/login');
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

  /**
   * Navigation for signed-out visitors. This array existed but was never rendered, so
   * the marketing header offered a home icon and a login button and nothing else — no
   * way into the product from the page most first-time visitors land on. Its old targets
   * (/slik-fungerer-det, /priser) were not routes either; these point at the landing
   * page section, the real browse route, and the pricing page.
   *
   * "Priser" pointed at `/#priser` — a landing section that no longer exists, since
   * pricing is now answered in full by its own page. It goes straight there.
   */
  const navLinks: NavLinkItem[] = [
    { name: 'Finn oppdrag', path: '/search/job/all' },
    { name: 'Slik fungerer det', path: '/#slik-fungerer-det' },
    { name: 'Priser', path: '/pricing' },
  ];

  const navLinkUse: NavLinkItem[] = [
    { name: 'Legg ut oppdrag', icon: <Plus size={20} />, path: '/publish-job' },
    { name: 'Hjem', icon: <Home size={25} />, path: '/home' },
    {
      name: 'Søkere',
      icon: <Users size={18} />,
      path: '/my-applicants',
    },
    {
      name: 'Medlemskap',
      icon: <Crown size={18} />,
      path: '/membership',
    },
    {
      name: 'Meldinger',
      icon: <MessageCircle size={18} />,
      path: '/messages',
      badgeCount: unreadMessagesCount,
    },
    {
      name: 'Varsler',
      icon: <Bell size={18} />,
      path: '/alerts',
      badgeCount: unreadNotificationsCount,
    },
    { name: 'Profil', icon: <User size={18} />, path: '/profile' },
  ];

  const isMessagesPage = location.pathname.startsWith('/messages');

  /**
   * Which signed-out nav link is the current page.
   *
   * `NavLink` cannot do this on its own here: it matches on pathname only, so
   * "/#slik-fungerer-det" would count as active for the whole landing page and light up
   * next to whatever else lives at "/". A link carrying a hash is only current when that
   * hash is the one in the URL.
   */
  const isCurrent = (path: string) => {
    const [pathname, hash] = path.split('#');
    if (hash) return location.pathname === (pathname || '/') && location.hash === `#${hash}`;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b border-[#E6E7E1] bg-white/85 backdrop-blur-md ${isMessagesPage ? 'mb-0' : ''}`}
      >
        <div className="mx-auto flex h-18 max-w-300 items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
          {/* LOGO — the trimmed full-colour wordmark, not the 93 KB base64 raster the
              icon barrel exports. */}
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Jobblo — til forsiden"
            className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20"
          >
            <img
              src={jobbloWordmark}
              alt="Jobblo"
              width={340}
              height={128}
              className="h-7 w-auto"
            />
          </button>

          {/* DESKTOP NAV — signed out. These were plain <a href> tags, so every click on
              "Finn oppdrag" or "Priser" tore down the SPA and reloaded the whole bundle.
              They are router links now, and the current one is marked. */}
          {!Auth && (
            <nav className="hidden flex-1 items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={isCurrent(link.path) ? 'page' : undefined}
                  className={`rounded-full px-3.5 py-2 text-[0.875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25 ${
                    isCurrent(link.path)
                      ? 'bg-[#F0F1EB] text-[#0B0B0B]!'
                      : 'text-[#63665F]! hover:bg-[#F0F1EB] hover:text-[#0B0B0B]!'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          )}

          {Auth && (
            <div className="hidden md:flex items-center gap-6 px-4 py-3">
              {navLinkUse.map((link, index) => {
                const homeButton = link.path === '/home';
                const isHomeButtonActive = homeButton && location.pathname === link.path;

                if (homeButton) {
                  return (
                    <button
                      key={index}
                      onClick={() => handleProtectedNavigation(link.path)}
                      className={`flex items-center mx-auto ${isHomeButtonActive ? 'text-custom-green' : 'hover:text-custom-green'}`}
                    >
                      {link.icon}
                    </button>
                  );
                }
                const jobButton = link.path === '/publish-job';
                const isJobButtonActive = jobButton && location.pathname === link.path;
                if (jobButton) {
                  return (
                    <button
                      key={index}
                      onClick={() => handleProtectedNavigation(link.path)}
                      className={`flex items-center mx-auto ${isJobButtonActive ? 'bg-custom-green' : 'bg-custom-green'} text-white px-4 py-2 rounded-full font-medium transition-hover hover:bg-custom-green`}
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
                        isActive ? 'border-b-2 border-[#2F7E47]' : ''
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

          {/* RIGHT SIDE (MOBILE TOGGLE) — was the literal character "☰" */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Åpne meny"
            className="rounded-lg p-1.5 text-[#0B0B0B] transition-colors hover:bg-[#F0F1EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25 md:hidden"
          >
            <Menu size={22} strokeWidth={2} />
          </button>

          {/* The landing page runs entirely on pills; a squared-off pair of buttons in the
              bar directly above it read as a different product. Same shape, same heights. */}
          {!Auth && (
            <div className="hidden shrink-0 items-center gap-2.5 md:flex">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex h-11 items-center rounded-full border border-[#E6E7E1] bg-white px-5 text-[0.875rem] font-medium text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 active:scale-[0.99]"
              >
                Logg inn
              </button>
              <button
                type="button"
                onClick={() => navigate('/Publish-job')}
                className="flex h-11 items-center rounded-full bg-[#2E6641] px-5 text-[0.875rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 active:scale-[0.99]"
              >
                Legg ut oppdrag
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
          className={`fixed left-0 top-0 z-50 h-full w-72 transform bg-white transition-transform duration-300 md:hidden ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#E6E7E1] px-5 py-4">
            <img
              src={jobbloWordmark}
              alt="Jobblo"
              width={340}
              height={128}
              className="h-6 w-auto"
            />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Lukk meny"
              className="rounded-lg p-1.5 text-[#63665F] transition-colors hover:bg-[#F0F1EB] hover:text-[#0B0B0B]"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>

          <ul className="flex flex-col gap-1 p-4">
            {!Auth ? (
              <>
                {navLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isCurrent(link.path) ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                        isCurrent(link.path)
                          ? 'bg-[#F0F1EB] text-[#0B0B0B]!'
                          : 'text-[#0B0B0B]! hover:bg-[#F0F1EB]'
                      }`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </>
            ) : (
              navLinkUse.map((link, index) => (
                <li key={index}>
                  <NavLink
                    to={link.path}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 p-3 rounded-lg ${
                        isActive ? 'bg-green-50 text-custom-green! font-bold' : 'text-gray-700!'
                      }`
                    }
                  >
                    {link.icon && (
                      <div className="relative text-[#0A0A0A9E]! group-hover:text-black">
                        {link.icon}
                        {link.badgeCount !== undefined && link.badgeCount > 0 && (
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

          {!Auth && (
            <div className="flex flex-col gap-2 px-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/Publish-job');
                }}
                className="flex h-12 items-center justify-center rounded-full bg-[#2E6641] px-5 text-[0.9375rem] font-semibold text-white transition hover:bg-[#255335]"
              >
                Legg ut oppdrag
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/login');
                }}
                className="flex h-12 items-center justify-center rounded-full border border-[#E6E7E1] px-5 text-[0.9375rem] font-medium text-[#0B0B0B] transition hover:border-[#2E6641]/45"
              >
                Logg inn
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
