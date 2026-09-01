import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Briefcase,
  CalendarClock,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  TrendingUp,
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import { useUserReviews } from '../../../features/profile/hooks';
import { useJobs } from '../../../features/jobsList/hooks';
import { useUserStore } from '../../../stores/userStore';
import { JobCard } from '../../component/jobCard/JobCard.tsx';
import { JobCardSkeleton } from '../../Loading/JobCardSkeleton.tsx';
import type { Jobs } from '../../../types/Jobs.ts';
import type { EditSection } from '../EditProfileSheet';
import { IdentityVerificationCard } from '../IdentityVerificationCard';

/**
 * Everything below the tabs on a profile.
 *
 * The "Om meg" tab used to be three cards of invented data — a fallback skills list that
 * showed "Maling, Snekkering, Hagearbeid, Rengjøring, Flytting" for anyone who had never
 * entered a skill, a Mon/Wed/Fri/Sat availability grid hardcoded in the component with no
 * way to change it, and a rating histogram whose five-star bar was `width: 100%` no matter
 * what the reviews said. A stranger deciding whether to let this person into their home
 * was reading fiction.
 *
 * Now nothing is drawn that the API did not return, the histogram counts real ratings, and
 * the trust card surfaces the four figures `getUserById` already computes and the old page
 * ignored: hire rate, completion rate, repeat customers and applications received.
 */

const CARD = 'rounded-3xl border border-[#E6E7E1] bg-white';
const MICRO = 'text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#9B9E96]';

