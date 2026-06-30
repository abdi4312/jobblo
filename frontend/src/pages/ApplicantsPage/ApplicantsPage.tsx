import React, { useEffect, useState } from 'react';
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

const ApplicantsPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [filterBy, setFilterBy] = useState<string>('notArchived');
  const [comparedApplicants, setComparedApplicants] = useState<string[]>([]);
  const { data, isLoading, error } = useApplicantsQuery(serviceId!, sortBy, filterBy);
  const createContractMutation = useCreateSafePayContractMutation();
  const toggleFavoriteMutation = useToggleApplicantFavoriteMutation(serviceId!);
  const toggleArchiveMutation = useToggleApplicantArchiveMutation(serviceId!);
  const declineMutation = useDeclineApplicantMutation(serviceId!);

  const activeOrder = data?.activeOrder;

  // Auto-redirect if we are beyond Step 1
  useEffect(() => {
    if (activeOrder) {
      if (activeOrder.status === 'awaiting_payment') {
        navigate(`/safepay/checkout/${activeOrder._id}`);
      } else if (['paid', 'in_progress'].includes(activeOrder.status)) {
        navigate(`/safepay/success?orderId=${activeOrder._id}`);
      } else if (activeOrder.status === 'completed') {
        navigate(`/safepay/approval/${activeOrder._id}`);
      }
    }
  }, [activeOrder, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-custom-green"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Kunne ikke laste søkere</h2>
        <button
          onClick={() => navigate(-1)}
          className="text-custom-green font-medium flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Gå tilbake
        </button>
      </div>
    );
  }

  const { service, applicants } = data;

  // Dynamic step based on active order status
  const currentStep = !activeOrder
    ? 1
    : activeOrder.status === 'awaiting_payment'
      ? 2
      : activeOrder.status === 'paid'
        ? 3
        : activeOrder.status === 'in_progress'
          ? 3
          : activeOrder.status === 'completed'
            ? 4
            : 1;

  const isJobAlreadyPaid =
    activeOrder && ['paid', 'in_progress', 'completed'].includes(activeOrder.status);
  const hasAwaitingPayment = activeOrder && activeOrder.status === 'awaiting_payment';

  const handleStartChat = async (applicantId: string) => {
    try {
      const chat = await createOrGetChat(applicantId, serviceId!);
      navigate(`/messages/${chat._id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Kunne ikke starte chat');
    }
  };

  const handleSelectApplicant = (applicantId: string, requestId: string) => {
    if (activeOrder) {
      toast.error('Dette oppdraget har allerede en aktiv kontrakt.');
      if (activeOrder.status === 'awaiting_payment') {
        navigate(`/safepay/checkout/${activeOrder._id}`);
      } else if (['paid', 'in_progress'].includes(activeOrder.status)) {
        navigate(`/safepay/success?orderId=${activeOrder._id}`);
      } else if (activeOrder.status === 'completed') {
        navigate(`/safepay/approval/${activeOrder._id}`);
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
    <div className="min-h-screen bg-[#f5f0e8] font-sans">
      {/* Main Content */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[13px] text-gray-500 hover:text-gray-800 transition-colors mb-5"
        >
          <ArrowLeft size={16} /> Tilbake til profil
        </button>

        {/* Steps Bar */}
        <SafePaySteps currentStep={currentStep} serviceId={serviceId} orderId={activeOrder?._id} />

        {/* Oppdrag Summary */}
        <div className="bg-[#1a3a1a] rounded-2xl p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <span className="flex items-center gap-1">
                <Clock size={12} /> Ca. 2 timer
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-medium text-[#4ade80]">{service.price} kr</div>
            <div className="text-[11px] text-white/50 uppercase tracking-wider">Oppdragsbeløp</div>
            <div className="bg-[#4ade80] text-[#1a3a1a] rounded-full px-3 py-1 text-[11px] font-medium inline-block mt-2">
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
                    <div className="w-10 h-10 rounded-full bg-[#c8d8c8] flex items-center justify-center overflow-hidden">
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
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <div className="font-bold">{app.applicant.responseTime}</div>
                      <div className="text-[10px] text-gray-500 uppercase">Svartid</div>
                    </div>
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
              <div className="flex gap-2">
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="text-[12px] text-gray-600 border border-black/15 rounded-full px-3 py-1 bg-white outline-none cursor-pointer"
                >
                  <option value="notArchived">Ikke arkivert</option>
                  <option value="favorites">Favoritter</option>
                  <option value="archived">Arkivert</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-[12px] text-gray-600 border border-black/15 rounded-full px-3 py-1 bg-white outline-none cursor-pointer"
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
                    className={`relative bg-white border rounded-2xl p-4 md:p-5 transition-all ${
                      app.favorite
                        ? 'border-2 border-yellow-300'
                        : app.archived
                          ? 'opacity-60'
                          : 'border-black/5'
                    }`}
                  >
                    {/* Top Right Buttons */}
                    <div className="absolute top-4 right-4 flex gap-1">
                      <button
                        onClick={() => handleToggleFavorite(app._id)}
                        className={`p-1 rounded-full transition-all ${
                          app.favorite
                            ? 'text-yellow-500 bg-yellow-100'
                            : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'
                        }`}
                        title="Favoritt"
                      >
                        <Heart size={18} fill={app.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => toggleCompare(app.applicant._id)}
                        className={`p-1 rounded-full transition-all ${
                          comparedApplicants.includes(app.applicant._id)
                            ? 'text-custom-green bg-green-100'
                            : 'text-gray-400 hover:text-custom-green hover:bg-gray-100'
                        }`}
                        title="Sammenlign"
                      >
                        <Users size={18} />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(app._id)}
                        className={`p-1 rounded-full transition-all ${
                          app.archived
                            ? 'text-custom-green bg-green-100'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        title={app.archived ? 'Gjenopprett fra arkiv' : 'Arkiver'}
                      >
                        <Archive size={18} />
                      </button>
                      <button
                        onClick={() => handleDecline(app._id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-all"
                        title="Avslå søker"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-[#c8d8c8] text-[#1a3a1a] font-medium flex items-center justify-center text-lg overflow-hidden">
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
                            <div className="flex text-[#ca8a04]">
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

                      <div className="flex gap-6 overflow-x-auto pb-1">
                        <div className="text-center">
                          <div className="text-[15px] font-medium text-gray-900">
                            {app.applicant.completedJobs}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase">Fullførte</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[15px] font-medium text-gray-900">
                            {app.applicant.rating}★
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase">Rating</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[15px] font-medium text-gray-900">
                            {app.applicant.responseRate}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase">Svar%</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[15px] font-medium text-gray-900">
                            {app.applicant.responseTime}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase">Svartid</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#f9f9f7] rounded-xl p-3 my-4 border-l-[3px] border-custom-green">
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-1">
                        <MessageCircle size={12} /> Melding fra søker
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed">{app.message}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                        className={`bg-custom-green text-white rounded-full py-2.5 text-[13px] font-medium h-auto shadow-sm hover:bg-[#266b3c] ${activeOrder ? 'opacity-70' : ''}`}
                      />
                      <Button
                        variant="outline"
                        label="Velg uten SafePay"
                        disabled={!!activeOrder}
                        className="px-4 border-black/20 rounded-full py-2.5 text-[13px] font-medium h-auto hover:bg-gray-50"
                        onClick={() => {
                          toast.success('Bruker valgt uten SafePay');
                        }}
                      />
                      <Button
                        variant="outline"
                        label="Send melding"
                        icon={<MessageCircle size={16} />}
                        className="px-4 border-black/20 rounded-full py-2.5 text-[13px] font-medium h-auto hover:bg-gray-50"
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
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-custom-green mt-1"></div>
                    <div className="w-[1px] flex-1 bg-black/10 my-1 min-h-[30px]"></div>
                  </div>
                  <div className="pb-5">
                    <div className="text-[13px] font-bold text-gray-900 leading-tight">
                      Velg en søker
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Du er her nå</div>
                  </div>
                </div>
                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200 mt-1"></div>
                    <div className="w-[1px] flex-1 bg-black/10 my-1 min-h-[30px]"></div>
                  </div>
                  <div className="pb-5">
                    <div className="text-[13px] font-bold text-gray-900 leading-tight">
                      Start SafePay
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Kontrakt genereres automatisk
                    </div>
                  </div>
                </div>
                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200 mt-1"></div>
                    <div className="w-[1px] flex-1 bg-black/10 my-1 min-h-[30px]"></div>
                  </div>
                  <div className="pb-5">
                    <div className="text-[13px] font-bold text-gray-900 leading-tight">
                      Jobben utføres
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(service.date).toLocaleDateString('no-NO', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </div>
                  </div>
                </div>
                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200 mt-1"></div>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-gray-900 leading-tight">
                      Godkjenn og utbetal
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {Math.round(service.price * 0.97)} kr til oppdragstaker
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SafePay Info */}
            <div className="bg-white border border-black/5 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-900 mb-4">
                <ShieldCheck size={16} className="text-custom-green" /> SafePay beskytter deg
              </div>
              <div className="bg-[#f0faf0] rounded-xl p-3 mb-3">
                <p className="text-[12px] text-[#166534] leading-relaxed">
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
                  <strong className="text-gray-900">{Math.round(service.price * 0.03)} kr</strong>
                </div>
                <div className="flex justify-between">
                  <span>Utbetalt til søker:</span>
                  <strong className="text-custom-green">
                    {Math.round(service.price * 0.97)} kr
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
