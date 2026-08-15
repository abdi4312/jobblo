import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Users,
  Search,
  ClipboardList,
  MessageCircle,
  FileText,
  Eye,
  ArrowRight,
  X,
  AlertCircle,
  CheckCircle2,
  Play,
  MapPin,
  Briefcase,
} from 'lucide-react';
import {
  useMyApplicantsOverviewQuery,
  useMyApplicationsOverviewQuery,
  useWithdrawApplicationMutation,
} from '../../features/applicants/hooks';
import { ContractViewModal } from '../../components/SafePay/ContractViewModal';
import { toast } from 'react-hot-toast';
import { CARD, CARD_INTERACTIVE, MICRO_LABEL, PILL_PRIMARY } from '../../theme/brand';

/**
 * Søkeroversikt — both sides of an application in one place.
 *
 * Tab one is the job owner's: their own postings, how many people applied, who they picked.
 * Tab two is the worker's: everything they applied to and what it is waiting on.
 *
 * The page used to run on a palette of its own — amber, blue, indigo, purple, red and
 * green badges, eleven background tints across three components — so a status meant
 * nothing until you read it. There are four tones now, and they mean the same thing on
 * every card: quiet grey is "nothing to do", green is "moving", the dark pill is "you are
 * the one holding this up", and a hairline outline is "closed". Everything else is ink on
 * paper.
 */

// ── Status vocabulary ──────────────────────────────────────────────────────────
type Tone = 'quiet' | 'moving' | 'action' | 'closed';

const TONE: Record<Tone, string> = {
  quiet: 'bg-[#F4F6F0] text-[#63665F]',
  moving: 'bg-[#EAF1E9] text-[#2E6641]',
  action: 'bg-[#122A1C] text-white',
  closed: 'border border-[#E6E7E1] bg-white text-[#9B9E96]',
};

const BADGE =
  'inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.6875rem] font-semibold';

const Badge = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <span className={`${BADGE} ${TONE[tone]}`}>{children}</span>
);

const SERVICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Aktiv', tone: 'moving' },
  in_progress: { label: 'I gang', tone: 'moving' },
  awaiting_payment: { label: 'Venter på betaling', tone: 'action' },
  waiting_for_approval: { label: 'Venter godkjenning', tone: 'action' },
  completed: { label: 'Fullført', tone: 'closed' },
  cancelled: { label: 'Kansellert', tone: 'closed' },
  closed: { label: 'Lukket', tone: 'closed' },
};

/**
 * Order states, read from the *worker's* seat — which is whose screen this is on tab two.
 * "Venter på betaling" is the customer's move, so it is quiet here; "Betalt" is the
 * worker's move, so it is the dark pill.
 */
const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  awaiting_payment: { label: 'Venter på betaling', tone: 'quiet' },
  paid: { label: 'Klar til å starte', tone: 'action' },
  in_progress: { label: 'Under arbeid', tone: 'moving' },
  ready_for_review: { label: 'Til godkjenning', tone: 'quiet' },
  completed: { label: 'Fullført', tone: 'closed' },
  disputed: { label: 'Tvist', tone: 'action' },
  refunded: { label: 'Refundert', tone: 'closed' },
  cancelled: { label: 'Kansellert', tone: 'closed' },
};

const APP_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Venter på svar', tone: 'quiet' },
  accepted: { label: 'Du ble valgt', tone: 'moving' },
  declined: { label: 'Avslått', tone: 'closed' },
};

const dateShort = (value?: string) =>
  value ? new Date(value).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '';

const dateLong = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('nb-NO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

const kr = (value?: number) =>
  typeof value === 'number' ? `${value.toLocaleString('nb-NO')} kr` : null;

// ── Small pieces ───────────────────────────────────────────────────────────────
const Avatar = ({
  src,
  name,
  size = 'sm',
}: {
  src?: string;
  name?: string;
  size?: 'sm' | 'md';
}) => {
  const dim = size === 'md' ? 'size-8 text-[0.75rem]' : 'size-6 text-[0.625rem]';
  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] font-semibold text-[#2E6641]`}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        (name?.[0] || '?').toUpperCase()
      )}
    </span>
  );
};

/**
 * The five stages of a job, as a rail.
 *
 * It was five numbered circles with the label under each, which at 9 px collided on a
 * phone. It is one line now: a filled bar for what is done, and the current stage named
 * once beneath it.
 */
