import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../stores/userStore';
import {
  useJobDetailQuery,
  useSendMessageMutation,
  useStripeMutation,
  useCreateJobRequestMutation,
  useMyJobRequestsQuery,
} from '../../features/jobDetail/hook.ts';

import JobButton from '../../components/job/JobButton.tsx';
import RelatedJobs from '../../components/job/RelatedJobs.tsx';
import { JobDetailSkeleton } from '../../components/Loading/JobDetailSkeleton.tsx';
import { useFavoriteToggle } from '../../features/favorites/hook/useFavoriteToggle.ts';
import { lazy, Suspense, useState, useEffect } from 'react';
const MapComponent = lazy(() =>
  import('../../components/component/map/MapComponent').then((module) => ({
    default: module.MapComponent,
  }))
);
import {
  Share2,
  MapPin,
  Star,
  Bookmark,
  Zap,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { BackLink } from '../../components/Ui/BackLink';
import { dateFormatter } from '../../utils/dateFormatter';
import { isClosedService, statusLabel } from '../../constants/statuses';
import { apiUrl } from '../../config/env';
import { ShareModal } from '../../components/shared/ShareModal/ShareModal';
import { UpgradeModal } from '../../components/shared/UpgradeModal';
import { BuyContactModal } from '../../components/shared/BuyContactModal';
import OrderRequestModal from '../../components/job/OrderRequestModal';
import ReportJobModal from '../../components/job/ReportJobModal';
import { submitUserJobReport } from '../../api/admin/jobReports';
import { useMutation } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';

import { usePlans } from '../../features/plans/hooks';
import { getConfigByKey } from '../../features/plans/api';

const JobListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPaymentRedirecting, setIsPaymentRedirecting] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [unlockTime, setUnlockTime] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [upgradeInfo, setUpgradeInfo] = useState<{
    message?: string;
    limit?: number;
    usage?: number;
    perContactPrice?: number;
  }>({});

  const sendMessageMutation = useSendMessageMutation();
  const stripeMutation = useStripeMutation();
  const createJobRequestMutation = useCreateJobRequestMutation();

  const submitReportMutation = useMutation({
    mutationFn: (payload: { reportType: string; description: string }) =>
      submitUserJobReport(id!, payload),
    onSuccess: () => {
      toast.success('Takk! Rapporten din er sendt til oss. Vi ser på saken.');
      setIsReportModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Kunne ikke sende rapporten. Prøv igjen.');
    },
  });

  const isAuth = useUserStore((state) => state.isAuthenticated);
  const currentUser = useUserStore((state) => state.user);

  const { data: plans } = usePlans();
  const { data: jobRequests } = useMyJobRequestsQuery(isAuth);
  const [freeJobsToggle, setFreeJobsToggle] = useState(false);

  const {
    isFavorited,
    handleFavoriteClick,
    isLoading: favLoading,
  } = useFavoriteToggle(id!, isAuth);
  const { data: job, isLoading: isJobLoading } = useJobDetailQuery(id!);
  const isOwnJob = job?.userId?._id === currentUser?._id;

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getConfigByKey('FREE_PRIVATE_JOBS_UNDER_10000');
        setFreeJobsToggle(config?.value === true);
      } catch (err) {
        console.error('Error fetching free jobs config:', err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (isAuth && currentUser && plans && jobRequests && job) {
      // Bypass cooldown if job is under 10k and toggle is ON (Private users only)
      const isFreeUnder10k =
        currentUser.planType === 'private' && freeJobsToggle && job.price < 10000;

      if (isFreeUnder10k) {
        setIsTimerActive(false);
        setUnlockTime(null);
        return;
      }

      const currentPlan = plans.find(
        (p) =>
          p.name === (currentUser.subscription || 'Standard') &&
          p.type === (currentUser.planType || 'private')
      );

      const usage = currentUser.monthlyContactUsage || 0;
      const freeLimit = currentPlan?.entitlements?.freeContact || 0;

      if (currentPlan && usage >= freeLimit) {
        const cooldownMinutes = currentPlan.entitlements.ContactUnlock || 0;
        if (cooldownMinutes > 0) {
          // Only requests this user *sent*. /orders/requests/my returns received
          // ones too, so a job poster whose listing had just been applied to was
          // shown a bogus "Åpner for deg om 4:32" on completely unrelated jobs.
          const sentRequests = jobRequests.filter(
            (req) => req.customerId?._id === currentUser._id
          );
          const lastRequest = [...sentRequests].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          if (lastRequest) {
            const unlockAt = new Date(
              new Date(lastRequest.createdAt).getTime() + cooldownMinutes * 60 * 1000
            );

            if (new Date() < unlockAt) {
              setUnlockTime(unlockAt.toISOString());
              setIsTimerActive(true);
              return;
            }
          }
        }
      }

      // Nothing above applied — clear any cooldown left over from a previous
      // render, otherwise the button stays disabled after the wait has expired.
      setIsTimerActive(false);
      setUnlockTime(null);
    }
  }, [isAuth, currentUser, plans, jobRequests, job, freeJobsToggle]);

  // Only a *pending* request blocks re-applying — that is exactly what the
  // backend enforces (orderController: findOne({..., status: 'pending'})).
  // Without the status filter, applicants who were mass-declined when someone
  // else won the contract stayed stuck on a disabled "Forespørsel sendt"
  // forever, with no notification and no way to apply again.
  const hasRequested = jobRequests?.some(
    (req) =>
      req.serviceId?._id === id &&
      req.customerId?._id === currentUser?._id &&
      req.status === 'pending'
  );

  const wasDeclined = jobRequests?.some(
    (req) =>
      req.serviceId?._id === id &&
      req.customerId?._id === currentUser?._id &&
      req.status === 'declined'
  );

  // ── Service status guard ───────────────────────────────────────────────────
  // The list lives in constants/statuses.ts. The local copy was missing
  // awaiting_payment, paid and waiting_for_approval — all three are written by
  // the backend — so a job in any of them kept an enabled "Send forespørsel"
  // and printed its raw status string as the chip.
  const isServiceClosed = !!job && isClosedService(job.status);
  // Blue for four different states, plus grey, red and amber — seven colours saying one
  // thing: you cannot apply. The emoji that led each of them (✅ 🔨 ❌ ⏰ 🔒 ⏸️) went with
  // them. Two tones now: quiet for "finished", dark for "someone else has it".
  const SERVICE_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Oppdraget er fullført', cls: 'bg-[#F4F6F0] text-[#63665F]' },
    in_progress: { label: 'Utfører er valgt — arbeidet pågår', cls: 'bg-[#122A1C] text-white' },
    closed: { label: 'Oppdraget er lukket', cls: 'bg-[#F4F6F0] text-[#63665F]' },
    cancelled: { label: 'Oppdraget er kansellert', cls: 'bg-[#F4F6F0] text-[#63665F]' },
    expired: { label: 'Oppdraget har utløpt', cls: 'bg-[#F4F6F0] text-[#63665F]' },
    awaiting_payment: {
      label: 'Utfører er valgt — venter på betaling',
      cls: 'bg-[#122A1C] text-white',
    },
    paid: { label: 'Betalt — arbeidet starter snart', cls: 'bg-[#122A1C] text-white' },
    waiting_for_approval: { label: 'Venter på godkjenning', cls: 'bg-[#122A1C] text-white' },
  };

  const [lng, lat] = job?.location?.coordinates || [0, 0];
  const hasCoordinates = job?.location?.coordinates && (lng !== 0 || lat !== 0);

  const handleCreateOrder = async () => {
    if (!isAuth) {
      toast.error('Vennligst logg inn for å sende forespørsel');
      navigate('/login');
      return;
    }
    if (!job?._id) return;

    if (isOwnJob) {
      navigate(`/job-applicants/${job._id}`);
      return;
    }

    // Prevent ordering own job even if button is clicked somehow
    if (job.userId?._id === currentUser?._id) {
      toast.error('Du kan ikke bestille ditt eget oppdrag.');
      return;
    }

    setIsOrderModalOpen(true);
  };

  const handleOrderSubmit = (message?: string) => {
    if (!job?._id) return;

    createJobRequestMutation.mutate(
      { serviceId: job._id, message },
      {
        onSuccess: () => {
          setIsOrderModalOpen(false);
          toast.success('Forespørsel sendt! Venter på godkjenning.');
        },
        onError: (err: any) => {
          if (err.response?.status === 403 && err.response?.data?.isDelayed) {
            setUnlockTime(err.response.data.unlockAt);
            setIsTimerActive(true);
            setIsOrderModalOpen(false);
            toast.error(err.response.data.message);
            return;
          }
          if (err.response?.status === 402 || err.response?.data?.upgradeRequired) {
            setUpgradeInfo({
              message: err.response.data.message,
              limit: err.response.data.limit,
              usage: err.response.data.usage,
              perContactPrice: err.response.data.perContactPrice,
            });
            setIsOrderModalOpen(false);
            setIsBuyModalOpen(true);
            return;
          }
          toast.error(
            err.response?.data?.error || err.response?.data?.message || 'Kunne ikke sende forespørsel'
          );
        },
      }
    );
  };

  const handleBuyContact = async () => {
    if (!job?._id || !upgradeInfo.perContactPrice) return;

    setIsPaymentRedirecting(true);
    try {
      const res = await mainLink.post('/api/stripe/create-extra-contact-payment', {
        amount: upgradeInfo.perContactPrice,
        serviceId: job._id,
      });
      window.location.href = res.data.url;
    } catch (error: any) {
      console.error('Payment redirect failed:', error);
      toast.error(error.response?.data?.message || 'Kunne ikke starte betaling');
      setIsPaymentRedirecting(false);
    }
  };

  const isMessageLoading =
    sendMessageMutation.isPending ||
    stripeMutation.isPending ||
    createJobRequestMutation.isPending ||
    isPaymentRedirecting;

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && unlockTime) {
      const calculateTimeLeft = () => {
        const difference = new Date(unlockTime).getTime() - new Date().getTime();
        if (difference <= 0) {
          setIsTimerActive(false);
          setUnlockTime(null);
          setTimeLeft('');
          return;
        }

        const minutes = Math.floor(difference / 1000 / 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft(`${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`);
      };

      calculateTimeLeft();
      interval = setInterval(calculateTimeLeft, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, unlockTime]);

  const handleNextImage = () => {
    if (!job?.images) return;
    setSelectedImageIndex((prev) => (prev + 1) % job.images.length);
  };

  const handlePrevImage = () => {
    if (!job?.images) return;
    setSelectedImageIndex((prev) => (prev - 1 + job.images.length) % job.images.length);
  };

  // Touch handlers for mobile swipe
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !job?.images) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextImage();
    } else if (isRightSwipe) {
      handlePrevImage();
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return dateFormatter.toShortDate(dateString);
  };

  // Loading State
  if (isJobLoading) {
    return (
      <div className="min-h-screen bg-[#EFF0EA]">
        <div className="mx-auto max-w-300 px-4 py-8 sm:px-6">
          <JobDetailSkeleton />
        </div>
      </div>
    );
  }

  // Not Found State
  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] p-4">
        <div className="w-full max-w-md rounded-3xl border border-[#E6E7E1] bg-white p-10 text-center">
          <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
            <MapPin size={20} strokeWidth={2} />
          </span>
          <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">Oppdraget finnes ikke</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
            Annonsen er kanskje fjernet, eller lenken er feil.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
          >
            Se andre oppdrag
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFF0EA] pb-16">
      <div className="mx-auto max-w-300 px-4 pt-6 sm:px-6">
        <BackLink fallback="/home" />

        {/* The gallery and the decision panel sit side by side; everything else runs
            under the gallery. The old layout stacked six identical white boxes down the
            right column, so the price, the apply button and the map all carried the same
            weight and the one action on the page had to be hunted for. */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
          {/* ── Left: gallery + content ──────────────────────────────────── */}
          <div className="min-w-0 space-y-5">
            <div>
              <div
                className="group relative aspect-4/3 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-[#EAF1E9]"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ touchAction: 'pan-y' }}
              >
                {job.images && job.images.length > 0 ? (
                  <>
                    {/* `object-contain` on a grey ground left letterbox bars around every
                        photo. A fixed 4:3 frame also stops the page reflowing when the
                        image finally loads. */}
                    <img
                      src={job.images[selectedImageIndex]}
                      alt={job.title}
                      className="size-full object-cover"
                    />

                    {job.images.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrevImage();
                          }}
                          className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#0B0B0B] shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 md:opacity-0 md:group-hover:opacity-100"
                          aria-label="Forrige bilde"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNextImage();
                          }}
                          className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#0B0B0B] shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 md:opacity-0 md:group-hover:opacity-100"
                          aria-label="Neste bilde"
                        >
                          <ChevronRight size={18} />
                        </button>

                        <span className="absolute bottom-3 right-3 rounded-full bg-[#0B0B0B]/60 px-2.5 py-1 text-[0.6875rem] font-semibold tabular-nums text-white backdrop-blur-sm">
                          {selectedImageIndex + 1} / {job.images.length}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex size-full items-center justify-center text-[0.875rem] text-[#63665F]">
                    Ingen bilde
                  </div>
                )}

                {/* Coral #FF8A71 and #FF4B4B appeared nowhere else on the site. */}
                <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
                  {job.promoted && (
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/95 px-3 text-[0.75rem] font-semibold text-[#63665F] shadow-sm backdrop-blur-sm">
                      <Zap size={12} strokeWidth={2.4} /> Sponset
                    </span>
                  )}
                  {job.urgent && (
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#122A1C] px-3 text-[0.75rem] font-semibold text-white shadow-sm">
                      <Zap size={12} strokeWidth={2.4} /> Haster
                    </span>
                  )}
                </div>

                {/* `useFavoriteToggle` was called at the top of this component and its
                    three return values went nowhere — the markup here was an empty
                    <div/> labelled "Action Buttons". A job could be saved from every
                    card in every grid, but not from its own page. */}
                {!isOwnJob && (
                  <button
                    type="button"
                    onClick={handleFavoriteClick}
                    disabled={favLoading}
                    aria-pressed={isFavorited}
                    aria-label={isFavorited ? 'Fjern fra lagrede' : 'Lagre oppdraget'}
                    className={`absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-95 disabled:opacity-60 ${
                      isFavorited ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
                    }`}
                  >
                    <Bookmark
                      size={16}
                      strokeWidth={2}
                      className={isFavorited ? 'fill-current' : ''}
                    />
                  </button>
                )}
              </div>

              {job.images && job.images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {job.images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      aria-label={`Vis bilde ${idx + 1}`}
                      className={`size-16 shrink-0 overflow-hidden rounded-xl transition-all ${
                        idx === selectedImageIndex
                          ? 'ring-2 ring-[#2E6641] ring-offset-2 ring-offset-[#EFF0EA]'
                          : 'opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img src={img} className="size-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Beskrivelse */}
            <section className="rounded-3xl border border-[#E6E7E1] bg-white p-5 sm:p-6">
              <h2 className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                Om oppdraget
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[#63665F]">
                {job.description || 'Ingen beskrivelse tilgjengelig.'}
              </p>
            </section>

            {/* Sjekkliste */}
            {job.checklist && job.checklist.length > 0 && (
              <section className="rounded-3xl border border-[#E6E7E1] bg-white p-5 sm:p-6">
                <h2 className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                  Sjekkliste
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {job.checklist.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-[0.3rem] border ${
                          item.checked
                            ? 'border-[#2E6641] bg-[#2E6641] text-white'
                            : 'border-[#D4D6CD] bg-white'
                        }`}
                      >
                        {item.checked && <CheckCircle2 size={11} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[0.875rem] leading-relaxed ${
                            item.checked ? 'text-[#9B9E96] line-through' : 'text-[#0B0B0B]'
                          }`}
                        >
                          {item.text}
                        </span>
                        {item.checkedBy && (
                          <span className="mt-0.5 block text-[0.75rem] text-[#9B9E96]">
                            Merket av {item.checkedBy.name} · {formatDate(item.checkedAt)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Detaljer */}
            <section className="rounded-3xl border border-[#E6E7E1] bg-white p-5 sm:p-6">
              <h2 className="mb-1 text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                Detaljer
              </h2>
              <dl className="text-[0.875rem]">
                {[
                  { label: 'Kategori', value: job.categories?.[0] || 'Generelt' },
                  { label: 'Sted', value: job.location?.city || 'Ikke angitt' },
                  {
                    label: 'Varighet',
                    value: job.duration?.value
                      ? `${job.duration.value} ${job.duration.unit || ''}`.trim()
                      : null,
                  },
                  {
                    label: 'Ønsket oppstart',
                    value: job.fromDate ? formatDate(job.fromDate) : null,
                  },
                  { label: 'Frist', value: job.toDate ? formatDate(job.toDate) : null },
                  { label: 'Betaling', value: job.paymentType || null },
                  // `job.experience` was rendered here, but the Service schema has no such
                  // path — the row printed "Ikke angitt" on every listing that has ever
                  // existed. `equipment` is the field the form actually collects, and it
                  // was shown nowhere.
                  { label: 'Utstyr', value: job.equipment || null },
                  { label: 'Lagt ut', value: job.createdAt ? formatDate(job.createdAt) : null },
                ]
                  .filter((row) => row.value)
                  .map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 border-b border-[#E6E7E1] py-2.5 last:border-b-0 last:pb-0"
                    >
                      <dt className="shrink-0 text-[#63665F]">{row.label}</dt>
                      <dd className="text-right font-medium text-[#0B0B0B]">{row.value}</dd>
                    </div>
                  ))}
              </dl>
            </section>

            {/* Kart */}
            {hasCoordinates && (
              <section className="rounded-3xl border border-[#E6E7E1] bg-white p-5 sm:p-6">
                <h2 className="mb-3 text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                  Hvor
                </h2>
                <div className="h-56 overflow-hidden rounded-2xl border border-[#E6E7E1]">
                  <Suspense fallback={<div className="jb-skeleton size-full" />}>
                    <MapComponent
                      coordinates={[lng, lat]}
                      circleRadius={job?.location?.radius || 1000}
                    />
                  </Suspense>
                </div>
                <p className="mt-2.5 text-[0.75rem] text-[#9B9E96]">
                  Omtrentlig plassering. Nøyaktig adresse deles når oppdraget er tildelt.
                </p>
              </section>
            )}
          </div>

          {/* ── Right: the decision panel ────────────────────────────────── */}
          <div className="min-w-0 lg:sticky lg:top-24 lg:h-fit lg:space-y-4">
            <div className="rounded-3xl border border-[#E6E7E1] bg-white p-5 sm:p-6">
              {job.status && job.status !== 'open' && job.status !== 'pending' && (
                <span
                  className={`mb-3 inline-flex h-7 items-center rounded-full px-3 text-[0.75rem] font-semibold ${
                    SERVICE_STATUS_LABELS[job.status]?.cls || 'bg-[#F4F6F0] text-[#63665F]'
                  }`}
                >
                  {SERVICE_STATUS_LABELS[job.status]?.label || statusLabel(job.status)}
                </span>
              )}

              <h1 className="text-[clamp(1.375rem,2.6vw,1.75rem)] font-bold leading-tight tracking-[-0.03em] text-[#0B0B0B]">
                {job.title || 'Uten tittel'}
              </h1>

              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem] text-[#63665F]">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} strokeWidth={2} className="text-[#9B9E96]" />
                  {job.location?.city || 'Norge'}
                </span>
                {job.createdAt && (
                  <>
                    <span aria-hidden="true" className="text-[#9B9E96]">
                      ·
                    </span>
                    <span>{dateFormatter.toRelative(job.createdAt)}</span>
                  </>
                )}
                {job.favCount ? (
                  <>
                    <span aria-hidden="true" className="text-[#9B9E96]">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bookmark size={12} strokeWidth={2} className="text-[#9B9E96]" />
                      {job.favCount} lagret
                    </span>
                  </>
                ) : null}
              </p>

              <div className="mt-5 border-t border-[#E6E7E1] pt-5">
                <p className="text-[2rem] font-bold leading-none tabular-nums tracking-[-0.04em] text-[#0B0B0B]">
                  {job.price ? job.price.toLocaleString('nb-NO') : '0'} kr
                </p>
                <p className="mt-1.5 text-[0.8125rem] text-[#63665F]">
                  {job.hourlyRate
                    ? `${job.hourlyRate.toLocaleString('nb-NO')} kr per time`
                    : job.paymentType === 'Anbud'
                      ? 'Antatt budsjett — gi ditt tilbud'
                      : 'Fastpris for hele oppdraget'}
                </p>
              </div>

              {job._id && (
                <div className="mt-5 space-y-3">
                  {isServiceClosed && job.status && SERVICE_STATUS_LABELS[job.status] && (
                    <p className="rounded-2xl bg-[#F4F6F0] px-4 py-3 text-[0.8125rem] leading-relaxed text-[#63665F]">
                      {SERVICE_STATUS_LABELS[job.status].label}. Det er ikke mulig å søke på dette
                      oppdraget lenger.
                    </p>
                  )}

                  <div className={isServiceClosed ? 'pointer-events-none opacity-50' : ''}>
                    <JobButton
                      handleSendMessage={isServiceClosed ? () => {} : handleCreateOrder}
                      id={job._id}
                      job={job}
                      isOwnJob={isOwnJob}
                      isMsgLoading={isMessageLoading}
                      hasRequested={hasRequested}
                      wasDeclined={wasDeclined}
                      isTimerActive={isTimerActive}
                    />
                  </div>

                  {isTimerActive && (
                    <div className="rounded-2xl bg-[#F4F6F0] px-4 py-3.5">
                      <p className="text-[0.875rem] font-semibold text-[#0B0B0B]">
                        Åpner for deg om {timeLeft}
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
                        Med Plus eller Pro slipper du ventetiden.{' '}
                        <button
                          onClick={() => navigate('/pricing')}
                          className="font-semibold text-[#2E6641] underline-offset-[3px] hover:underline"
                        >
                          Se planer
                        </button>
                      </p>
                    </div>
                  )}

                  {/* The page where someone decides to commit had no mention of the
                      protection that makes committing safe. */}
                  {!isServiceClosed && !isOwnJob && (
                    <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-[#63665F]">
                      <ShieldCheck
                        size={14}
                        strokeWidth={2.2}
                        className="mt-px shrink-0 text-[#2E6641]"
                      />
                      Betalingen sikres med SafePay og utbetales først når arbeidet er godkjent.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Oppdragsgiver */}
            <div className="mt-4 rounded-3xl border border-[#E6E7E1] bg-white p-5 sm:p-6 lg:mt-0">
              <h2 className="mb-3.5 text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                Oppdragsgiver
              </h2>
              <button
                type="button"
                onClick={() => job.userId?._id && navigate(`/profile/${job.userId._id}`)}
                disabled={!job.userId?._id}
                className="flex w-full items-center gap-3 rounded-2xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
              >
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] text-[1rem] font-semibold text-[#2E6641]">
                  {job.userId?.avatarUrl ? (
                    <img src={job.userId.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    (job.userId?.name?.charAt(0) || '?').toUpperCase()
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[0.9375rem] font-semibold text-[#0B0B0B]">
                      {job.userId?.role === 'company' && job.userId?.companyName
                        ? job.userId.companyName
                        : job.userId?.name || 'Ukjent'}
                    </span>
                    {job.userId?.role === 'company' && (
                      <span className="rounded-full bg-[#F4F6F0] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-[#63665F]">
                        Bedrift
                      </span>
                    )}
                    {job.userId?.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF1E9] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-[#2E6641]">
                        <ShieldCheck size={9} strokeWidth={3} /> Verifisert
                      </span>
                    )}
                  </span>

                  {job.userId?.role === 'company' && job.userId?.orgNumber && (
                    <span className="mt-0.5 block text-[0.75rem] text-[#9B9E96]">
                      Org.nr {job.userId.orgNumber}
                    </span>
                  )}

                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8125rem] text-[#63665F]">
                    {/* Was `averageRating || '0'` — a hard zero shown as a score for
                        anyone who had simply never been rated. */}
                    {job.userId?.averageRating > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Star
                          size={12}
                          strokeWidth={2}
                          className="fill-[#2E6641] text-[#2E6641]"
                        />
                        {job.userId.averageRating}
                      </span>
                    ) : (
                      <span className="text-[#9B9E96]">Ingen vurderinger ennå</span>
                    )}
                    {job.userId?.completedJobs > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={12} strokeWidth={2} className="text-[#2E6641]" />
                        {job.userId.completedJobs} fullførte
                      </span>
                    )}
                  </span>
                </span>

                <ChevronRight size={17} className="shrink-0 text-[#9B9E96]" />
              </button>
            </div>

            {/* Del / rapporter */}
            <div className="mt-4 flex gap-2 lg:mt-0">
              <button
                onClick={handleShare}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[#E6E7E1] bg-white text-[0.875rem] font-medium text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641]"
              >
                <Share2 size={15} strokeWidth={2} /> Del
              </button>
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full text-[0.875rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B]"
              >
                Rapporter
              </button>
            </div>
          </div>
        </div>

        {/* Recommended Jobs Section */}
        <div className="mt-14 border-t border-[#E6E7E1] pt-10">
          <div className="mb-6">
            <h2 className="text-[clamp(1.25rem,2.4vw,1.625rem)] font-bold tracking-[-0.03em] text-[#0B0B0B]">
              Lignende oppdrag
            </h2>
            <p className="mt-1 text-[0.875rem] text-[#63665F]">
              Basert på sted og kategori
            </p>
          </div>
          <RelatedJobs
            coordinates={job?.location?.coordinates}
            categories={job?.categories}
            currentJobId={job?._id}
          />
        </div>
      </div>

      {/* For reliable social previews, share the backend preview endpoint which returns server-rendered OG tags */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={apiUrl(`/job-listing/${job._id}`)}
        title={job.title || 'Jobblo Oppdrag'}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        {...upgradeInfo}
      />

      <BuyContactModal
        isOpen={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
        onConfirm={handleBuyContact}
        price={upgradeInfo.perContactPrice || 0}
        isLoading={isPaymentRedirecting}
      />

      <OrderRequestModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onConfirm={handleOrderSubmit}
        isLoading={createJobRequestMutation.isPending}
        jobTitle={job.title}
      />

      <ReportJobModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={submitReportMutation.mutate}
        isLoading={submitReportMutation.isPending}
        jobTitle={job.title}
      />
    </div>
  );
};

export default JobListingDetailPage;
