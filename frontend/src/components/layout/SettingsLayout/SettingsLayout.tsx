import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AtSign,
  Ban,
  Banknote,
  Bell,
  Briefcase,
  ChevronRight,
  Cookie,
  CreditCard,
  EyeOff,
  Image,
  Info,
  MapPin,
  Monitor,
  PenLine,
  Phone,
  Search,
  Sparkles,
  Trash2,
  User,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useUserStore } from '../../../stores/userStore';
import { CONTAINER, MICRO_LABEL } from '../../../theme/brand';

/**
 * The frame around every settings screen.
 *
 * It ran on `#F6F1E8` with grey-100 rows and a `text-rose-600` active state that appeared
 * on mobile only — pink, in an app with no pink, marking the current page on one breakpoint
 * and not the other. The header carried two back buttons stacked side by side (one in the
 * sidebar column, one in the title column, both visible on desktop, going to different
 * places), and the twenty-one destinations were grouped so that SafePay and Utbetalinger
 * sat under "Personlig informasjon" while "Jobblo medlemskap" sat under "ANNET".
 *
 * The grouping is the substantive change: five headings that describe what is under them,
 * with money in one place. The rest is the app's own palette and one back button.
 *
 * Note the profile group is now a *second* way to reach these fields — navn, bio and bilde
 * are editable in place on `/profile` through the edit sheet, which is the path most people
 * should take. These stay because deep links to them exist and because a full page is the
 * better surface for the ones with real forms.
 */

interface SettingsLink {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Destructive rows read differently so they are never clicked by momentum. */
  danger?: boolean;
}

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const [showSidebar, setShowSidebar] = useState(true);

  const currentPath = location.pathname;
  const isRoot = currentPath === '/settings';

  // On phones the sidebar *is* the index page: it fills the screen at /settings and gives
  // way to the chosen view. On desktop both are always visible.
  useEffect(() => {
    const update = () => setShowSidebar(window.innerWidth >= 768 ? true : isRoot);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isRoot]);

  const groups: { title: string; links: SettingsLink[] }[] = [
    {
      title: 'Profil',
      links: [
        { name: 'Brukernavn', path: '/settings', icon: AtSign },
        { name: 'Navn', path: '/settings/name', icon: User },
        { name: 'Bio', path: '/settings/bio', icon: PenLine },
        { name: 'Profilbilde', path: '/settings/picture', icon: Image },
        ...(user?.role === 'company'
          ? [{ name: 'Banner', path: '/settings/banner', icon: Image }]
          : []),
        { name: 'Jobbsøker-profil', path: '/settings/seeker', icon: Briefcase },
      ],
    },
    {
      title: 'Konto',
      links: [
        { name: 'E-postadresse', path: '/settings/email', icon: AtSign },
        { name: 'Telefonnummer', path: '/settings/phone', icon: Phone },
        { name: 'Mine adresser', path: '/settings/addresses', icon: MapPin },
        { name: 'Endre passord', path: '/settings/password', icon: ShieldCheck },
        { name: 'Aktive økter', path: '/settings/sessions', icon: Monitor },
      ],
    },
    {
      title: 'Betaling',
      links: [
        { name: 'SafePay-historikk', path: '/settings/safepay', icon: ShieldCheck },
        { name: 'Utbetalinger', path: '/settings/payout', icon: Banknote },
        { name: 'Abonnementer', path: '/settings/subscriptions', icon: CreditCard },
        { name: 'Medlemskap', path: '/membership', icon: Sparkles },
      ],
    },
    {
      title: 'Personvern',
      links: [
        { name: 'Varsler', path: '/settings/notifications', icon: Bell },
        { name: 'Søkemotorsynlighet', path: '/settings/visibility', icon: Search },
        { name: 'Blokkerte brukere', path: '/settings/blocked', icon: Ban },
        { name: 'Informasjonskapsler', path: '/settings/cookies', icon: Cookie },
      ],
    },
    {
      title: 'Annet',
      links: [
        { name: 'Lokasjon', path: '/settings/location', icon: MapPin },
        { name: 'Kommende', path: '/settings/upcoming', icon: EyeOff },
        { name: 'Om Jobblo', path: '/settings/about', icon: Info },
        { name: 'Slett profilen min', path: '/settings/delete-account', icon: Trash2, danger: true },
      ],
    },
  ];

  const allLinks = groups.flatMap((group) => group.links);
  let activeTitle = allLinks.find((link) => link.path === currentPath)?.name || 'Innstillinger';
  const blockedCount = user?.blockedUsers?.length || 0;
  if (currentPath === '/settings/blocked' && blockedCount > 0) {
    activeTitle = `Blokkerte brukere (${blockedCount})`;
  }

  return (
    <div className="min-h-screen bg-[#EFF0EA] pb-16">
      <div className={CONTAINER}>
        <div className="pt-6 sm:pt-8">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="inline-flex h-9 items-center gap-1.5 rounded-full pr-3 text-[0.875rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            Til profilen
          </button>

          <h1 className="mt-2 text-[1.75rem] font-bold tracking-[-0.035em] text-[#0B0B0B] sm:text-[2rem]">
            Innstillinger
          </h1>
          <p className="mt-1 text-[0.9375rem] text-[#63665F]">
            Konto, betaling og personvern. Navn, bio og bilde kan du endre direkte på profilen.
          </p>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[17.5rem_1fr]">
          {/* Nav. Sticky under the app header (h-18) on desktop; the whole page on phones. */}
          <aside
            className={`${showSidebar ? 'block' : 'hidden'} md:block lg:sticky lg:top-22 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-4`}
          >
            <nav className="flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.title}>
                  <h2 className={`${MICRO_LABEL} px-3`}>{group.title}</h2>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {group.links.map((link) => {
                      const isActive = currentPath === link.path;
                      const Icon = link.icon;
                      return (
                        <li key={link.path}>
                          <button
                            type="button"
                            onClick={() => navigate(link.path)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[0.875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                              isActive
                                ? 'bg-white text-[#0B0B0B] shadow-[0_2px_8px_rgba(11,11,11,0.05)]'
                                : link.danger
                                  ? 'text-[#B4544A] hover:bg-[#FBF4F2]'
                                  : 'text-[#63665F] hover:bg-white/70 hover:text-[#0B0B0B]'
                            }`}
                          >
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                                isActive
                                  ? 'bg-[#EAF1E9] text-[#2E6641]'
                                  : link.danger
                                    ? 'bg-[#FBF4F2] text-[#B4544A]'
                                    : 'bg-white text-[#9B9E96]'
                              }`}
                            >
                              <Icon size={15} strokeWidth={2} />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{link.name}</span>
                            {link.path === '/settings/blocked' && blockedCount > 0 && (
                              <span className="shrink-0 rounded-full bg-[#F0F1EB] px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-[#63665F]">
                                {blockedCount}
                              </span>
                            )}
                            <ChevronRight
                              size={15}
                              strokeWidth={2.2}
                              className="shrink-0 text-[#C9CCC2] md:hidden"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* The view itself. */}
          <main className={`${showSidebar ? 'hidden md:block' : 'block'} min-w-0`}>
            <div className="rounded-3xl border border-[#E6E7E1] bg-white">
              <div className="flex items-center gap-3 border-b border-[#E6E7E1] px-5 py-4 sm:px-7 sm:py-5">
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  aria-label="Tilbake til innstillinger"
                  className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-[#63665F] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 md:hidden"
                >
                  <ArrowLeft size={18} strokeWidth={2.2} />
                </button>
                <h2 className="min-w-0 truncate text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                  {activeTitle}
                </h2>
              </div>

              <div className="p-5 sm:p-7">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
