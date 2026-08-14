import { useState, useEffect } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { FileText, LayoutGrid, ShieldCheck, Star } from 'lucide-react';
import { useJobs } from '../../features/jobsList/hooks';
import { useCategories } from '../../features/categories/hooks';
import { useDashboardStats } from '../../features/explore/hooks';
import { useTopUsers } from '../../features/profile/hooks';
import { useUserStore } from '../../stores/userStore';
import { JobCard } from '../../components/component/jobCard/JobCard';
import { SERVICE_SHOWCASE } from '../../assets/images/categories';
import {
  CARD,
  CARD_INTERACTIVE,
  CONTAINER,
  HEADING,
  ICON_PLATE,
  MICRO_LABEL,
  PILL_SECONDARY,
  TEXT_LINK,
} from '../../theme/brand';

/**
 * The signed-in home feed.
 *
 * This page and the landing page had nothing in common but their content: the feed ran on
 * #f5f0e8 / #1a3a1a / #4ade80 / #16a34a / #f0faf0 / #166534 / #ca8a04 and four corner
 * radii, none of which appear in `theme/brand.ts` or on the marketing pages a visitor
 * sees immediately before signing in. It now draws from the same tokens, and its job
 * cards are the shared `JobCard` rather than a fourth inline copy.
 *
 * Two figures were also removed rather than restyled. "5 nye oppdrag i nærheten av Oslo
 * siden i går" was a constant in the markup — no query produced it. The stats tiles fell
 * back to "5 000+", "15k+" and "4.8" whenever the API was slow or errored, so a brand new
 * database advertised fifteen thousand users. Real numbers render when they arrive and
 * the tiles stay out of the way when they do not.
 */

// Helper function to map category icon names to actual icons
const getCategoryIcon = (cat: any) => {
  if (cat.icon) {
    const iconName = typeof cat.icon === 'string' ? cat.icon : String(cat.icon);
    const Icon = (Icons as any)[iconName];
    if (Icon) return Icon;

    const iconMap: Record<string, any> = {
      BrushCleaning: Icons.Brush,
      Flower2: Icons.Sprout,
      Hammer: Icons.Hammer,
      Box: Icons.Package,
      Handshake: Icons.Handshake,
    };
    if (iconMap[iconName]) return iconMap[iconName];
  }

  const lowerName = cat.name.toLowerCase();
  if (
    lowerName.includes('håndverk') ||
    lowerName.includes('håndverker') ||
    lowerName.includes('oppussing')
  )
    return Icons.Wrench;
  if (lowerName.includes('maling')) return Icons.Paintbrush;
  if (lowerName.includes('rengjøring') || lowerName.includes('rense')) return Icons.Home;
  if (lowerName.includes('flytting') || lowerName.includes('flytt')) return Icons.Truck;
  if (lowerName.includes('hage') || lowerName.includes('hagearbeid')) return Icons.Sprout;
  if (lowerName.includes('it') || lowerName.includes('nettverk') || lowerName.includes('pc'))
    return Icons.Laptop;
  if (lowerName.includes('transport')) return Icons.Package;
  if (lowerName.includes('rørlegger')) return Icons.Wrench;
  if (lowerName.includes('småjobber')) return Icons.Handshake;
  return Icons.MoreHorizontal;
};

const TRUST = [
  {
    icon: ShieldCheck,
    title: 'Trygg betaling med SafePay',
    body: 'Pengene holdes sikkert til jobben er godkjent. Du betaler aldri for noe du ikke er fornøyd med.',
  },
  {
    icon: FileText,
    title: 'Automatisk kontrakt',
    body: 'Hver avtale genererer en digital kontrakt som beskytter både deg og oppdragstakeren.',
  },
  {
    icon: Star,
    title: 'Verifiserte ratings',
    body: 'Alle anmeldelser er fra ekte fullførte oppdrag. Du ser alltid hvem du leier inn.',
  },
];

type RecommendedWorker = {
  _id?: string;
  initials: string;
  name: string;
  role: string;
  rating: number;
  count: number;
  rate: string;
  location: string;
  sponsored: boolean;
  avatarUrl?: string;
};

/**
 * What Norway needs help with depends almost entirely on the month.
 *
 * The seasons here are not decorative: pipes freeze between December and February, the
 * garden is dead until April, and the window for painting a house outdoors is roughly
 * June to August. A feed that greets someone with "hagearbeid" in January is written for
 * nowhere in particular. Each season points at one real category and carries the photo
 * already bundled for it, so the greeting band changes four times a year on its own.
 *
 * `category` is checked against the live category list before it is offered — if a
 * category is renamed or removed in the backend, the suggestion quietly disappears
 * rather than linking into an empty listing.
 */