/** Section shell. `onEdit` renders the owner's affordance in the header, aligned across cards. */
function Panel({
  title,
  icon: Icon,
  onEdit,
  editLabel = 'Rediger',
  children,
}: {
  title: string;
  icon: typeof Star;
  onEdit?: () => void;
  editLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-[#0B0B0B]">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#EAF1E9] text-[#2E6641]">
            <Icon size={14} strokeWidth={2.2} />
          </span>
          {title}
        </h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold text-[#2E6641] transition-colors hover:bg-[#EAF1E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
          >
            <Pencil size={12} strokeWidth={2.4} />
            {editLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** "Ingen X lagt til" — with a shortcut when it is your own profile. */
function Blank({ text, onAdd, addLabel }: { text: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-[0.875rem] text-[#9B9E96]">{text}</p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-[#D4D6CD] px-3 text-[0.8125rem] font-medium text-[#63665F] transition-colors hover:border-[#2E6641] hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
        >
          <Plus size={13} strokeWidth={2.6} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

export function ItemsGrid({
  activeTab,
  user,
  profileType,
  onEdit,
}: {
  activeTab: string;
  user: any;
  profileType?: 'seeker' | 'poster';
  /** Present only on your own profile. Opens the edit sheet on the given section. */
  onEdit?: (section?: EditSection) => void;
}) {
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const currentUser = useUserStore((state) => state.user);
  const isOwner = !!onEdit && user?._id === currentUser?._id;
  const isCompany = user?.role === 'company';

  const { data: fetchedReviews } = useUserReviews(user?._id, profileType);

  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isError: isJobsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobs({ userId: user?._id });

  const isJobsTab = ['Oppdrag', 'Aktive', 'Fullførte', 'Tidligere'].includes(activeTab);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !isJobsTab) return;

    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && fetchNextPage(),
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isJobsTab]);

  const jobs = (jobsData?.pages.flatMap((page) => page.data) || []) as unknown as Jobs[];

  // `getUserById` embeds the reviews; the hook is the fallback for payloads that do not.
  const reviews: any[] = useMemo(() => {
    if (Array.isArray(user?.reviews) && user.reviews.length) return user.reviews;
    return Array.isArray(fetchedReviews) ? fetchedReviews : [];
  }, [user?.reviews, fetchedReviews]);

  /** Real counts per star, so the bars mean something. */
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((review) => {
      const rating = Math.round(Number(review?.rating));
      if (rating >= 1 && rating <= 5) counts[rating - 1] += 1;
    });
    return counts;
  }, [reviews]);

  const reviewCount = reviews.length || user?.reviewCount || 0;
  const skills: string[] = Array.isArray(user?.skills) ? user.skills : [];

  // ── Om meg / Om oss ────────────────────────────────────────────────────────
  if (activeTab === 'Om meg' || activeTab === 'Om oss') {
    const locations: string[] = Array.isArray(user?.locations) ? user.locations : [];

    const trustSignals = [
      typeof user?.hireRate === 'number' && user.hireRate > 0
        ? { label: 'Blir hyret', value: `${user.hireRate} %` }
        : null,
      typeof user?.completionRate === 'number' && user.completionRate > 0
        ? { label: 'Fullfører', value: `${user.completionRate} %` }
        : null,
      user?.repeatCustomersCount
        ? { label: 'Gjengangere', value: String(user.repeatCustomersCount) }
        : null,
      user?.jobsThisMonth ? { label: 'Denne måneden', value: String(user.jobsThisMonth) } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Panel
            title={isCompany ? 'Om oss' : 'Om meg'}
            icon={Briefcase}
            onEdit={isOwner ? () => onEdit?.('bio') : undefined}
          >
            {user?.bio ? (
              <p className="wrap-break-word text-[0.9375rem] leading-relaxed text-[#63665F]">
                {user.bio}
              </p>
            ) : (
              <Blank
                text={isOwner ? 'Du har ikke skrevet noe om deg selv ennå.' : 'Ingen beskrivelse.'}
                onAdd={isOwner ? () => onEdit?.('bio') : undefined}
                addLabel="Skriv en bio"
              />
            )}
          </Panel>

          <Panel
            title={isCompany ? 'Tjenester' : 'Ferdigheter'}
            icon={Award}
            onEdit={isOwner && skills.length > 0 ? () => onEdit?.('skills') : undefined}
          >
            {skills.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <li
                    key={skill}
                    className="inline-flex h-9 items-center rounded-full bg-[#F4F6F0] px-4 text-[0.8125rem] font-medium text-[#0B0B0B]"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <Blank
                text={isOwner ? 'Ingen ferdigheter lagt til.' : 'Ingen ferdigheter oppgitt.'}
                onAdd={isOwner ? () => onEdit?.('skills') : undefined}
                addLabel="Legg til"
              />
            )}
          </Panel>

          {locations.length > 0 && (
            <Panel title="Områder" icon={MapPin}>
              <ul className="flex flex-wrap gap-2">
                {locations.map((location) => (
                  <li
                    key={location}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F4F6F0] px-4 text-[0.8125rem] font-medium text-[#0B0B0B]"
                  >
                    <MapPin size={13} strokeWidth={2} className="text-[#9B9E96]" />
                    {location}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {(user?.availabilityText || isOwner) && (
            <Panel
              title="Tilgjengelighet"
              icon={CalendarClock}
              onEdit={isOwner && user?.availabilityText ? () => onEdit?.('availability') : undefined}
            >
              {user?.availabilityText ? (
                <p className="text-[0.9375rem] leading-relaxed text-[#63665F]">
                  {user.availabilityText}
                </p>
              ) : (
                <Blank
                  text="Fortell når du kan ta oppdrag."
                  onAdd={() => onEdit?.('availability')}
                  addLabel="Legg til"
                />
              )}
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Identity above Vurdering: it is the first thing a stranger deciding whether
              to let this person into their home wants to know, and it is the owner's
              most valuable unfinished action.

              Hidden below lg because the single-column stack puts this whole column
              after "Om meg" — too far down to be discoverable. ProfilePage renders the
              same card high in the mobile flow instead, so exactly one is ever visible. */}
          <IdentityVerificationCard
            user={user}
            isOwnProfile={isOwner}
            className="hidden lg:block"
          />

          <section className={`${CARD} p-5`}>
            <h2 className={MICRO}>Vurdering</h2>
            {reviewCount > 0 ? (
              <>
                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className="text-[2rem] font-bold leading-none tabular-nums tracking-[-0.03em] text-[#0B0B0B]">
                    {Number(user?.averageRating ?? 0).toFixed(1)}
                  </span>
                  <span className="text-[0.8125rem] text-[#63665F]">
                    {reviewCount} {reviewCount === 1 ? 'vurdering' : 'vurderinger'}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = distribution[star - 1];
                    const share = reviewCount ? (count / reviewCount) * 100 : 0;
                    return (
                      <div
                        key={star}
                        className="flex items-center gap-2 text-[0.75rem] tabular-nums text-[#9B9E96]"
                      >
                        <span className="w-2.5 text-right">{star}</span>
                        <Star size={10} className="text-[#9B9E96]" fill="currentColor" />
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0F1EB]">
                          <div
                            className="h-full rounded-full bg-[#2E6641]"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="w-4 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-3 text-[0.875rem] leading-relaxed text-[#9B9E96]">
                Ingen vurderinger ennå.
              </p>
            )}
          </section>

          {trustSignals.length > 0 && (
            <section className={`${CARD} p-5`}>
              <h2 className={MICRO}>Pålitelighet</h2>
              <dl className="mt-3 flex flex-col gap-2.5">
                {trustSignals.map((signal) => (
                  <div key={signal.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[0.875rem] text-[#63665F]">{signal.label}</dt>
                    <dd className="text-[0.9375rem] font-semibold tabular-nums text-[#0B0B0B]">
                      {signal.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {isCompany && (user?.phone || user?.email || user?.website) && (
            <section className={`${CARD} p-5`}>
              <h2 className={MICRO}>Kontakt</h2>
              <div className="mt-3 flex flex-col gap-2.5 text-[0.875rem] text-[#63665F]">
                {user?.phone && (
                  <span className="flex items-center gap-2.5">
                    <Phone size={14} strokeWidth={2} className="shrink-0 text-[#2E6641]" />
                    {user.phone}
                  </span>
                )}
                {user?.email && (
                  <span className="flex items-center gap-2.5">
                    <Mail size={14} strokeWidth={2} className="shrink-0 text-[#2E6641]" />
                    <span className="truncate">{user.email}</span>
                  </span>
                )}
                {user?.website && (
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 font-semibold text-[#2E6641] hover:underline"
                  >
                    <Globe size={14} strokeWidth={2} className="shrink-0" />
                    Besøk nettside
                  </a>
                )}
              </div>
            </section>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => navigate('/settings/safepay')}
              className={`${CARD} p-5 text-left transition-colors hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck size={13} strokeWidth={2.4} className="text-[#2E6641]" />
                <span className={MICRO}>SafePay</span>
              </span>
              <span className="mt-3 block text-[1.5rem] font-bold leading-none tabular-nums tracking-[-0.03em] text-[#0B0B0B]">
                {Number(user?.totalEarned || 0).toLocaleString('nb-NO')} kr
              </span>
              <span className="mt-1.5 block text-[0.8125rem] text-[#63665F]">
                Utbetalt til deg. Se historikken →
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Vurderinger ────────────────────────────────────────────────────────────
  if (activeTab === 'Vurderinger') {
    if (reviews.length === 0) {
      return (
        <EmptyState
          title="Ingen vurderinger ennå"
          description="Vurderinger fra fullførte oppdrag vises her."
          icon={<Star size={26} strokeWidth={1.8} />}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {reviews.map((review: any) => (
          <article key={review._id || review.id} className={`${CARD} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] text-[0.8125rem] font-semibold text-[#2E6641]">
                  {review.reviewerId?.avatarUrl || review.avatar ? (
                    <img
                      src={review.reviewerId?.avatarUrl || review.avatar}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    (review.reviewerId?.name || review.author)?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[0.875rem] font-semibold text-[#0B0B0B]">
                    {review.reviewerId?.name || review.author || 'Bruker'}
                  </h3>
                  <p className="text-[0.75rem] text-[#9B9E96]">
                    {review.createdAt
                      ? new Date(review.createdAt).toLocaleDateString('nb-NO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : review.date}
                  </p>
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#F4F6F0] px-2.5 py-1 text-[0.75rem] font-semibold tabular-nums text-[#0B0B0B]">
                <Star size={11} className="text-[#2E6641]" fill="currentColor" />
                {Number(review.rating || 0).toFixed(1)}
              </span>
            </div>

            {review.comment && (
              <p className="mt-3.5 wrap-break-word text-[0.875rem] leading-relaxed text-[#63665F]">
                {review.comment}
              </p>
            )}

            {review.serviceId?.title && (
              <p className="mt-3.5 border-t border-[#E6E7E1] pt-3 text-[0.75rem] text-[#9B9E96]">
                {review.serviceId.title}
              </p>
            )}
          </article>
        ))}
      </div>
    );
  }

  // ── Oppdrag ────────────────────────────────────────────────────────────────
  if (isJobsTab) {
    if (isJobsLoading) {
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (isJobsError) {
      return (
        <EmptyState
          title="Kunne ikke laste oppdrag"
          description="Noe gikk galt hos oss. Last siden på nytt for å prøve igjen."
          icon={<Briefcase size={26} strokeWidth={1.8} />}
        />
      );
    }

    const displayJobs =
      activeTab === 'Fullførte' || activeTab === 'Tidligere'
        ? jobs.filter((job) => job.status === 'completed' || job.status === 'closed')
        : jobs;

    if (displayJobs.length === 0) {
      const blank: Record<string, { title: string; description: string }> = {
        Aktive: {
          title: 'Ingen aktive oppdrag',
          description: 'Oppdrag som ligger ute akkurat nå vises her.',
        },
        Fullførte: {
          title: 'Ingen fullførte oppdrag',
          description: 'Fullførte oppdrag vises her når de er godkjent.',
        },
        Tidligere: {
          title: 'Ingen tidligere oppdrag',
          description: 'Avsluttede oppdrag vises her.',
        },
      };
      const copy = blank[activeTab] || {
        title: 'Ingen oppdrag ennå',
        description: 'Oppdrag vises her når de er lagt ut.',
      };

      return (
        <EmptyState
          title={copy.title}
          description={copy.description}
          icon={<Briefcase size={26} strokeWidth={1.8} />}
          action={
            isOwner ? (
              <button
                type="button"
                onClick={() => navigate('/publish-job')}
                className="flex h-11 items-center gap-2 rounded-full bg-[#2E6641] px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
              >
                <Plus size={16} strokeWidth={2.6} />
                Legg ut oppdrag
              </button>
            ) : undefined
          }
        />
      );
    }

    return (
      <>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {displayJobs.map((job) => (
            <JobCard key={job._id} job={job} isOwner={isOwner} />
          ))}
        </div>
        {hasNextPage && <div ref={loadMoreRef} className="h-4 w-full" />}
      </>
    );
  }

  return (
    <EmptyState
      title="Ingenting her ennå"
      description="Innholdet i denne fanen vises når det finnes noe å vise."
      icon={<TrendingUp size={26} strokeWidth={1.8} />}
    />
  );
}