function FlowRail({ app }: { app: any }) {
  const steps = [
    { key: 'applied', label: 'Søkt', done: true },
    { key: 'selected', label: 'Valgt', done: app.status === 'accepted' || !!app.order },
    { key: 'paid', label: 'Betalt', done: app.order?.paymentStatus === 'paid' },
    {
      key: 'working',
      label: 'Under arbeid',
      done: ['in_progress', 'ready_for_review', 'completed'].includes(app.order?.status),
    },
    { key: 'done', label: 'Fullført', done: app.order?.status === 'completed' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const current = steps[Math.min(doneCount, steps.length - 1)];

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1" aria-hidden="true">
        {steps.map((step) => (
          <span
            key={step.key}
            className={`h-1 flex-1 rounded-full transition-colors ${
              step.done ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-[0.75rem] text-[#63665F]">
        <span className="font-semibold text-[#0B0B0B]">
          Steg {Math.min(doneCount, steps.length)} av {steps.length}
        </span>
        {' · '}
        {doneCount === steps.length ? 'Fullført' : current.label}
      </p>
    </div>
  );
}

const RowSkeleton = () => (
  <div className={`${CARD} flex items-center gap-4 p-5`}>
    <div className="jb-skeleton size-11 shrink-0 rounded-xl" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="jb-skeleton h-3 w-24 rounded" />
      <div className="jb-skeleton h-4 w-2/3 rounded" />
      <div className="jb-skeleton h-3 w-1/3 rounded" />
    </div>
    <div className="jb-skeleton hidden h-4 w-20 rounded sm:block" />
  </div>
);

const Notice = ({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className={`${CARD} p-12 text-center`}>
    <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
      {icon}
    </span>
    <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">{title}</p>
    <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">{body}</p>
    {actionLabel && onAction && (
      <button onClick={onAction} className={`${PILL_PRIMARY} mt-6`}>
        {actionLabel}
      </button>
    )}
  </div>
);

const ACTION_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E6E7E1] bg-white px-3.5 text-[0.8125rem] font-medium text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15';

const ACTION_PRIMARY =
  'inline-flex h-9 items-center gap-1.5 rounded-full bg-[#2E6641] px-4 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-[0.98]';

// ── Main component ─────────────────────────────────────────────────────────────
const MyApplicantsOverview: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'mine-sokere' | 'mine-soknader'>('mine-sokere');
  const [searchQuery, setSearchQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');

  // ── Tab 1 data ───────────────────────────────────────────────────────────────
  const {
    data: services,
    isLoading: servicesLoading,
    isError: servicesError,
    refetch: refetchServices,
  } = useMyApplicantsOverviewQuery();

  const filteredServices = useMemo(() => {
    if (!services) return [];
    let list = [...services];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title?.toLowerCase().includes(q) ||
          s.selectedWorker?.name?.toLowerCase().includes(q) ||
          s.categories?.some((c: string) => c.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [services, searchQuery]);

  // ── Tab 2 data ───────────────────────────────────────────────────────────────
  const {
    data: appData,
    isLoading: appsLoading,
    isError: appsError,
    refetch: refetchApps,
  } = useMyApplicationsOverviewQuery(appStatusFilter || undefined);
  const withdrawMutation = useWithdrawApplicationMutation();

  const applications = appData?.applications || [];

  const filteredApps = useMemo(() => {
    if (!searchQuery) return applications;
    const q = searchQuery.toLowerCase();
    return applications.filter(
      (a: any) =>
        a.service?.title?.toLowerCase().includes(q) ||
        a.service?.customer?.name?.toLowerCase().includes(q)
    );
  }, [applications, searchQuery]);

  const onOwnerTab = activeTab === 'mine-sokere';
  const isLoading = onOwnerTab ? servicesLoading : appsLoading;
  const isError = onOwnerTab ? servicesError : appsError;

  // Waiting on the owner: postings with applicants but nobody chosen yet.
  const needsAttention = useMemo(
    () => (services || []).filter((s: any) => s.applicantCount > 0 && !s.selectedWorker).length,
    [services]
  );

  const totalApplicants = useMemo(
    () => (services || []).reduce((sum: number, s: any) => sum + (s.applicantCount || 0), 0),
    [services]
  );

  const TABS = [
    {
      key: 'mine-sokere' as const,
      label: 'Mine søkere',
      icon: <Users size={15} strokeWidth={2} />,
      count: services?.length,
    },
    {
      key: 'mine-soknader' as const,
      label: 'Mine søknader',
      icon: <ClipboardList size={15} strokeWidth={2} />,
      count: appData?.pagination?.total,
    },
  ];

  return (
    <div className="min-h-screen bg-[#EFF0EA]">
      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="mb-7">
          <p className={MICRO_LABEL}>Oversikt</p>
          <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
            Søkere og søknader
          </h1>
          <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-[#63665F]">
            Oppdragene du har lagt ut, og oppdragene du selv har søkt på — samlet på ett sted.
          </p>

          {/* One line of numbers, only when there is something to count. */}
          {!servicesLoading && !servicesError && (services?.length || 0) > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.875rem]">
              <span className="text-[#63665F]">
                <span className="font-semibold tabular-nums text-[#0B0B0B]">{totalApplicants}</span>{' '}
                søkere totalt
              </span>
              {needsAttention > 0 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#2E6641]">
                  <span className="size-1.5 rounded-full bg-[#2E6641]" />
                  {needsAttention} venter på at du velger utfører
                </span>
              )}
            </div>
          )}
        </header>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Søkere og søknader"
          className="mb-5 flex w-fit gap-1 rounded-full border border-[#E6E7E1] bg-white p-1"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`flex h-10 items-center gap-2 rounded-full px-4 text-[0.875rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                  active ? 'bg-[#2E6641] text-white' : 'text-[#63665F] hover:text-[#0B0B0B]'
                }`}
              >
                {tab.icon}
                <span className="hidden min-[420px]:inline">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[0.6875rem] font-bold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-[#F4F6F0] text-[#63665F]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Search + status filter ───────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-50 flex-1">
            <Search
              size={16}
              strokeWidth={2.2}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9B9E96]"
            />
            <input
              type="search"
              aria-label="Søk"
              placeholder={
                onOwnerTab ? 'Søk i dine oppdrag' : 'Søk etter oppdrag eller oppdragsgiver'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-full border border-[#E6E7E1] bg-white pl-11 pr-4 text-[0.9375rem] text-[#0B0B0B] outline-none transition-colors placeholder:text-[#9B9E96] focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10 [&::-webkit-search-cancel-button]:appearance-none"
            />
          </div>

          {/* Status filter — only for Mine søknader tab */}
          {!onOwnerTab && (
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: '', label: 'Alle' },
                { value: 'pending', label: 'Venter' },
                { value: 'accepted', label: 'Valgt' },
                { value: 'declined', label: 'Avslått' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setAppStatusFilter(f.value)}
                  className={`h-9 rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                    appStatusFilter === f.value
                      ? 'border-[#2E6641] bg-[#2E6641] text-white'
                      : 'border-[#E6E7E1] bg-white text-[#63665F] hover:border-[#2E6641]/45 hover:text-[#2E6641]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── States ───────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          // Previously a failed request rendered the same empty state as "you have
          // nothing" — so an outage read as an empty account.
          <Notice
            icon={<AlertCircle size={20} strokeWidth={2} />}
            title="Kunne ikke laste"
            body="Vi fikk ikke kontakt med serveren. Sjekk internettforbindelsen din og prøv igjen."
            actionLabel="Prøv igjen"
            onAction={() => (onOwnerTab ? refetchServices() : refetchApps())}
          />
        ) : onOwnerTab ? (
          /* ══ TAB 1 — Mine søkere (job owner) ═══════════════════════════════ */
          <div className="space-y-3">
            {filteredServices.length === 0 ? (
              <Notice
                icon={<Users size={20} strokeWidth={2} />}
                title={searchQuery ? 'Ingen treff' : 'Ingen søkere ennå'}
                body={
                  searchQuery
                    ? 'Prøv et annet søkeord.'
                    : 'Når noen søker på et av oppdragene dine, dukker det opp her.'
                }
                actionLabel={searchQuery ? undefined : 'Legg ut et oppdrag'}
                onAction={searchQuery ? undefined : () => navigate('/Publish-job')}
              />
            ) : (
              filteredServices.map((service: any) => {
                const status = SERVICE_STATUS[service.status] || {
                  label: service.status,
                  tone: 'quiet' as Tone,
                };
                const awaitingChoice = service.applicantCount > 0 && !service.selectedWorker;

                return (
                  <article
                    key={service._id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/job-applicants/${service._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/job-applicants/${service._id}`);
                      }
                    }}
                    className={`${CARD_INTERACTIVE} group cursor-pointer p-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9] text-[#2E6641]">
                        <Briefcase size={18} strokeWidth={2} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {awaitingChoice && <Badge tone="action">Velg utfører</Badge>}
                        </div>

                        <h3 className="line-clamp-1 text-[1rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                          {service.title}
                        </h3>

                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-[#63665F]">
                          <span>{dateLong(service.createdAt)}</span>
                          {service.location?.city && (
                            <>
                              <span aria-hidden="true" className="text-[#9B9E96]">
                                ·
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} strokeWidth={2} className="text-[#9B9E96]" />
                                {service.location.city}
                              </span>
                            </>
                          )}
                          {kr(service.price) && (
                            <>
                              <span aria-hidden="true" className="text-[#9B9E96]">
                                ·
                              </span>
                              <span className="font-semibold tabular-nums text-[#0B0B0B]">
                                {kr(service.price)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="mb-1 flex justify-end -space-x-1.5">
                            {service.applicantAvatars?.slice(0, 3).map((avatar: string, i: number) => (
                              <img
                                key={i}
                                src={avatar}
                                alt=""
                                loading="lazy"
                                className="size-6 rounded-full border-2 border-white object-cover"
                              />
                            ))}
                          </div>
                          <span className="whitespace-nowrap text-[0.75rem] text-[#63665F]">
                            <span className="font-semibold tabular-nums text-[#0B0B0B]">
                              {service.applicantCount}
                            </span>{' '}
                            {service.applicantCount === 1 ? 'søker' : 'søkere'}
                          </span>
                        </div>
                        <ChevronRight
                          size={18}
                          className="text-[#9B9E96] transition-colors group-hover:text-[#2E6641]"
                        />
                      </div>
                    </div>

                    {service.selectedWorker && (
                      <div className="mt-4 flex items-center gap-2 border-t border-[#E6E7E1] pt-3.5">
                        <Avatar
                          src={service.selectedWorker.avatarUrl}
                          name={service.selectedWorker.name}
                        />
                        <p className="text-[0.8125rem] text-[#63665F]">
                          Valgt utfører:{' '}
                          <span className="font-semibold text-[#0B0B0B]">
                            {service.selectedWorker.name}
                          </span>
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        ) : (
          /* ══ TAB 2 — Mine søknader (applicant) ═════════════════════════════ */
          <div className="space-y-3">
            {filteredApps.length === 0 ? (
              <Notice
                icon={<ClipboardList size={20} strokeWidth={2} />}
                title={
                  searchQuery || appStatusFilter ? 'Ingen treff' : 'Du har ikke søkt på noe ennå'
                }
                body={
                  searchQuery || appStatusFilter
                    ? 'Prøv et annet søkeord eller filter.'
                    : 'Finn et oppdrag som passer deg, og send en søknad — det tar under ett minutt.'
                }
                actionLabel={searchQuery || appStatusFilter ? undefined : 'Utforsk oppdrag'}
                onAction={searchQuery || appStatusFilter ? undefined : () => navigate('/home')}
              />
            ) : (
              filteredApps.map((app: any) => {
                const appStatus = APP_STATUS[app.status] || {
                  label: app.status,
                  tone: 'quiet' as Tone,
                };
                const orderStatus = app.order?.status ? ORDER_STATUS[app.order.status] : null;
                const orderId = app.order?._id;
                const canStart = app.order?.status === 'paid';
                const inProgress = app.order?.status === 'in_progress';
                const readyReview = app.order?.status === 'ready_for_review';
                const canWithdraw = app.status === 'pending' && !app.order;

                return (
                  <article key={app._id} className={`${CARD} overflow-hidden`}>
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9] text-[#2E6641]">
                          <Briefcase size={18} strokeWidth={2} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={appStatus.tone}>{appStatus.label}</Badge>
                            {orderStatus && (
                              <Badge tone={orderStatus.tone}>{orderStatus.label}</Badge>
                            )}
                          </div>

                          <h3 className="line-clamp-1 text-[1rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                            {app.service?.title || 'Oppdrag'}
                          </h3>

                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-[#63665F]">
                            <span>Søkt {dateShort(app.appliedAt)}</span>
                            {app.service?.location?.city && (
                              <>
                                <span aria-hidden="true" className="text-[#9B9E96]">
                                  ·
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={12} strokeWidth={2} className="text-[#9B9E96]" />
                                  {app.service.location.city}
                                </span>
                              </>
                            )}
                          </p>

                          {app.service?.customer && (
                            <div className="mt-2.5 flex items-center gap-2">
                              <Avatar
                                src={app.service.customer.avatarUrl}
                                name={app.service.customer.name}
                              />
                              <span className="text-[0.8125rem] text-[#63665F]">
                                Oppdragsgiver:{' '}
                                <span className="font-medium text-[#0B0B0B]">
                                  {app.service.customer.name}{' '}
                                  {app.service.customer.lastName || ''}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[1rem] font-bold tabular-nums tracking-[-0.02em] text-[#0B0B0B]">
                            {kr(app.order?.agreedPrice ?? app.service?.price) || '—'}
                          </p>
                          {app.order?.agreedPrice != null &&
                            app.order.agreedPrice !== app.service?.price && (
                              <p className="mt-0.5 text-[0.6875rem] text-[#9B9E96]">Avtalt pris</p>
                            )}
                        </div>
                      </div>

                      <FlowRail app={app} />

                      {app.message && (
                        <div className="mt-4 rounded-xl border-l-2 border-[#2E6641] bg-[#F4F6F0] px-3.5 py-2.5">
                          <p className={MICRO_LABEL}>Din melding</p>
                          <p className="mt-1 line-clamp-2 text-[0.875rem] leading-relaxed text-[#0B0B0B]">
                            {app.message}
                          </p>
                        </div>
                      )}

                      {app.nextAction && (
                        <p className="mt-3 flex items-center gap-2 text-[0.8125rem] text-[#63665F]">
                          <ArrowRight size={13} strokeWidth={2.4} className="text-[#2E6641]" />
                          {app.nextAction}
                        </p>
                      )}
                    </div>

                    {/* ── Actions ──────────────────────────────────────────── */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#E6E7E1] bg-[#F4F6F0] px-5 py-3.5">
                      {canStart && orderId && (
                        <button
                          onClick={() => navigate(`/provider/orders/${orderId}`)}
                          className={ACTION_PRIMARY}
                        >
                          <Play size={13} strokeWidth={2.4} /> Start jobben
                        </button>
                      )}
                      {inProgress && orderId && (
                        <button
                          onClick={() => navigate(`/provider/orders/${orderId}`)}
                          className={ACTION_PRIMARY}
                        >
                          Fortsett arbeidet <ArrowRight size={13} strokeWidth={2.4} />
                        </button>
                      )}
                      {readyReview && orderId && (
                        <button
                          onClick={() => navigate(`/provider/orders/${orderId}`)}
                          className={ACTION_PRIMARY}
                        >
                          <CheckCircle2 size={13} strokeWidth={2.4} /> Se detaljer
                        </button>
                      )}

                      <button
                        onClick={() => navigate(`/job-listing/${app.service?._id}`)}
                        className={ACTION_BUTTON}
                      >
                        <Eye size={13} strokeWidth={2} /> Vis oppdrag
                      </button>

                      {app.chat?._id && (
                        <button
                          onClick={() => navigate(`/messages/${app.chat._id}`)}
                          className={ACTION_BUTTON}
                        >
                          <MessageCircle size={13} strokeWidth={2} /> Chat
                        </button>
                      )}

                      {orderId && (
                        <>
                          {!canStart && !inProgress && !readyReview && (
                            <button
                              onClick={() => navigate(`/provider/orders/${orderId}`)}
                              className={ACTION_BUTTON}
                            >
                              <FileText size={13} strokeWidth={2} /> Oppdrag
                            </button>
                          )}
                          <ContractViewModal
                            orderId={orderId}
                            trigger={
                              <span className={`${ACTION_BUTTON} cursor-pointer`}>
                                <FileText size={13} strokeWidth={2} /> Se kontrakt
                              </span>
                            }
                          />
                        </>
                      )}

                      {canWithdraw && (
                        <button
                          disabled={withdrawMutation.isPending}
                          onClick={() => {
                            if (!window.confirm('Vil du trekke tilbake søknaden?')) return;
                            withdrawMutation.mutate(app._id, {
                              onSuccess: () => toast.success('Søknaden er trukket tilbake'),
                              onError: (e: any) =>
                                toast.error(
                                  e?.response?.data?.error || 'Kunne ikke trekke tilbake søknaden'
                                ),
                            });
                          }}
                          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:opacity-50"
                        >
                          <X size={13} strokeWidth={2.4} />
                          {withdrawMutation.isPending ? 'Trekker…' : 'Trekk tilbake'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyApplicantsOverview;