const SEASONS = [
  {
    months: [11, 0, 1],
    label: 'Vinter',
    line: 'Frosne rør, snø på oppkjørselen eller storrengjøring før jul?',
    category: 'Rørlegger',
  },
  {
    months: [2, 3, 4],
    label: 'Vår',
    line: 'Hagen våkner, og vinduene har hatt en lang vinter.',
    category: 'Hagearbeid',
  },
  {
    months: [5, 6, 7],
    label: 'Sommer',
    line: 'Lyse kvelder — den korte sesongen for maling og arbeid ute.',
    category: 'Maling',
  },
  {
    months: [8, 9, 10],
    label: 'Høst',
    line: 'Mørkere kvelder. Tid for å ta tak innendørs.',
    category: 'Rengjøring',
  },
];

const currentSeason = () => {
  const month = new Date().getMonth();
  const season = SEASONS.find((s) => s.months.includes(month)) ?? SEASONS[0];
  // The photo comes from the showcase the hero already uses, so the two never drift.
  return { ...season, photo: SERVICE_SHOWCASE.find((s) => s.name === season.category)?.src };
};

/** Section headers all sit on the same rhythm, so the page reads as one column. */
function SectionHead({
  eyebrow,
  title,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className={MICRO_LABEL}>{eyebrow}</p>
        <h2 className={`mt-3 ${HEADING} text-[1.5rem]! sm:text-[1.875rem]!`}>{title}</h2>
      </div>
      <button type="button" onClick={onAction} className={`text-[0.875rem] ${TEXT_LINK}`}>
        {actionLabel}
      </button>
    </div>
  );
}

