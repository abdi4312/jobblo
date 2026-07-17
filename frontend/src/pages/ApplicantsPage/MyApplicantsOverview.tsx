import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Users, Search, Briefcase, ClipboardList,
  MessageCircle, FileText, Eye, ArrowRight, X, Loader2,
  CheckCircle2, Clock, AlertTriangle, Play, TrendingUp,
} from 'lucide-react';
import {
  useMyApplicantsOverviewQuery,
  useMyApplicationsOverviewQuery,
  useWithdrawApplicationMutation,
} from '../../features/applicants/hooks';
import EmptyState from '../../components/Ui/EmptyState';
import { toast } from 'react-hot-toast';

// ── Helpers ────────────────────────────────────────────────────────────────────
const SERVICE_STATUS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: 'I gang', cls: 'bg-blue-100 text-blue-700' },
  open: { label: 'Aktiv', cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Fullført', cls: 'bg-gray-100 text-gray-600' },
  awaiting_payment: { label: 'Venter på betaling', cls: 'bg-amber-100 text-amber-700' },
  waiting_for_approval: { label: 'Venter godkjenning', cls: 'bg-purple-100 text-purple-700' },
  cancelled: { label: 'Kansellert', cls: 'bg-red-100 text-red-600' },
  closed: { label: 'Lukket', cls: 'bg-gray-100 text-gray-500' },
};

const ORDER_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  awaiting_payment: { label: 'Venter på betaling', cls: 'bg-amber-50 border-amber-200 text-amber-700', icon: <Clock size={12} /> },
  paid: { label: 'Betalt – start nå', cls: 'bg-blue-50 border-blue-200 text-blue-700', icon: <Play size={12} /> },
  in_progress: { label: 'Jobb pågår', cls: 'bg-indigo-50 border-indigo-200 text-indigo-700', icon: <TrendingUp size={12} /> },
  ready_for_review: { label: 'Venter på godkjenning', cls: 'bg-purple-50 border-purple-200 text-purple-700', icon: <CheckCircle2 size={12} /> },
  completed: { label: 'Fullført', cls: 'bg-green-50 border-green-200 text-green-700', icon: <CheckCircle2 size={12} /> },
  disputed: { label: 'Tvist', cls: 'bg-red-50 border-red-200 text-red-600', icon: <AlertTriangle size={12} /> },
};

const APP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Venter', cls: 'bg-amber-100 text-amber-700' },
  accepted: { label: 'Valgt', cls: 'bg-blue-100 text-blue-700' },
  declined: { label: 'Avslått', cls: 'bg-red-100 text-red-600' },
};

