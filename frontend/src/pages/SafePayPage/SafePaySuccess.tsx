import React, { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, Briefcase } from 'lucide-react';
import { Button } from '../../components/Ui/button/Button';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import { useUserStore } from '../../stores/userStore';

const SafePaySuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId');
  const sessionId = searchParams.get('session_id');
  const { user } = useUserStore();

  // Check payment status
  const { isLoading, error } = useQuery({
    queryKey: ['safepay-status', sessionId],
    queryFn: async () => {
      if (!sessionId) return;
      const res = await mainLink.get(`/api/safepay-checkout/status/${sessionId}`);
      return res.data;
    },
    enabled: !!sessionId,
  });

  // Fetch order details so step 1 ("Velg søker") is reachable from the steps bar
  const { data: checkoutData, isLoading: orderLoading } = useQuery({
    queryKey: ['safepay-checkout', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await mainLink.get(`/api/safepay-checkout/details/${orderId}`);
      return res.data;
    },
    enabled: !!orderId,
  });

  const serviceId = checkoutData?.order?.serviceId?._id;

  // ponytail: resolve viewer role from loaded order once.
  // SafePaySuccess can be hit both as customer (after payment) and as provider
  // (coming back to an order after payment). Providers must not see customer-only
  // CTAs like "Godkjenn jobb".
  const { isCustomer, isProvider, providerName } = useMemo(() => {
    const order = checkoutData?.order;
    if (!order || !user) return { isCustomer: false, isProvider: false, providerName: '' };
    const uid = String(user._id);
    return {
      isCustomer: String(order.customerId?._id ?? order.customerId) === uid,
      isProvider: String(order.providerId?._id ?? order.providerId) === uid,
      providerName: order.providerId?.name ?? '',
    };
  }, [checkoutData, user]);

  useEffect(() => {
    if (error) {
      toast.error('Kunne ikke bekrefte betalingen');
    }
  }, [error]);

  if (isLoading || orderLoading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] font-sans flex items-center justify-center py-12 px-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-custom-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] font-sans flex flex-col items-center py-12 px-6">
      <div className="max-w-[1024px] w-full mb-12">
        <SafePaySteps currentStep={3} orderId={orderId || undefined} serviceId={serviceId} />
      </div>

      <div className="max-w-[500px] w-full bg-white rounded-3xl p-8 text-center shadow-sm border border-black/5">
        <div className="w-20 h-20 bg-[#f0faf0] rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-custom-green" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Betaling bekreftet!</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {isProvider
            ? 'Jobben er nå betalt via SafePay. Du kan starte arbeidet når du er klar.'
            : 'Takk for din betaling. Pengene er nå trygt lagret hos SafePay og vil bli utbetalt til søkeren når jobben er utført og godkjent av deg.'}
        </p>

        <div className="bg-[#f9f9f7] rounded-2xl p-4 mb-8 flex items-center gap-3 text-left">
          <ShieldCheck size={24} className="text-custom-green shrink-0" />
          <div>
            <div className="text-[13px] font-bold text-gray-900">SafePay Beskyttelse</div>
            <div className="text-[11px] text-gray-500">
              Jobblo holder beløpet sikkert frem til godkjenning.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Provider CTA — takes them to the active work page (BUG-005 fix) */}
          {isProvider && orderId && (
            <Button
              onClick={() => navigate(`/provider/orders/${orderId}`)}
              label="Gå til aktiv jobb"
              className="w-full bg-custom-green text-white rounded-full py-3.5 font-bold hover:bg-[#14532d] flex items-center justify-center gap-2"
              icon={<Briefcase size={18} />}
            />
          )}

          {/* Customer CTAs — only visible to actual customer */}
          {isCustomer && orderId && (
            <Button
              onClick={() => navigate(`/safepay/approval/${orderId}`)}
              label="Godkjenn jobb og utbetal"
              className="w-full bg-custom-green text-white rounded-full py-3.5 font-bold hover:bg-[#14532d]"
            />
          )}

          {/* Neutral fallback when role hasn't resolved or user is 3rd party */}
          {!isCustomer && !isProvider && orderId && (
            <Button
              variant="outline"
              onClick={() => navigate('/home')}
              label="Tilbake til forsiden"
              className="w-full border-black/10 text-gray-600 rounded-full py-3.5 font-bold hover:bg-gray-50"
            />
          )}

          {(isCustomer || isProvider) && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/my-applicants')}
                label={isProvider ? 'Mine søknader' : 'Mine søkere'}
                className="w-full border-black/10 text-gray-600 rounded-full py-3.5 font-bold hover:bg-gray-50"
              />
              <Button
                variant="outline"
                onClick={() => navigate('/home')}
                label="Tilbake til forsiden"
                className="w-full border-black/10 text-gray-600 rounded-full py-3.5 font-bold hover:bg-gray-50"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SafePaySuccess;
