import jobbloWordmark from '../../../assets/images/Login/jobblo-wordmark.png';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../../../stores/userStore';
import { toast } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { getMyChats } from '../../../api/chatAPI';
import { initSocket } from '../../../socket/socket';
import { Link, NavLink } from 'react-router-dom';
import {
  Bell,
  Crown,
  Home,
  Menu,
  MessageCircle,
  Plus,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';
import { useUnreadCount } from '../../../features/notifications/hooks';
import { NotificationBell } from '../../Notifications/NotificationBell';
import { useNotificationSound } from '../../../hooks/useNotificationSound';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const Auth = useUserStore((state) => state.isAuthenticated);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const { playMessageSound, playAlertSound } = useNotificationSound();

  // Still read here for the mobile drawer's badge — the desktop bell has its own copy,
  // and react-query dedupes them onto one request. `useUnreadCount` takes no argument;
  // it reads the user from the store itself, so the id passed here was silently ignored.
  const { data: unreadNotificationsData } = useUnreadCount();
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

  /**
   * The labelled destinations in the desktop bar.
   *
   * `navLinkUse` above still drives the mobile drawer, where every entry wants its icon
   * and its name. Up here only these four are worth a word — the rest are the post CTA,
   * the bell and the profile, which are rendered explicitly so their sizes cannot drift
   * apart the way they had.
   */
  const DESKTOP_LINKS = [
    { name: 'Hjem', path: '/home' },
    { name: 'Søkere', path: '/my-applicants' },
    { name: 'Medlemskap', path: '/membership' },
    { name: 'Meldinger', path: '/messages' },
  ];

  const isMessagesPage = location.pathname.startsWith('/messages');

  // While the drawer is open it owns the screen: Escape closes it, and the page behind
  // stops scrolling so a swipe over the overlay does not move the feed underneath.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Any navigation closes it — otherwise it stays open over the page just navigated to.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  /**
   * Two flags, because a panel cannot animate out of a tree it has already left.
   *
   * `drawerMounted` keeps it in the DOM; `drawerShown` is what the transform reads. On
   * open it mounts off-screen and slides in a frame later — without that frame the
   * browser coalesces both styles into one paint and the panel simply appears. On close
   * it slides out first and unmounts when the transition ends, so the exit is visible.
   */
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerShown, setDrawerShown] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      setDrawerMounted(true);
      const frame = requestAnimationFrame(() => setDrawerShown(true));
      return () => cancelAnimationFrame(frame);
    }

    setDrawerShown(false);
    // Matches the 300 ms transition below. A timer rather than onTransitionEnd because
    // that event never fires if the panel is unmounted or the tab is backgrounded first.
    const timer = setTimeout(() => setDrawerMounted(false), 300);
    return () => clearTimeout(timer);
  }, [menuOpen]);

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

          {/* DESKTOP NAV — signed in.
              This row used to render four different shapes side by side: an icon-only
              green pill, a bare 25 px icon with `mx-auto` (meaningless inside a flex
              row), three icon+label links at `py-2` that grew a 2 px bottom border when
              active, and a 40 px round bell. Four heights, three icon sizes and three
              different ways of showing "you are here" — so nothing lined up on any
              baseline.

              It is two groups now. Destinations are label pills, matching the signed-out
              nav exactly. Notifications and profile are icon-only buttons of one size,
              grouped tight at the end where utility controls belong, with the post CTA
              last. Everything in the row is h-10 and centred on one axis. */}
          {Auth && (
            <div className="hidden flex-1 items-center justify-end gap-1 md:flex">
              {DESKTOP_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={isCurrent(link.path) ? 'page' : undefined}
                  className={`flex h-10 items-center gap-2 rounded-full px-3.5 text-[0.875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25 ${
                    isCurrent(link.path)
                      ? 'bg-[#F0F1EB] text-[#0B0B0B]!'
                      : 'text-[#63665F]! hover:bg-[#F0F1EB] hover:text-[#0B0B0B]!'
                  }`}
                >
                  {link.name}
                  {link.path === '/messages' && unreadMessagesCount > 0 && (
                    /* Was `bg-red-500` — the only red on the site, for something that is
                       not an error. */
                    <span className="flex min-w-4.5 items-center justify-center rounded-full bg-[#2E6641] px-1 text-[0.625rem] font-bold leading-4.5 text-white">
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                    </span>
                  )}
                </Link>
              ))}

              <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-[#E6E7E1]" />

              {/* The bell is a panel, not a destination: checking "do I have anything?"
                  should not cost a navigation away from whatever you were doing. Its own
                  footer link is what takes you to the full page. */}
              <NotificationBell />

              <NavLink
                to="/profile"
                aria-label="Profil"
                title="Profil"
                className={({ isActive }) =>
                  `flex size-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                    isActive
                      ? 'bg-[#F0F1EB] text-[#0B0B0B]!'
                      : 'text-[#63665F]! hover:bg-[#F0F1EB] hover:text-[#0B0B0B]!'
                  }`
                }
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="size-7 rounded-full object-cover"
                  />
                ) : (
                  <User size={19} strokeWidth={2} />
                )}
              </NavLink>

              <button
                type="button"
                onClick={() => handleProtectedNavigation('/publish-job')}
                className="ml-1.5 flex h-10 items-center gap-1.5 rounded-full bg-[#2E6641] px-4 text-[0.875rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20"
              >
                <Plus size={17} strokeWidth={2.6} />
                Legg ut
              </button>
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
      </header>

      {/* ── MOBILE DRAWER ──────────────────────────────────────────────────────
          This lives OUTSIDE <header> on purpose, and that is the whole bug fix.
          The header carries `backdrop-blur-md`, and an element with a backdrop-filter
          becomes the containing block for any `position: fixed` descendant — so the
          drawer's `inset-0` and `h-full` resolved against a 72 px tall bar instead of
          the viewport. It rendered as a sliver clipped to the header, with the overlay
          covering only that strip. As a sibling it positions against the viewport again.

          It is also mounted only while open, so its links are not in the tab order of
          every page when it is closed. */}
      {drawerMounted && (
        <div className="md:hidden">
          {/* The scrim fades; the panel slides. Both on the same 300 ms curve so they
              read as one movement, and both held still under reduced-motion. */}
          <div
            role="presentation"
            onClick={() => setMenuOpen(false)}
            className={`fixed inset-0 z-50 bg-[#0B0B0B]/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
              drawerShown ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Meny"
            className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col bg-[#EFF0EA] shadow-[0_24px_60px_rgba(11,11,11,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none ${
              drawerShown ? 'translate-x-0' : '-translate-x-full'
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
                className="flex size-10 items-center justify-center rounded-full border border-[#E6E7E1] bg-white text-[#63665F] transition-colors hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            {/* Signed in: who you are, at the top, so the menu has an owner. */}
            {Auth && (
              <div className="flex items-center gap-3 border-b border-[#E6E7E1] px-5 py-4">
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] text-[0.9375rem] font-semibold text-[#2E6641]">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    (user?.name?.[0] || 'J').toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem] font-semibold text-[#0B0B0B]">
                    {user?.name || 'Min konto'}
                  </span>
                  <span className="block text-[0.8125rem] text-[#63665F]">Logget inn</span>
                </span>
              </div>
            )}

            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <ul className="flex flex-col gap-1">
                {(Auth ? navLinkUse : navLinks).map((link) => {
                  const active = Auth ? location.pathname === link.path : isCurrent(link.path);
                  return (
                    <li key={link.path}>
                      <Link
                        to={link.path}
                        onClick={(e) => {
                          setMenuOpen(false);
                          // Protected destinations bounce anonymous users to /login with
                          // a toast; the drawer must not silently do nothing instead.
                          if (Auth && !user) {
                            e.preventDefault();
                            handleProtectedNavigation(link.path);
                          }
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-[0.9375rem] font-medium transition-colors ${
                          active
                            ? 'bg-white text-[#0B0B0B]! shadow-[0_1px_2px_rgba(11,11,11,0.04)]'
                            : 'text-[#63665F]! hover:bg-white/70 hover:text-[#0B0B0B]!'
                        }`}
                      >
                        {link.icon && (
                          <span
                            className={`relative flex size-9 shrink-0 items-center justify-center rounded-xl ${
                              active ? 'bg-[#EAF1E9] text-[#2E6641]' : 'bg-white text-[#63665F]'
                            }`}
                          >
                            {link.icon}
                            {link.badgeCount !== undefined && link.badgeCount > 0 && (
                              <span className="absolute -right-1 -top-1 flex min-w-4.5 items-center justify-center rounded-full border-2 border-[#EFF0EA] bg-[#2E6641] px-1 text-[0.625rem] font-bold text-white">
                                {link.badgeCount}
                              </span>
                            )}
                          </span>
                        )}
                        <span className="truncate">{link.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex flex-col gap-2.5 border-t border-[#E6E7E1] bg-white px-5 py-5">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/Publish-job');
                }}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#2E6641] px-5 text-[0.9375rem] font-semibold text-white transition hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20"
              >
                <Plus size={18} strokeWidth={2.4} />
                Legg ut oppdrag
              </button>

              {!Auth && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/login');
                  }}
                  className="flex h-12 items-center justify-center rounded-full border border-[#E6E7E1] px-5 text-[0.9375rem] font-medium text-[#0B0B0B] transition hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                >
                  Logg inn
                </button>
              )}

              <p className="mt-1 flex items-center justify-center gap-1.5 text-[0.75rem] font-medium text-[#2E6641]">
                <ShieldCheck size={13} strokeWidth={2.3} />
                Betaling holdes trygt til du har godkjent
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