// ── Flow steps for "Mine søknader" view ────────────────────────────────────────
function FlowSteps({ app }: { app: any }) {
  const steps = [
    { key: 'applied', label: 'Søkt', done: true },
    { key: 'selected', label: 'Valgt', done: app.status === 'accepted' || !!app.order },
    { key: 'paid', label: 'Betalt', done: app.order?.paymentStatus === 'paid' },
    { key: 'working', label: 'Under arbeid', done: ['in_progress', 'ready_for_review', 'completed'].includes(app.order?.status) },
    { key: 'done', label: 'Fullført', done: app.order?.status === 'completed' },
  ];

  const currentIdx = steps.reduce((last, s, i) => (s.done ? i : last), 0);

  return (
    <div className="flex items-center gap-0 mt-3">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${step.done
              ? 'bg-custom-green border-custom-green text-white'
              : i === currentIdx + 1
                ? 'bg-white border-custom-green text-custom-green'
                : 'bg-white border-gray-200 text-gray-300'
              }`}>
              {step.done ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] mt-0.5 font-medium ${step.done ? 'text-custom-green' : 'text-gray-300'}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-0.5 ${step.done && steps[i + 1].done ? 'bg-custom-green' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const MyApplicantsOverview: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'mine-sokere' | 'mine-soknader'>('mine-sokere');
  const [searchQuery, setSearchQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');

  // ── Tab 1 data ───────────────────────────────────────────────────────────────
  const { data: services, isLoading: servicesLoading } = useMyApplicantsOverviewQuery();

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
  const { data: appData, isLoading: appsLoading } = useMyApplicationsOverviewQuery(appStatusFilter || undefined);
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

  const isLoading = activeTab === 'mine-sokere' ? servicesLoading : appsLoading;

  return (
    <div className="min-h-screen bg-[#f5f0e8] py-8 px-4 md:px-6">
      <div className="max-w-[1024px] mx-auto">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Søkeroversikt</h1>
          <p className="text-[13px] text-gray-500">Administrer dine søkere og egne søknader</p>
        </div>

        {/* ── Two tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex bg-white border border-black/5 rounded-xl p-1 w-fit mb-6 shadow-sm">
          {[
            { key: 'mine-sokere', label: 'Mine søkere', icon: <Users size={15} />, count: services?.length },
            { key: 'mine-soknader', label: 'Mine søknader', icon: <ClipboardList size={15} />, count: appData?.pagination?.total },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all ${activeTab === tab.key
                ? 'bg-custom-green text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Search + filters ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'mine-sokere' ? 'Søk etter jobbnavn...' : 'Søk etter jobb eller oppdragsgiver...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-custom-green/30"
            />
          </div>

          {/* Status filter — only for Mine søknader tab */}
          {activeTab === 'mine-soknader' && (
            <div className="flex gap-2 flex-wrap">
              {[
                { value: '', label: 'Alle' },
                { value: 'pending', label: 'Venter' },
                { value: 'accepted', label: 'Valgt' },
                { value: 'declined', label: 'Avslått' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setAppStatusFilter(f.value)}
                  className={`text-[12px] font-medium px-3.5 py-2 rounded-full border transition-all ${appStatusFilter === f.value
                    ? 'bg-custom-green text-white border-custom-green'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-custom-green/40'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Loading ──────────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-custom-green" />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1 — Mine søkere (job owner view)                                  */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {!isLoading && activeTab === 'mine-sokere' && (
          <div className="space-y-3">
            {filteredServices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5">
                <EmptyState type="applicants" title="Ingen oppdrag" description="Du har ingen oppdrag med søkere ennå." />
              </div>
            ) : (
              filteredServices.map((service: any) => {
                const statusInfo = SERVICE_STATUS[service.status] || { label: service.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <div
                    key={service._id}
                    onClick={() => navigate(`/job-applicants/${service._id}`)}
                    className="bg-white rounded-2xl p-4 md:p-5 cursor-pointer hover:shadow-md transition-all border border-black/5 group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Icon */}
                        <div className="w-11 h-11 rounded-xl bg-[#f0faf0] border border-[#c6f0d8] flex items-center justify-center shrink-0">
                          <Briefcase size={18} className="text-custom-green" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusInfo.cls}`}>
                              {statusInfo.label}
                            </span>
                            {service.selectedWorker && (
                              <span className="text-[10px] font-medium text-custom-green bg-[#f0faf0] border border-[#c6f0d8] px-2 py-0.5 rounded-full">
                                ✓ Utfører valgt
                              </span>
                            )}
                          </div>
                          <h3 className="text-[15px] font-semibold text-gray-900 line-clamp-1">{service.title}</h3>
                          <p className="text-[12px] text-gray-400 mt-0.5">
                            {new Date(service.createdAt).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {service.location?.city ? ` · ${service.location.city}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-5 shrink-0">
                        {/* Applicant avatars + count */}
                        <div className="flex flex-col items-end">
                          <div className="flex -space-x-2 mb-1">
                            {service.applicantAvatars?.slice(0, 3).map((avatar: string, i: number) => (
                              <img key={i} src={avatar} alt="" className="w-7 h-7 rounded-full border-2 border-white object-cover" />
                            ))}
                            {service.applicantCount > 0 && !service.applicantAvatars?.length && (
                              <div className="w-7 h-7 rounded-full border-2 border-white bg-custom-green flex items-center justify-center">
                                <Users size={12} className="text-white" />
                              </div>
                            )}
                          </div>
                          <span className="text-[12px] font-bold text-gray-700">
                            {service.applicantCount} <span className="text-gray-400 font-normal">søkere</span>
                          </span>
                        </div>

                        {/* Price */}
                        <div className="text-right hidden sm:block">
                          <p className="text-[15px] font-bold text-gray-900">{service.price?.toLocaleString('no-NO')} kr</p>
                        </div>

                        <ChevronRight size={20} className="text-gray-300 group-hover:text-custom-green transition-colors" />
                      </div>
                    </div>

                    {/* Selected worker row */}
                    {service.selectedWorker && (
                      <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#c8d8c8] overflow-hidden">
                          {service.selectedWorker.avatarUrl
                            ? <img src={service.selectedWorker.avatarUrl} alt="" className="w-full h-full object-cover" />
                            : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[#1a3a1a]">{service.selectedWorker.name?.[0]}</span>
                          }
                        </div>
                        <p className="text-[12px] text-gray-500">
                          Valgt utfører: <span className="font-semibold text-gray-700">{service.selectedWorker.name}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2 — Mine søknader (provider/applicant view)                       */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {!isLoading && activeTab === 'mine-soknader' && (
          <div className="space-y-3">
            {filteredApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5">
                <EmptyState type="applications" title="Ingen søknader" description="Du har ikke søkt på noen oppdrag ennå." onActionClick={() => navigate('/home')} actionLabel="Utforsk oppdrag" />
              </div>
            ) : (
              filteredApps.map((app: any) => {
                const appStatus = APP_STATUS[app.status] || { label: app.status, cls: 'bg-gray-100 text-gray-600' };
                const orderStatus = app.order?.status ? ORDER_STATUS[app.order.status] : null;
                const canStart = app.order?.status === 'paid';
                const inProgress = app.order?.status === 'in_progress';
                const readyReview = app.order?.status === 'ready_for_review';

                return (
                  <div key={app._id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                    {/* Card header */}
                    <div className="p-4 md:p-5">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="w-11 h-11 rounded-xl bg-[#1a3a1a] flex items-center justify-center shrink-0">
                          <Briefcase size={18} className="text-[#4ade80]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Status badges */}
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${appStatus.cls}`}>
                              {appStatus.label}
                            </span>
                            {orderStatus && (
                              <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${orderStatus.cls}`}>
                                {orderStatus.icon} {orderStatus.label}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="text-[15px] font-semibold text-gray-900 line-clamp-1">{app.service?.title || 'Oppdrag'}</h3>

                          {/* Meta */}
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-[12px] text-gray-400">
                            {app.service?.location?.city && <span>📍 {app.service.location.city}</span>}
                            {app.service?.price && <span className="font-semibold text-custom-green">{app.service.price.toLocaleString('no-NO')} kr</span>}
                            <span>Søkt {new Date(app.appliedAt).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}</span>
                          </div>

                          {/* Customer info */}
                          {app.service?.customer && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="w-5 h-5 rounded-full bg-[#c8d8c8] overflow-hidden shrink-0">
                                {app.service.customer.avatarUrl
                                  ? <img src={app.service.customer.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  : <span className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[#1a3a1a]">{app.service.customer.name?.[0]}</span>
                                }
                              </div>
                              <span className="text-[12px] text-gray-500">
                                Oppdragsgiver: <span className="font-medium text-gray-700">{app.service.customer.name} {app.service.customer.lastName || ''}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Price (desktop) */}
                        <div className="hidden sm:block text-right shrink-0">
                          <p className="text-[15px] font-bold text-custom-green">{app.service?.price?.toLocaleString('no-NO')} kr</p>
                          {app.order?.agreedPrice && app.order.agreedPrice !== app.service?.price && (
                            <p className="text-[11px] text-gray-400">Avtalt: {app.order.agreedPrice} kr</p>
                          )}
                        </div>
                      </div>

                      {/* ── Flow steps ─────────────────────────────────────────── */}
                      <FlowSteps app={app} />

                      {/* ── Application message ────────────────────────────────── */}
                      {app.message && (
                        <div className="mt-3 bg-[#f9f9f7] border-l-[3px] border-custom-green rounded-r-xl px-3 py-2">
                          <p className="text-[11px] text-gray-400 mb-0.5">Din melding</p>
                          <p className="text-[13px] text-gray-700 line-clamp-2">{app.message}</p>
                        </div>
                      )}

                      {/* ── Next action hint ───────────────────────────────────── */}
                      {app.nextAction && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-custom-green">→</span> {app.nextAction}
                        </div>
                      )}
                    </div>

                    {/* ── Action buttons ──────────────────────────────────────── */}
                    <div className="px-4 md:px-5 pb-4 flex flex-wrap gap-2 border-t border-black/5 pt-3 bg-[#fafafa]">
                      {/* View job */}
                      <button
                        onClick={() => navigate(`/job-listing/${app.service?._id}`)}
                        className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 bg-white border border-black/10 rounded-full hover:bg-gray-50 transition-colors"
                      >
                        <Eye size={13} /> Vis jobb
                      </button>

                      {/* Open chat */}
                      {app.chat?._id && (
                        <button
                          onClick={() => navigate(`/messages/${app.chat._id}`)}
                          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 bg-white border border-black/10 rounded-full hover:bg-gray-50 transition-colors"
                        >
                          <MessageCircle size={13} /> Chat
                        </button>
                      )}

                      {/* View contract — provider goes to work page, not checkout */}
                      {app.order?._id && (
                        <button
                          onClick={() => navigate(`/provider/orders/${app.order._id}`)}
                          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 bg-white border border-black/10 rounded-full hover:bg-gray-50 transition-colors"
                        >
                          <FileText size={13} /> Oppdrag
                        </button>
                      )}

                      {/* Start job CTA */}
                      {canStart && app.order?._id && (
                        <button
                          onClick={() => navigate(`/provider/orders/${app.order._id}`)}
                          className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 bg-custom-green text-white rounded-full hover:bg-[#14532d] transition-colors"
                        >
                          <Play size={13} /> Start jobb <ArrowRight size={13} />
                        </button>
                      )}

                      {/* Continue work */}
                      {inProgress && app.order?._id && (
                        <button
                          onClick={() => navigate(`/provider/orders/${app.order._id}`)}
                          className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
                        >
                          <TrendingUp size={13} /> Fortsett arbeid
                        </button>
                      )}

                      {/* Ready for review */}
                      {readyReview && app.order?._id && (
                        <button
                          onClick={() => navigate(`/provider/orders/${app.order._id}`)}
                          className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
                        >
                          <CheckCircle2 size={13} /> Se detaljer
                        </button>
                      )}

                      {/* Withdraw — only if pending and no order yet */}
                      {app.status === 'pending' && !app.order && (
                        <button
                          onClick={() => {
                            if (confirm('Trekke tilbake søknaden?')) {
                              withdrawMutation.mutate(app._id, {
                                onSuccess: () => toast.success('Søknad trukket tilbake'),
                                onError: (e: any) => toast.error(e.response?.data?.error || 'Feil'),
                              });
                            }
                          }}
                          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 border border-red-200 text-red-500 rounded-full hover:bg-red-50 transition-colors ml-auto"
                        >
                          <X size={13} /> Trekk tilbake
                        </button>
                      )}
                    </div>
                  </div>
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
