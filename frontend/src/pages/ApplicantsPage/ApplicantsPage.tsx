import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Check,
  MessageCircle,
  X,
  ShieldCheck,
  Route,
  Info,
  Star,
  Heart,
  Archive,
  Users,
} from 'lucide-react';
import {
  useApplicantsQuery,
  useCreateSafePayContractMutation,
  useToggleApplicantFavoriteMutation,
  useToggleApplicantArchiveMutation,
  useDeclineApplicantMutation,
} from '../../features/applicants/hooks';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/Ui/button/Button';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { createOrGetChat } from '../../api/chatAPI';
import EmptyState from '../../components/Ui/EmptyState';
import { timeFormatter } from '../../utils/timeFormatter';
import { safePayFee, safePayNetToProvider } from '../../utils/safePayFee';

const ApplicantsPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [filterBy, setFilterBy] = useState<string>('notArchived');
  const [comparedApplicants, setComparedApplicants] = useState<string[]>([]);
  // Moved here from below the early returns — a hook after an early return is React error #310.
  const [chatStartingFor, setChatStartingFor] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useApplicantsQuery(serviceId!, sortBy, filterBy);
  const createContractMutation = useCreateSafePayContractMutation();
  const toggleFavoriteMutation = useToggleApplicantFavoriteMutation(serviceId!);
  const toggleArchiveMutation = useToggleApplicantArchiveMutation(serviceId!);
  const declineMutation = useDeclineApplicantMutation(serviceId!);

  const activeOrder = data?.activeOrder;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EFF0EA]">
        <div className="mx-auto w-full max-w-300 px-4 py-10 sm:px-6">
          <div className="jb-skeleton h-4 w-24 rounded" />
          <div className="jb-skeleton mt-8 h-14 w-full rounded-2xl" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="jb-skeleton h-36 w-full rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.service) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] p-4">
        <div className="w-full max-w-md rounded-3xl border border-[#E6E7E1] bg-white p-10 text-center">
          <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
            <Users size={20} strokeWidth={2} />
          </span>
          <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">Kunne ikke laste søkere</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
            Sjekk internettforbindelsen din og prøv igjen.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  const { service, applicants } = data;

  // This page is always step 1 ("Velg søker"), so the steps bar always
  // shows this page as the current step.
  const currentStep = 1;

  // The order's real progress is used to mark steps as fullført in the sidebar.
  //
  // `ready_for_review` was missing from all three of these. An order sitting at
  // ready-for-review — paid, worked, waiting on the customer — fell through every branch:
  // the steps bar reset to step 1 as though no one had been chosen, the page stopped
  // treating the job as paid, and the "already has a contract" redirect below had no
  // case for it, so pressing a worker produced a toast and went nowhere.
  const progressStep =
    activeOrder?.status === 'awaiting_payment'
      ? 2
      : ['paid', 'in_progress'].includes(activeOrder?.status)
        ? 3
        : ['ready_for_review', 'completed'].includes(activeOrder?.status)
          ? 4
          : 1;

  const isJobAlreadyPaid =
    activeOrder &&
    ['paid', 'in_progress', 'ready_for_review', 'completed'].includes(activeOrder.status);
  const hasAwaitingPayment = activeOrder && activeOrder.status === 'awaiting_payment';

  const jobDateLabel = service.date
    ? new Date(service.date).toLocaleDateString('no-NO', {
      day: 'numeric',
      month: 'long',
    })
    : 'Fullført oppdrag';

  // chatStartingFor is declared at the top of the component, above the early returns.

  const handleStartChat = async (applicantId: string) => {
    if (chatStartingFor) return;
    setChatStartingFor(applicantId);
    try {
      const chat = await createOrGetChat(applicantId, serviceId!);
      navigate(`/messages/${chat._id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Kunne ikke starte chat');
    } finally {
      setChatStartingFor(null);
    }
  };

  const handleSelectApplicant = (applicantId: string, requestId: string) => {
    if (activeOrder) {
      toast.error('Dette oppdraget har allerede en aktiv kontrakt.');
      if (activeOrder.status === 'awaiting_payment') {
        navigate(`/safepay/checkout/${activeOrder._id}`);
      } else if (['paid', 'in_progress'].includes(activeOrder.status)) {
        navigate(`/safepay/success?orderId=${activeOrder._id}`);
      } else if (['ready_for_review', 'completed'].includes(activeOrder.status)) {
        navigate(`/safepay/approval/${activeOrder._id}`);
      } else {
        // disputed, refunded, or a status added later — send them somewhere real rather
        // than leaving the click with nothing but a toast.
        navigate(`/safepay/success?orderId=${activeOrder._id}`);
      }
      return;
    }

    createContractMutation.mutate(
      { serviceId: serviceId!, applicantId, requestId },
      {
        onSuccess: (res) => {
          toast.success('Kontrakt opprettet! Sender deg til SafePay Checkout.');
          navigate(`/safepay/checkout/${res.orderId}`);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.error || 'Kunne ikke velge søker');
        },
      }
    );
  };

  const handleToggleFavorite = (requestId: string) => {
    toggleFavoriteMutation.mutate(requestId);
  };

  const handleToggleArchive = (requestId: string) => {
    toggleArchiveMutation.mutate(requestId);
  };

  const handleDecline = (requestId: string, archive = true) => {
    declineMutation.mutate({ requestId, archive });
  };

  const toggleCompare = (applicantId: string) => {
    setComparedApplicants((prev) => {
      if (prev.includes(applicantId)) {
        return prev.filter((id) => id !== applicantId);
      } else if (prev.length < 3) {
        return [...prev, applicantId];
      }
      return prev;
    });
  };

  const comparedList = applicants.filter((app: any) =>
    comparedApplicants.includes(app.applicant._id)
  );

  return (
    <div className="min-h-screen bg-[#EFF0EA] font-sans">
      {/* Main Content */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[13px] text-gray-500 hover:text-gray-800 transition-colors mb-5"
        >
          <ArrowLeft size={16} /> Tilbake til profil
        </button>

        {/* Steps Bar */}
        <SafePaySteps
          currentStep={currentStep}
          serviceId={serviceId}
          orderId={activeOrder?._id}
        />

        {/* Oppdrag Summary */}
        <div className="bg-[#122A1C] rounded-2xl p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-white">
            <h2 className="text-lg font-medium mb-1">{service.title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {service.location?.city || 'Ikke angitt'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={12} />{' '}
                {new Date(service.date).toLocaleDateString('no-NO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              {/* (F-38) Was a hardcoded "Ca. 2 timer" for every job. */}
              {timeFormatter.toJobDuration(service.duration) && (
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {timeFormatter.toJobDuration(service.duration)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-medium text-[#8FBF9A]">{service.price} kr</div>
            <div className="text-[11px] text-white/50 uppercase tracking-wider">Oppdragsbeløp</div>
            <div className="bg-[#8FBF9A] text-[#122A1C] rounded-full px-3 py-1 text-[11px] font-medium inline-block mt-2">
              Aktiv
            </div>
          </div>
        </div>

        {comparedApplicants.length > 0 && (
          <div className="bg-white border border-black/5 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-custom-green" /> Sammenlign søkere
              </h3>
              <button
                onClick={() => setComparedApplicants([])}
                className="text-[12px] text-gray-500 hover:text-gray-700"
              >
                Fjern alle
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparedList.map((app: any) => (
                <div key={app._id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#EAF1E9] flex items-center justify-center overflow-hidden">
                      {app.applicant.avatarUrl ? (
                        <img
                          src={app.applicant.avatarUrl}
                          alt={app.applicant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-medium">
                          {app.applicant.name
                            .split(' ')
                            .map((n: any) => n[0])
                            .join('')}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-[14px] font-medium">{app.applicant.name}</div>
                      <div className="text-[12px] text-gray-500">
                        {app.applicant.skills?.join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <div className="font-bold">{app.applicant.completedJobs}</div>
                      <div className="text-[10px] text-gray-500 uppercase">Fullførte</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <div className="font-bold">{app.applicant.rating}★</div>
                      <div className="text-[10px] text-gray-500 uppercase">Rating</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <div className="font-bold">{app.applicant.responseRate}</div>
                      <div className="text-[10px] text-gray-500 uppercase">Svar%</div>
                    </div>
                    {/* "Svartid" removed — the backend hardcoded "< 1t" for every
                        applicant, so it ranked nobody and misled the hire. */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Left Column - Applicants List */}
          <div>
            <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
              <h3 className="text-[15px] font-medium text-gray-900">{applicants.length} søkere</h3>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="flex-1 min-w-[120px] text-[12px] text-gray-600 border border-black/15 rounded-full px-3 py-1 bg-white outline-none cursor-pointer"
                >
                  <option value="notArchived">Ikke arkivert</option>
                  <option value="favorites">Favoritter</option>
                  <option value="archived">Arkivert</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 min-w-[120px] text-[12px] text-gray-600 border border-black/15 rounded-full px-3 py-1 bg-white outline-none cursor-pointer"
                >
                  <option value="createdAt">Sorter: Nyeste først</option>
                  <option value="rating">Høyest rating</option>
                  <option value="completedJobs">Flest oppdrag</option>
                  <option value="favorites">Favoritter først</option>
                </select>
              </div>
            </div>

            {applicants.length > 0 ? (
              <div className="space-y-4">
                {applicants.map((app: any, index: number) => (
                  <div
                    key={app._id}
                    className={`relative bg-white border rounded-2xl p-4 md:p-5 transition-all ${app.favorite
                      ? 'border-2 border-yellow-300'
                      : app.archived
                        ? 'opacity-60'
                        : 'border-black/5'
                      }`}
                  >
                    {/*
                      The four actions used to be `absolute top-4 right-4`, while the stats
                      below sat in normal flow on the same side of the same row. The row
                      reserved space for them on mobile (`pt-10`) but cancelled it on
                      desktop (`md:pt-0`), so from the `md` breakpoint up the icons were
                      laid directly over the Fullførte/Rating/Svar% figures. They are in
                      flow now — one right-hand column, actions above the numbers — so the
                      two cannot collide at any width.
                    */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-[#EAF1E9] text-[#122A1C] font-medium flex items-center justify-center text-lg overflow-hidden">
                            {app.applicant.avatarUrl ? (
                              <img
                                src={app.applicant.avatarUrl}
                                alt={app.applicant.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              app.applicant.name
                                .split(' ')
                                .map((n: any) => n[0])
                                .join('')
                            )}
                          </div>
                          {index === 0 && (
                            <span className="absolute -top-1 -right-1 bg-custom-green text-white text-[9px] font-medium rounded-full px-1.5 py-0.5 border-[1.5px] border-[#f5f0e8]">
                              Topp
                            </span>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[15px] font-medium text-gray-900">
                              {app.applicant.name}
                            </span>
                            {app.applicant.verified && (
                              <span className="flex items-center gap-0.5 text-[11px] text-custom-green font-medium">
                                <ShieldCheck size={12} /> Verifisert
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-gray-400 mb-1">
                            {app.applicant.skills?.join(' · ') || 'Generell hjelp'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex text-[#63665F]">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  size={11}
                                  fill={
                                    i < Math.floor(app.applicant.rating) ? 'currentColor' : 'none'
                                  }
                                />
                              ))}
                            </div>
                            <span className="text-[11px] text-gray-400">
                              {app.applicant.rating} · {app.applicant.completedJobs} oppdrag
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Side by side on a phone, stacked on the right on desktop. */}
                      <div className="flex shrink-0 items-center justify-between gap-4 md:flex-col md:items-end md:gap-3">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(app._id)}
                            aria-pressed={!!app.favorite}
                            aria-label="Marker som favoritt"
                            title="Favoritt"
                            className={`flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${app.favorite
                              ? 'bg-[#EAF1E9] text-[#2E6641]'
                              : 'text-[#9B9E96] hover:bg-[#F4F6F0] hover:text-[#2E6641]'
                              }`}
                          >
                            <Heart size={17} fill={app.favorite ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCompare(app.applicant._id)}
                            aria-pressed={comparedApplicants.includes(app.applicant._id)}
                            aria-label="Legg til i sammenligning"
                            title="Sammenlign"
                            className={`flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${comparedApplicants.includes(app.applicant._id)
                              ? 'bg-[#EAF1E9] text-[#2E6641]'
                              : 'text-[#9B9E96] hover:bg-[#F4F6F0] hover:text-[#2E6641]'
                              }`}
                          >
                            <Users size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(app._id)}
                            aria-pressed={!!app.archived}
                            aria-label={app.archived ? 'Gjenopprett fra arkiv' : 'Arkiver søker'}
                            title={app.archived ? 'Gjenopprett fra arkiv' : 'Arkiver'}
                            className={`flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${app.archived
                              ? 'bg-[#EAF1E9] text-[#2E6641]'
                              : 'text-[#9B9E96] hover:bg-[#F4F6F0] hover:text-[#0B0B0B]'
                              }`}
                          >
                            <Archive size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecline(app._id)}
                            aria-label="Avslå søker"
                            title="Avslå søker"
                            className="flex size-9 items-center justify-center rounded-full text-[#9B9E96] transition-colors hover:bg-[#FBF4F2] hover:text-[#B4544A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                          >
                            <X size={17} />
                          </button>
                        </div>

                        <dl className="flex shrink-0 items-start gap-5">
                          <div className="text-center">
                            <dd className="text-[0.9375rem] font-semibold tabular-nums text-[#0B0B0B]">
                              {app.applicant.completedJobs}
                            </dd>
                            <dt className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">
                              Fullførte
                            </dt>
                          </div>
                          <div className="text-center">
                            <dd className="text-[0.9375rem] font-semibold tabular-nums text-[#0B0B0B]">
                              {app.applicant.rating}★
                            </dd>
                            <dt className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">
                              Rating
                            </dt>
                          </div>
                          <div className="text-center">
                            <dd className="text-[0.9375rem] font-semibold tabular-nums text-[#0B0B0B]">
                              {app.applicant.responseRate}
                            </dd>
                            <dt className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">
                              Svar%
                            </dt>
                          </div>
                          {/* "Svartid" removed — see the sidebar card above. */}
                        </dl>
                      </div>
                    </div>

                    <div className="bg-[#F4F6F0] rounded-xl p-3 my-4 border-l-[3px] border-custom-green">
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-1">
                        <MessageCircle size={12} /> Melding fra søker
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed">{app.message}</p>
                    </div>

                    {/*
                      One row from `sm` up, stacked below it.

                      These were already in a `flex flex-wrap` container, so the intent was
                      there — but the shared `Button` bakes `w-full` into its cva base, so
                      each one filled the line and forced a wrap. The `w-auto` below is what
                      actually releases them; `cn` runs through tailwind-merge, so it beats
                      the base rather than sitting alongside it.

                      They stay stacked under 640px because "Velg og start SafePay" is a long
                      label and the base sets `whitespace-nowrap` — side by side on a narrow
                      phone would overflow the card rather than wrap.
                    */}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        onClick={() => handleSelectApplicant(app.applicant._id, app._id)}
                        loading={createContractMutation.isPending}
                        disabled={!!activeOrder}
                        label={
                          isJobAlreadyPaid
                            ? 'Betalt'
                            : hasAwaitingPayment
                              ? 'Gå til betaling'
                              : 'Velg og start SafePay'
                        }
                        icon={<Check size={16} />}
                        className={`w-auto rounded-full bg-custom-green px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-[#266b3c] sm:flex-1 sm:basis-0 ${activeOrder ? 'opacity-70' : ''}`}
                      />
                      {/* (F-35) "Velg uten SafePay" removed: it only fired
                          toast.success('Bruker valgt uten SafePay') — no API call, no
                          contract, no applicant selected and nobody notified, while the
                          poster believed they had hired someone. Hiring outside escrow
                          is not an implemented flow. */}
                      {/*
                        `sm:flex-1 sm:basis-0` on both, so the row splits down the middle.
                        `flex-1` alone would not: its basis is 0% but the labels differ in
                        length, and the base Button sets `whitespace-nowrap`, so the wider
                        label claims more of the row. Fixing the basis makes the two halves
                        equal regardless of what the primary label currently says — it
                        changes between "Velg og start SafePay", "Gå til betaling" and
                        "Betalt".
                      */}
                      <Button
                        variant="outline"
                        label="Send melding"
                        icon={<MessageCircle size={16} />}
                        loading={chatStartingFor === app.applicant._id}
                        disabled={!!chatStartingFor}
                        className="w-auto rounded-full border-black/20 px-5 py-2.5 text-[13px] font-medium hover:bg-gray-50 sm:flex-1 sm:basis-0"
                        onClick={() => handleStartChat(app.applicant._id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/5">
                <EmptyState type="applicants" />
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-3">
            {/* Timeline Sidebar (Neste steg) */}
            <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[14px] font-bold text-gray-900 mb-5">
                <Route size={18} className="text-custom-green" /> Neste steg
              </div>
              <div className="space-y-0">
                {[
                  {
                    label: 'Velg en søker',
                    desc: 'Søker valgt',
                    stepNumber: 1,
                  },
                  {
                    label: 'Start SafePay',
                    desc: 'Kontrakt genereres automatisk',
                    stepNumber: 2,
                  },
                  {
                    label: 'Jobben utføres',
                    desc: jobDateLabel,
                    stepNumber: 3,
                  },
                  {
                    label: 'Godkjenn og utbetal',
                    desc: `${safePayNetToProvider(service.price)} kr til oppdragstaker`,
                    stepNumber: 4,
                  },
                ].map((step) => {
                  const stepNumber = step.stepNumber ?? 1;
                  const isCurrent = stepNumber === currentStep;
                  const isDone = stepNumber < progressStep;
                  const isLast = stepNumber === 4;
                  return (
                    <div key={step.label} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-2.5 h-2.5 rounded-full mt-1 ${isCurrent
                            ? 'bg-[#122A1C] ring-4 ring-[#122A1C]/15'
                            : isDone
                              ? 'bg-custom-green'
                              : 'bg-gray-200'
                            }`}
                        ></div>
                        {!isLast && (
                          <div className="w-[1px] flex-1 bg-black/10 my-1 min-h-[30px]"></div>
                        )}
                      </div>
                      <div className={isLast ? '' : 'pb-5'}>
                        <div
                          className={`text-[13px] leading-tight ${isCurrent ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'
                            }`}
                        >
                          {stepNumber}. {step.label}
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${isCurrent
                            ? 'text-custom-green font-bold'
                            : isDone
                              ? 'text-custom-green'
                              : 'text-gray-400'
                            }`}
                        >
                          {isCurrent ? 'Du er her nå' : isDone ? 'Fullført' : step.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SafePay Info */}
            <div className="bg-white border border-black/5 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-900 mb-4">
                <ShieldCheck size={16} className="text-custom-green" /> SafePay beskytter deg
              </div>
              <div className="bg-[#EAF1E9] rounded-xl p-3 mb-3">
                <p className="text-[12px] text-[#2E6641] leading-relaxed">
                  <strong className="block mb-1 text-[13px]">Slik fungerer det</strong>
                  Pengene holdes trygt til du godkjenner jobben. Ingen betaling før du er fornøyd.
                </p>
              </div>
              <div className="space-y-1 text-[11px] text-gray-400 leading-relaxed">
                <div className="flex justify-between">
                  <span>Oppdragsbeløp:</span>
                  <strong className="text-gray-900">{service.price} kr</strong>
                </div>
                <div className="flex justify-between">
                  <span>SafePay-gebyr (3%):</span>
                  <strong className="text-gray-900">{safePayFee(service.price)} kr</strong>
                </div>
                <div className="flex justify-between">
                  <span>Utbetalt til søker:</span>
                  <strong className="text-custom-green">
                    {safePayNetToProvider(service.price)} kr
                  </strong>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-white border border-black/5 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-900 mb-4">
                <Info size={16} className="text-custom-green" /> Hva bør du se etter?
              </div>
              <div className="space-y-2">
                {[
                  'Høy rating (over 4.5)',
                  'Mange fullførte oppdrag',
                  'BankID eller ID verifisert',
                  'God og detaljert melding',
                  'Rask svartid',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-gray-600">
                    <Check size={14} className="text-custom-green" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantsPage;