export default function JobListingPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const navigate = useNavigate();
  const { user } = useUserStore();

  const handleNearbyJobsClick = () => {
    // Try to get user's location and show jobs near it
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // We have location, pass it to the search page
          navigate('/search/job/all', {
            state: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          });
        },
        () => {
          // If geolocation fails, just go to all jobs
          navigate('/search/job/all');
        }
      );
    } else {
      // If geolocation not available, just go to all jobs
      navigate('/search/job/all');
    }
  };

  const initialState = location.state as {
    selectedCategory?: string;
    searchQuery?: string;
  } | null;

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialState?.selectedCategory ? [initialState.selectedCategory] : []
  );
  const [searchQuery] = useState<string>(initialState?.searchQuery || '');
  const [isUrgentOnly] = useState<boolean>(false);

  useEffect(() => {
    if (categoryFromUrl) {
      setSelectedCategories([categoryFromUrl]);
    } else if (initialState?.selectedCategory) {
      setSelectedCategories([initialState.selectedCategory]);
    }
  }, [categoryFromUrl, initialState?.selectedCategory]);

  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const {
    data: jobsData,
    isLoading: jobsLoading,
    isError: jobsError,
  } = useJobs({
    categories: selectedCategories,
    search: searchQuery,
    urgent: isUrgentOnly,
    tab: 'Discover',
  });
  const { data: categoriesData } = useCategories();
  const { data: statsData } = useDashboardStats();
  const { data: topUsersData } = useTopUsers(1, 10, {
    postNumber: user?.postNumber,
    postSted: user?.postSted,
    address: user?.address,
  });

  const jobs = jobsData?.pages.flatMap((page) => page.data) || [];
  // Defensive deduplication: if the backend/API ever returns a synthetic "Alle"
  // category (e.g. a "view-all" placeholder), we filter it out so we don't end up
  // with two "Alle" pills. Matches case-insensitively on name and common aliases.
  const ALL_ALIASES = new Set(['alle', 'all', 'alle kategorier', 'all categories', 'ingen']);
  const categories = (categoriesData || []).filter(
    (cat: any) =>
      !ALL_ALIASES.has(
        String(cat?.name || '')
          .toLowerCase()
          .trim()
      )
  );

  const getInitials = (name: string, lastName?: string) => {
    return `${name.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();
  };

  // `topUsersData.data` widens to any[], so the callback params need stating explicitly
  // for `noImplicitAny`; `RecommendedWorker` then carries real types downstream.
  const recommendedWorkers: RecommendedWorker[] =
    (topUsersData?.data ?? []).slice(0, 4).map((user: any, index: number) => ({
      _id: (user as any)._id,
      initials: getInitials(user.name, user.lastName),
      name: `${user.name} ${user.lastName || ''}`,
      role: user.skills?.slice(0, 3).join(' · ') || 'Oppdragstaker',
      rating: user.averageRating,
      count: user.reviewCount,
      rate: user.hourlyRate ? `${user.hourlyRate} kr/t` : 'Tilgjengelig',
      location: (user as any).postSted || user.locations?.[0] || 'Norge',
      sponsored: index === 0,
      avatarUrl: user.avatarUrl,
    })) || [];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'God morgen';
    if (hour >= 12 && hour < 18) return 'God ettermiddag';
    return 'God kveld';
  };

  const userName = user?.name || 'der';
  const greeting = getGreeting();
  const season = currentSeason();

  // The user's own registered place, not a hardcoded "Oslo" — the feed said "Oppdrag nær
  // deg – Oslo" to everyone in the country, including people in Tromsø.
  const placeLabel = user?.postSted || 'Norge';

  // Suggest the season's category only while the backend still has one by that name.
  const seasonalCategory = categories.find(
    (cat: any) => cat.name?.toLowerCase() === season.category.toLowerCase()
  )?.name;

  // Only the figures the API actually returned. A tile with nothing behind it is left out
  // rather than filled with a plausible-looking number.
  const stats = [
    { value: statsData?.activeJobs, label: 'Aktive oppdrag' },
    { value: statsData?.totalUsers, label: 'Brukere' },
    {
      value: statsData?.averageRating ? statsData.averageRating.toFixed(1) : undefined,
      label: 'Snittrating',
    },
  ].filter((stat) => stat.value !== undefined && stat.value !== null);

  return (
    <div className="bg-[#EFF0EA]">
      <div className={`${CONTAINER} py-6 sm:py-10`}>
        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-[#2E6641]">
          {/* The season's own photograph, bled in from the right behind a gradient so
              the type stays on flat colour and the picture only warms the edge. */}
          {season.photo && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-2/3"
            >
              <img src={season.photo} alt="" className="size-full object-cover opacity-25" />
              <div className="absolute inset-0 bg-linear-to-r from-[#2E6641] via-[#2E6641]/85 to-[#2E6641]/45" />
            </div>
          )}

          <div className="relative flex flex-col justify-between gap-8 px-6 py-8 sm:px-10 sm:py-11 md:flex-row md:items-end">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#8FBF9A]">
                {season.label} · {placeLabel}
              </p>
              <h1 className="mt-4 text-[1.625rem] font-bold leading-[1.1] tracking-[-0.04em] text-white sm:text-[2.25rem]">
                {greeting}, {userName}.
                <span className="block text-[#8FBF9A]">Hva trenger du hjelp med i dag?</span>
              </h1>
              <p className="mt-3 max-w-[42ch] text-[0.9375rem] leading-relaxed text-white/70">
                {season.line}
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleNearbyJobsClick}
                  className="inline-flex h-12 items-center rounded-full bg-white px-5 text-[0.9375rem] font-semibold text-[#0B0B0B] transition-colors hover:bg-[#EFF0EA] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                >
                  Oppdrag nær meg
                </button>
                {/* Only offered when the backend still has that category. */}
                {seasonalCategory && (
                  <button
                    type="button"
                    onClick={() => navigate(`/search/job/${encodeURIComponent(seasonalCategory)}`)}
                    className="inline-flex h-12 items-center rounded-full border border-white/40 px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                  >
                    {seasonalCategory}
                  </button>
                )}
              </div>
            </div>

            {stats.length > 0 && (
              <dl className="flex shrink-0 gap-8 border-t border-white/20 pt-6 md:border-0 md:pt-0">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dd className="text-[1.5rem] font-bold tabular-nums tracking-[-0.03em] text-white">
                      {stat.value}
                    </dd>
                    <dt className="mt-1 text-[0.75rem] text-white/65">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {/* ── Categories ────────────────────────────────────────────────────── */}
        <div className="mt-14">
          <SectionHead
            eyebrow="01 — Kategorier"
            title="Hva trenger du hjelp til?"
            actionLabel="Se alle"
            onAction={() => navigate('/search/job/all')}
          />

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[{ _id: 'all', name: 'Alle', icon: null } as any, ...categories].map((cat) => {
              const isAll = cat._id === 'all';
              const Icon = isAll ? LayoutGrid : getCategoryIcon(cat);
              const isSelected = isAll
                ? selectedCategories.length === 0
                : selectedCategories.includes(cat.name);

              return (
                <button
                  key={cat._id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (isAll) {
                      // Clear category state AND remove the ?category= query param.
                      // All other query params (search, sort, etc.) are preserved.
                      setSelectedCategories([]);
                      if (searchParams.has('category')) {
                        const next = new URLSearchParams(
                          Array.from(searchParams.entries()).filter(([k]) => k !== 'category')
                        );
                        setSearchParams(next, { replace: true });
                      }
                      return;
                    }
                    setSelectedCategories([cat.name]);
                    // Persist the selection into the ?category= query param so a
                    // browser refresh keeps the same category active. Preserve
                    // every other existing param.
                    const next = new URLSearchParams(searchParams);
                    next.set('category', cat.name);
                    setSearchParams(next, { replace: false });
                  }}
                  className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                    isSelected
                      ? 'border-[#2E6641] bg-[#EAF1E9]'
                      : 'border-[#E6E7E1] bg-white hover:border-[#2E6641]/45'
                  }`}
                >
                  <Icon size={22} strokeWidth={1.8} className="text-[#2E6641]" />
                  <span className="line-clamp-2 text-[0.75rem] font-medium text-[#0B0B0B]">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Jobs ──────────────────────────────────────────────────────────── */}
        <div className="mt-14">
          <SectionHead
            eyebrow="02 — Ute nå"
            title={`Oppdrag nær deg — ${placeLabel}`}
            actionLabel="Se alle oppdrag"
            onAction={() => navigate('/search/job/all')}
          />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {jobsLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className={`${CARD} p-4`}>
                  <div className="h-45 animate-pulse rounded-2xl bg-[#F0F1EB]" />
                  <div className="mt-5 space-y-2.5 px-1">
                    <div className="h-5 w-3/4 animate-pulse rounded bg-[#F0F1EB]" />
                    <div className="h-3.5 w-1/2 animate-pulse rounded bg-[#F0F1EB]" />
                  </div>
                </div>
              ))
            ) : jobs.length > 0 ? (
              jobs
                .slice(0, 6)
                .map((job: any) => <JobCard key={job._id} job={job} showDescription />)
            ) : (
              // Previously `null` for both failure and genuinely-empty, so a failed fetch
              // on the main browse page looked identical to "there are no jobs".
              <div className={`${CARD} col-span-full p-10 text-center`}>
                <p className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                  {jobsError ? 'Kunne ikke laste oppdrag' : 'Ingen oppdrag å vise akkurat nå'}
                </p>
                <p className="mt-1.5 text-[0.875rem] text-[#63665F]">
                  {jobsError
                    ? 'Sjekk internettforbindelsen din og prøv igjen.'
                    : 'Prøv en annen kategori, eller legg ut ditt eget oppdrag.'}
                </p>
                {!jobsError && (
                  <button
                    type="button"
                    onClick={() => navigate('/Publish-job')}
                    className={`mt-6 ${PILL_SECONDARY}`}
                  >
                    Legg ut oppdrag
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Recommended workers ───────────────────────────────────────────── */}
        {recommendedWorkers.length > 0 && (
          <div className="mt-14">
            <SectionHead
              eyebrow="03 — I nærheten"
              title="Anbefalte oppdragstakere"
              actionLabel="Se alle"
              onAction={() => navigate('/oppdragstakere')}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              {recommendedWorkers.map((worker, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if ((worker as any)._id) navigate(`/profile/${(worker as any)._id}`);
                  }}
                  className={`${CARD_INTERACTIVE} flex cursor-pointer gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15`}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] text-[0.9375rem] font-semibold text-[#2E6641]">
                    {worker.avatarUrl ? (
                      <img
                        src={worker.avatarUrl}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      worker.initials
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[0.9375rem] font-semibold text-[#0B0B0B]">
                        {worker.name}
                      </span>
                      {worker.sponsored && (
                        <span className="shrink-0 rounded-full bg-[#F4F6F0] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#63665F]">
                          Sponset
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-[0.8125rem] text-[#63665F]">{worker.role}</p>

                    {/* Was a string of ★/☆ characters, which read as literal text to a
                        screen reader and rendered in whatever the system font had. */}
                    {worker.rating > 0 && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] text-[#63665F]">
                        <Star
                          size={13}
                          strokeWidth={2.2}
                          className="fill-[#2E6641] text-[#2E6641]"
                        />
                        <span className="font-semibold tabular-nums text-[#0B0B0B]">
                          {worker.rating.toFixed(1)}
                        </span>
                        ({worker.count} oppdrag)
                      </p>
                    )}

                    <p className="mt-1.5 truncate text-[0.8125rem] text-[#0B0B0B]">
                      {worker.rate} · {worker.location}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Trust ─────────────────────────────────────────────────────────── */}
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <div key={title} className={`${CARD} p-6`}>
              <span className={ICON_PLATE} aria-hidden="true">
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <h3 className="mt-4 text-[0.9375rem] font-semibold text-[#0B0B0B]">{title}</h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-[#63665F]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
