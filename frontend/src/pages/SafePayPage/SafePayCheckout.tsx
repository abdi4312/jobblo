import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Users,
  FileText,
  ShieldCheck,
  Info,
  Lock,
  CreditCard,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/Ui/button/Button';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { useUserStore } from '../../stores/userStore';
import { dateFormatter } from '../../utils/dateFormatter';
import { timeFormatter } from '../../utils/timeFormatter';

const SafePayCheckout: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();

  // Fetch Checkout Details from new backend
  const { data, isLoading, error } = useQuery({
    queryKey: ['safepay-checkout', orderId],
    queryFn: async () => {
      const res = await mainLink.get(`/api/safepay-checkout/details/${orderId}`);
      return res.data;
    },
    enabled: !!orderId,
  });

  // Stripe Payment Mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      const res = await mainLink.post('/api/safepay-checkout/create-session', {
        orderId,
      });
      return res.data;
    },
    onSuccess: (res) => {
      if (res.url) {
        window.location.href = res.url;
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Kunne ikke starte betalingen');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f0e8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-custom-green"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Kunne ikke laste betalingsinformasjon
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="text-custom-green font-medium flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Gå tilbake
        </button>
      </div>
    );
  }

  const { order, calculation } = data;

  // Check roles
  const isCustomer = String(order.customerId?._id) === String(user?._id);
  const isProvider = String(order.providerId?._id) === String(user?._id);

  // Provider should not see the checkout/payment page — redirect to their work page
  if (isProvider && !isCustomer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-4">
        <div className="max-w-[420px] w-full bg-white rounded-2xl p-8 text-center shadow-sm border border-black/5">
          <div className="w-14 h-14 bg-[#f0faf0] rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={28} className="text-custom-green" />
          </div>
          <h2 className="text-[18px] font-bold text-gray-900 mb-2">Kontrakt og betaling</h2>
          <p className="text-[13px] text-gray-500 mb-6">
            Betaling håndteres av oppdragsgiver. Du kan se oppdragets status og starte arbeid fra din arbeidsside.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => navigate(`/provider/orders/${orderId}`)}
              className="w-full bg-custom-green text-white rounded-full py-3 font-bold hover:bg-[#14532d]"
            >
              Gå til mitt oppdrag
            </Button>
            <button
              onClick={() => navigate(-1)}
              className="text-[13px] text-gray-400 hover:text-gray-600 mt-1"
            >
              Gå tilbake
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isCustomer && !isProvider) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Ikke tilgang</h2>
        <button onClick={() => navigate(-1)} className="text-custom-green font-medium flex items-center gap-2">
          <ArrowLeft size={18} /> Gå tilbake
        </button>
      </div>
    );
  }

  const isPaid = ['paid', 'in_progress', 'completed'].includes(order.status);

  // (F-38) Contract facts derived from the real job, or null so the row is omitted.
  // Nothing on this panel may be invented — it is presented as a binding contract.
  const { fromDate, toDate, duration } = order.serviceId;
  const contractDate = fromDate
    ? toDate && new Date(toDate).toDateString() !== new Date(fromDate).toDateString()
      ? `${dateFormatter.toLongDate(fromDate)} – ${dateFormatter.toLongDate(toDate)}`
      : dateFormatter.toLongDate(fromDate)
    : null;
  const contractDuration = timeFormatter.toJobDuration(duration);

  return (
    <div className="min-h-screen bg-[#f5f0e8] font-sans pb-12">
      <div className="max-w-[1024px] mx-auto px-6 py-8">
        <button
          onClick={() =>
            navigate(`/job-applicants/${order.serviceId?._id}`, {
              state: { fromSteps: true },
            })
          }
          className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Tilbake til søkere
        </button>

        {/* Steps Bar - this page is always step 2 (Kontrakt og betaling) */}
        <SafePaySteps
          currentStep={2}
          orderId={orderId}
          serviceId={order.serviceId?._id}
        />

        {/* Parties Panel */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <Users size={18} className="text-custom-green" /> Avtale mellom
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="bg-[#f9f9f7] rounded-xl p-3.5 text-center">
              <div className="w-11 h-11 rounded-full bg-[#c8d8c8] text-[#1a3a1a] font-medium flex items-center justify-center text-[15px] mx-auto mb-2 overflow-hidden">
                {order.customerId?.avatarUrl ? (
                  <img
                    src={order.customerId?.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  order.customerId?.name?.[0] || '?'
                )}
              </div>
              <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">
                Oppdragsgiver
              </div>
              <div className="text-[13px] font-medium text-gray-900 line-clamp-1">
                {order.customerId?.name || 'Ukjent'} {order.customerId?.lastName || ''}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck size={20} className="text-custom-green" />
              <span className="text-[10px] text-custom-green font-bold uppercase tracking-widest">
                SafePay
              </span>
            </div>
            <div className="bg-[#f9f9f7] rounded-xl p-3.5 text-center">
              <div className="w-11 h-11 rounded-full bg-[#c8d8c8] text-[#1a3a1a] font-medium flex items-center justify-center text-[15px] mx-auto mb-2 overflow-hidden">
                {order.providerId?.avatarUrl ? (
                  <img
                    src={order.providerId?.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  order.providerId?.name?.[0] || '?'
                )}
              </div>
              <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">
                Oppdragstaker
              </div>
              <div className="text-[13px] font-medium text-gray-900 line-clamp-1">
                {order.providerId?.name || 'Ukjent'} {order.providerId?.lastName || ''}
              </div>
              {/* (F-38) Was `averageRating || '4.9'` — an invented rating for every
                  provider who had none, on the screen where the customer commits money. */}
              <div className="text-[11px] text-[#ca8a04] mt-0.5">
                {order.providerId?.averageRating > 0 ? (
                  <>★ {order.providerId?.averageRating}</>
                ) : (
                  <span className="text-gray-400">Ingen vurderinger ennå</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contract Panel */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <FileText size={18} className="text-custom-green" /> Digital kontrakt — generert
            automatisk
          </div>
          <div className="bg-[#f9f9f7] border border-black/5 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">Oppdrag</span>
              <span className="text-gray-900 font-medium">{order.serviceId.title}</span>
            </div>
            {/* (F-38) Every row below now renders real order data or is omitted.
                These previously showed a hardcoded city, date and duration on a panel
                that calls itself "juridisk bindende". */}
            {order.serviceId.location?.city && (
              <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
                <span className="text-gray-400">Sted</span>
                <span className="text-gray-900 font-medium">
                  {order.serviceId.location.city}
                </span>
              </div>
            )}
            {contractDate && (
              <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
                <span className="text-gray-400">Dato</span>
                <span className="text-gray-900 font-medium">{contractDate}</span>
              </div>
            )}
            {contractDuration && (
              <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
                <span className="text-gray-400">Estimert tid</span>
                <span className="text-gray-900 font-medium">{contractDuration}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">Oppdragsbeløp</span>
              <span className="text-gray-900 font-medium">{calculation.basePrice} kr</span>
            </div>
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">Betalingsmetode</span>
              <span className="text-gray-900 font-medium">SafePay (holdes til godkjenning)</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-400">Kontrakt-ID</span>
              <span className="text-gray-900 font-medium">
                #JB-{order._id.substring(0, 8).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-4 text-[11px] text-gray-400 leading-relaxed">
            <Info size={13} className="text-custom-green flex-shrink-0 mt-0.5" />
            <p>
              Kontrakten sendes til begge parter på e-post og lagres under "Kontrakt" i menyen. Den
              er juridisk bindende og beskytter deg ved eventuell tvist.
            </p>
          </div>
        </div>

        {/* Payment Panel */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <CreditCard size={18} className="text-custom-green" /> Betaling
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">Oppdragsbeløp</span>
              <span
                className={`text-gray-900 font-medium ${isPaid ? 'line-through opacity-50' : ''}`}
              >
                {calculation.basePrice} kr
              </span>
            </div>
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">SafePay-gebyr (3%)</span>
              <span
                className={`text-gray-900 font-medium ${isPaid ? 'line-through opacity-50' : ''}`}
              >
                {calculation.fee} kr
              </span>
            </div>
            <div className="flex justify-between text-[15px] pt-2">
              <span className="text-gray-900 font-bold">Totalt å betale nå</span>
              <span className="text-custom-green font-bold">
                {isPaid ? 'Fullført' : `${calculation.total} kr`}
              </span>
            </div>
          </div>

          {/* (F-38) The saved "Visa •••• 4242 / Utløper 09/28" was a hardcoded Stripe
              test card presented as the user's own, and the Vipps and Apple Pay options
              only set local state — createSafePaySession is unconditionally
              payment_method_types: ['card']. Offering Vipps to Norwegian customers and
              then silently charging a card is a trust problem, so the panel now states
              plainly what the next step actually does. Re-add options here only once
              the backend passes the chosen method through to Stripe. */}
          <div className="space-y-2.5 mb-4">
                <div className="flex items-center gap-3 p-3 border border-black/10 rounded-xl">
                  <div className="w-9 h-6 bg-gray-900 text-white flex items-center justify-center rounded">
                    <CreditCard size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-gray-900">Kort</div>
                    <div className="text-[11px] text-gray-400">
                      Du fullfører betalingen sikkert hos Stripe i neste steg.
                    </div>
                  </div>
                </div>
              </div>

              {/* SafePay Explanation Banner */}
              <div className="bg-[#f0faf0] border border-[#c6f0d8] rounded-xl p-4 flex gap-3 mb-4.5">
                <Lock size={20} className="text-custom-green flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-[#166534] leading-relaxed">
                  <strong className="block mb-0.5 text-[13px]">
                    Pengene holdes trygt av Jobblo
                  </strong>
                  {calculation.total} kr trekkes fra kortet ditt nå, men {order.providerId?.name || 'oppdragstakeren'}{' '}
                  mottar kun {calculation.providerNet} kr etter at du godkjenner jobben. Ikke
                  fornøyd? Du kan opprette en tvist.
                </div>
              </div>

              <Button
                onClick={() => paymentMutation.mutate()}
                loading={paymentMutation.isPending}
                disabled={isPaid}
                className="w-full bg-custom-green text-white rounded-full py-3.5 text-[15px] font-medium flex items-center justify-center gap-2 hover:bg-[#14532d] transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPaid ? (
                  <>
                    <CheckCircle2 size={18} /> Betaling fullført
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> Bekreft og betal {calculation.total} kr
                  </>
                )}
              </Button>

              {isPaid && (
                <button
                  onClick={() => navigate(`/safepay/approval/${order._id}`)}
                  className="w-full text-center text-[13px] text-custom-green font-medium mt-3 hover:underline"
                >
                  Gå til godkjenning
                </button>
              )}

          <p className="text-center text-[11px] text-gray-400 mt-4.5 leading-relaxed">
            Ved å bekrefte godtar du{' '}
            <a href="#" className="text-custom-green hover:underline">
              Jobblos vilkår
            </a>{' '}
            og{' '}
            <a href="#" className="text-custom-green hover:underline">
              SafePay-avtalen
            </a>
            .<br />
            Betalingen er sikret med SSL-kryptering.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-[680px] mx-auto border-t border-black/5 px-6 py-6 flex justify-between items-center mt-4">
        <div className="flex gap-5 text-[12px] text-gray-400">
          <a href="#" className="hover:text-gray-600">
            Kundesenter
          </a>
          <a href="#" className="hover:text-gray-600">
            Personvern
          </a>
          <a href="#" className="hover:text-gray-600">
            Vilkår for bruk
          </a>
          <a href="#" className="hover:text-gray-600">
            Om oss
          </a>
        </div>
        <div className="text-[12px] text-gray-400">© Jobblo AS 2026</div>
      </footer>
    </div>
  );
};

export default SafePayCheckout;
