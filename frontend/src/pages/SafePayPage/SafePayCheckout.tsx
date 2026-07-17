import React, { useState } from 'react';
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
  Apple,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/Ui/button/Button';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { useUserStore } from '../../stores/userStore';

const SafePayCheckout: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'vipps' | 'apple'>('card');

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

  // Check if current user is the customer (order owner)
  const isCustomer = String(order.customerId._id) === String(user?._id);

  if (!isCustomer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Ikke tilgang</h2>
        <p className="text-gray-600 mb-4">Kun oppdragsgiver kan gjøre betalinger.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-custom-green font-medium flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Gå tilbake
        </button>
      </div>
    );
  }

  const isPaid = ['paid', 'in_progress', 'completed'].includes(order.status);

  return (
    <div className="min-h-screen bg-[#f5f0e8] font-sans pb-12">
      <div className="max-w-[1024px] mx-auto px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Tilbake til søkere
        </button>

        {/* Steps Bar */}
        <SafePaySteps
          currentStep={isPaid ? 3 : 2}
          orderId={orderId}
          serviceId={order.serviceId._id}
        />

        {/* Parties Panel */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <Users size={18} className="text-custom-green" /> Avtale mellom
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="bg-[#f9f9f7] rounded-xl p-3.5 text-center">
              <div className="w-11 h-11 rounded-full bg-[#c8d8c8] text-[#1a3a1a] font-medium flex items-center justify-center text-[15px] mx-auto mb-2 overflow-hidden">
                {order.customerId.avatarUrl ? (
                  <img
                    src={order.customerId.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  order.customerId.name[0]
                )}
              </div>
              <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">
                Oppdragsgiver
              </div>
              <div className="text-[13px] font-medium text-gray-900 line-clamp-1">
                {order.customerId.name} {order.customerId.lastName}
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
                {order.providerId.avatarUrl ? (
                  <img
                    src={order.providerId.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  order.providerId.name[0]
                )}
              </div>
              <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">
                Oppdragstaker
              </div>
              <div className="text-[13px] font-medium text-gray-900 line-clamp-1">
                {order.providerId.name} {order.providerId.lastName}
              </div>
              <div className="text-[11px] text-[#ca8a04] mt-0.5">
                ★★★★★ {order.providerId.averageRating || '4.9'}
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
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">Sted</span>
              <span className="text-gray-900 font-medium">
                {order.serviceId.location?.city || 'Frogner, Oslo'}
              </span>
            </div>
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">Dato</span>
              <span className="text-gray-900 font-medium">Lørdag 24. mai 2026</span>
            </div>
            <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
              <span className="text-gray-400">Estimert tid</span>
              <span className="text-gray-900 font-medium">Ca. 2 timer</span>
            </div>
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

          {!isPaid ? (
            <>
              <div className="space-y-2.5 mb-4">
                {/* Card Method */}
                <div
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-2 border-custom-green bg-[#f0faf0]' : 'border-black/10 hover:bg-gray-50'}`}
                >
                  <div className="w-9 h-6 bg-[#1a1f71] text-white flex items-center justify-center text-[10px] font-bold rounded">
                    VISA
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-gray-900">Visa •••• 4242</div>
                    <div className="text-[11px] text-gray-400">Utløper 09/28</div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'card' ? 'border-custom-green' : 'border-gray-200'}`}
                  >
                    {paymentMethod === 'card' && (
                      <div className="w-2 h-2 rounded-full bg-custom-green"></div>
                    )}
                  </div>
                </div>

                {/* Vipps Method */}
                <div
                  onClick={() => setPaymentMethod('vipps')}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'vipps' ? 'border-2 border-custom-green bg-[#f0faf0]' : 'border-black/10 hover:bg-gray-50'}`}
                >
                  <div className="w-9 h-6 bg-[#ff5b24] text-white flex items-center justify-center text-[10px] font-bold rounded">
                    V
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-gray-900">Vipps</div>
                    <div className="text-[11px] text-gray-400">Betal med Vipps-appen</div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'vipps' ? 'border-custom-green' : 'border-gray-200'}`}
                  >
                    {paymentMethod === 'vipps' && (
                      <div className="w-2 h-2 rounded-full bg-custom-green"></div>
                    )}
                  </div>
                </div>

                {/* Apple Pay Method */}
                <div
                  onClick={() => setPaymentMethod('apple')}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'apple' ? 'border-2 border-custom-green bg-[#f0faf0]' : 'border-black/10 hover:bg-gray-50'}`}
                >
                  <div className="w-9 h-6 bg-black text-white flex items-center justify-center rounded">
                    <Apple size={14} fill="white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-gray-900">Apple Pay</div>
                    <div className="text-[11px] text-gray-400">Rask og sikker betaling</div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'apple' ? 'border-custom-green' : 'border-gray-200'}`}
                  >
                    {paymentMethod === 'apple' && (
                      <div className="w-2 h-2 rounded-full bg-custom-green"></div>
                    )}
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
                  {calculation.total} kr trekkes fra kortet ditt nå, men {order.providerId.name}{' '}
                  mottar kun {calculation.providerNet} kr etter at du godkjenner jobben. Ikke
                  fornøyd? Du kan opprette en tvist.
                </div>
              </div>

              <Button
                onClick={() => paymentMutation.mutate()}
                loading={paymentMutation.isPending}
                className="w-full bg-custom-green text-white rounded-full py-3.5 text-[15px] font-medium flex items-center justify-center gap-2 hover:bg-[#14532d] transition-colors shadow-lg"
              >
                <ShieldCheck size={18} /> Bekreft og betal {calculation.total} kr
              </Button>
            </>
          ) : (
            <div className="bg-[#f0faf0] border border-custom-green rounded-xl p-6 text-center">
              <CheckCircle2 size={40} className="text-custom-green mx-auto mb-3" />
              <h3 className="text-[16px] font-bold text-gray-900 mb-1">Betaling fullført</h3>
              <p className="text-[13px] text-gray-500 mb-4">
                Du har allerede betalt for dette oppdraget via SafePay.
              </p>
              <Button
                onClick={() => navigate(`/safepay/approval/${order._id}`)}
                className="w-full bg-custom-green text-white rounded-full py-3 font-bold"
              >
                Gå til godkjenning
              </Button>
            </div>
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
