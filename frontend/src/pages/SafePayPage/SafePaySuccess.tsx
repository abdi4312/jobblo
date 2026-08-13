import React, { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, Briefcase, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/Ui/button/Button';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import { useUserStore } from '../../stores/userStore';

// Order statuses that mean the money has been captured and is held in escrow.
const PAID_ORDER_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'completed'];

const SafePaySuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId');
  const sessionId = searchParams.get('session_id');
  const { user } = useUserStore();

  // Check payment status. This is the authoritative source: the backend retrieves the
  // session live from Stripe. Its response body MUST be read — the page previously
  // ignored it and rendered "Betaling bekreftet!" unconditionally.
  const {
    data: statusData,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
    isRefetching: isRefetchingStatus,
  } = useQuery({
    queryKey: ['safepay-status', sessionId],
    queryFn: async () => {
      const res = await mainLink.get(`/api/safepay-checkout/status/${sessionId}`);
      return res.data;
    },
    enabled: !!sessionId,
  });

  // Fetch order details so step 1 ("Velg søker") is reachable from the steps bar.
  // Also the fallback payment source: this page is reachable without a session_id
  // from ApplicantsPage and from step 3 of the SafePay steps bar.
  const {
    data: checkoutData,
    isLoading: orderLoading,
    isError: orderError,
  } = useQuery({
    queryKey: ['safepay-checkout', orderId],
    queryFn: async () => {
      const res = await mainLink.get(`/api/safepay-checkout/details/${orderId}`);
      return res.data;
    },
    enabled: !!orderId,
  });

  const order = checkoutData?.order;
  const serviceId = order?.serviceId?._id;

  const paymentState: 'verifying' | 'paid' | 'pending' | 'unverified' = useMemo(() => {
    if (statusLoading || orderLoading) return 'verifying';

    const paidBySession = statusData?.payment_status === 'paid';
    const paidByOrder =
      order?.paymentStatus === 'paid' || PAID_ORDER_STATUSES.includes(order?.status);
    if (paidBySession || paidByOrder) return 'paid';

    // A source answered and said "not paid yet" — genuinely pending.
    if (statusData?.payment_status || order) return 'pending';

    // Nothing could be checked: no params, or both lookups failed.
    return 'unverified';
  }, [statusLoading, orderLoading, statusData, order]);

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
    // Only shout when we genuinely could not check. A confirmed "not paid yet" is a
    // legitimate state with its own UI, not an error.
    if (paymentState === 'unverified' && (statusError || orderError)) {
      toast.error('Kunne ikke bekrefte betalingen');
    }
  }, [paymentState, statusError, orderError]);

  if (paymentState === 'verifying') {
    return (
      <div className="min-h-screen bg-[#f5f0e8] font-sans flex items-center justify-center py-12 px-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-custom-green"></div>
      </div>
    );
  }

  // ── Payment not confirmed ───────────────────────────────────────────────────
  // Never claim success we haven't verified. "pending" means a source told us the
  // payment isn't complete; "unverified" means we couldn't reach a source at all.
  if (paymentState !== 'paid') {
    const isPending = paymentState === 'pending';
    return (
      <div className="min-h-screen bg-[#f5f0e8] font-sans flex flex-col items-center py-12 px-6">
        <div className="max-w-[500px] w-full bg-white rounded-3xl p-8 text-center shadow-sm border border-black/5">
          <div className="w-20 h-20 bg-[#fff7ed] rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} className="text-amber-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isPending ? 'Betalingen er ikke fullført' : 'Vi fikk ikke bekreftet betalingen'}
          </h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {isPending
              ? 'Vi har ikke mottatt bekreftelse på betalingen ennå. Har du nettopp betalt, kan det ta noen sekunder — prøv å sjekke på nytt.'
              : 'Vi klarte ikke å hente betalingsstatusen. Ingen penger er trukket uten at du får bekreftelse. Sjekk på nytt, eller gå til betalingssiden for oppdraget.'}
          </p>

          <div className="flex flex-col gap-3">
            {sessionId && (
              <Button
                onClick={() => refetchStatus()}
                disabled={isRefetchingStatus}
                label={isRefetchingStatus ? 'Sjekker ...' : 'Sjekk på nytt'}
                className="w-full bg-custom-green text-white rounded-full py-3.5 font-bold hover:bg-[#14532d]"
              />
            )}
            {orderId && (
              <Button
                variant="outline"
                onClick={() => navigate(`/safepay/checkout/${orderId}`)}
                label="Gå til betaling"
                className="w-full border-black/10 text-gray-600 rounded-full py-3.5 font-bold hover:bg-gray-50"
              />
            )}
            <Button
              variant="outline"
              onClick={() => navigate('/home')}
              label="Tilbake til forsiden"
              className="w-full border-black/10 text-gray-600 rounded-full py-3.5 font-bold hover:bg-gray-50"
            />
          </div>
        </div>
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
