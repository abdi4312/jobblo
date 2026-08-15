import React, { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Briefcase, AlertCircle, Loader2 } from 'lucide-react';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import { useUserStore } from '../../stores/userStore';
import { CARD, MICRO_LABEL } from '../../theme/brand';

// Order statuses that mean the money has been captured and is held in escrow.
const PAID_ORDER_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'completed'];

const SOLID =
  'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2E6641] text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-[0.995] disabled:opacity-60';

const OUTLINE =
  'flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#E6E7E1] bg-white text-[0.9375rem] font-medium text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15';

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

  // SafePaySuccess can be hit both as customer (after payment) and as provider (coming
  // back to an order after payment). Providers must not see customer-only CTAs.
  const { isCustomer, isProvider } = useMemo(() => {
    if (!order || !user) return { isCustomer: false, isProvider: false };
    const uid = String(user._id);
    return {
      isCustomer: String(order.customerId?._id ?? order.customerId) === uid,
      isProvider: String(order.providerId?._id ?? order.providerId) === uid,
    };
  }, [order, user]);

  useEffect(() => {
    // Only shout when we genuinely could not check. A confirmed "not paid yet" is a
    // legitimate state with its own UI, not an error.
    if (paymentState === 'unverified' && (statusError || orderError)) {
      toast.error('Kunne ikke bekrefte betalingen');
    }
  }, [paymentState, statusError, orderError]);

  if (paymentState === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] px-6">
        <p className="flex items-center gap-2.5 text-[0.9375rem] text-[#63665F]">
          <Loader2 size={17} className="animate-spin text-[#2E6641]" />
          Bekrefter betalingen…
        </p>
      </div>
    );
  }

  // ── Payment not confirmed ───────────────────────────────────────────────────
  // Never claim success we haven't verified. "pending" means a source told us the
  // payment isn't complete; "unverified" means we couldn't reach a source at all.
  if (paymentState !== 'paid') {
    const isPending = paymentState === 'pending';
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] px-4 py-12">
        <div className={`${CARD} w-full max-w-md p-8 text-center sm:p-10`}>
          <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-[#F4F6F0] text-[#63665F]">
            <AlertCircle size={22} strokeWidth={2} />
          </span>
          <h1 className="text-[1.25rem] font-bold tracking-[-0.03em] text-[#0B0B0B]">
            {isPending ? 'Betalingen er ikke fullført' : 'Vi fikk ikke bekreftet betalingen'}
          </h1>
          <p className="mx-auto mt-2.5 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
            {isPending
              ? 'Vi har ikke mottatt bekreftelse på betalingen ennå. Har du nettopp betalt, kan det ta noen sekunder — prøv å sjekke på nytt.'
              : 'Vi klarte ikke å hente betalingsstatusen. Ingen penger er trukket uten at du får bekreftelse. Sjekk på nytt, eller gå til betalingssiden for oppdraget.'}
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            {sessionId && (
              <button
                onClick={() => refetchStatus()}
                disabled={isRefetchingStatus}
                className={SOLID}
              >
                {isRefetchingStatus && <Loader2 size={16} className="animate-spin" />}
                {isRefetchingStatus ? 'Sjekker…' : 'Sjekk på nytt'}
              </button>
            )}
            {orderId && (
              <button
                onClick={() => navigate(`/safepay/checkout/${orderId}`)}
                className={OUTLINE}
              >
                Gå til betaling
              </button>
            )}
            <button onClick={() => navigate('/home')} className={OUTLINE}>
              Tilbake til forsiden
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The customer may only approve once the provider has marked the job ready — the
  // backend refuses anything else with "Utfører må melde jobben som ferdig først". The
  // page used to offer "Godkjenn jobb og utbetal" the instant payment cleared, which sent
  // the customer to the approval screen for a job nobody had started, to be turned away
  // there. The CTA now follows the order's actual state.
  const readyForApproval = order?.status === 'ready_for_review';
  const isCompleted = order?.status === 'completed';

  return (
    <div className="min-h-screen bg-[#EFF0EA] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <SafePaySteps currentStep={3} orderId={orderId || undefined} serviceId={serviceId} />

        <div className={`${CARD} mx-auto max-w-lg p-8 text-center sm:p-10`}>
          <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
            <CheckCircle2 size={22} strokeWidth={2} />
          </span>

          <p className={MICRO_LABEL}>SafePay</p>
          <h1 className="mt-2 text-[1.5rem] font-bold tracking-[-0.035em] text-[#0B0B0B]">
            Betalingen er bekreftet
          </h1>
          <p className="mx-auto mt-2.5 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
            {isProvider
              ? 'Oppdraget er betalt via SafePay. Du kan starte arbeidet når du er klar.'
              : 'Beløpet holdes av Jobblo og utbetales til utføreren når arbeidet er gjort og du har godkjent det.'}
          </p>

          <div className="mt-7 flex items-center gap-3 rounded-2xl bg-[#F4F6F0] p-4 text-left">
            <ShieldCheck size={20} strokeWidth={2} className="shrink-0 text-[#2E6641]" />
            <div>
              <p className="text-[0.8125rem] font-semibold text-[#0B0B0B]">SafePay-beskyttelse</p>
              <p className="mt-0.5 text-[0.75rem] leading-relaxed text-[#63665F]">
                Jobblo holder beløpet frem til du godkjenner.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2.5">
            {isProvider && orderId && (
              <button
                onClick={() => navigate(`/provider/orders/${orderId}`)}
                className={SOLID}
              >
                <Briefcase size={16} strokeWidth={2} />
                Gå til aktiv jobb
              </button>
            )}

            {isCustomer && orderId && !readyForApproval && !isCompleted && (
              <p className="rounded-2xl bg-[#F4F6F0] px-4 py-3 text-[0.8125rem] leading-relaxed text-[#63665F]">
                Neste steg er utførerens. Du kan godkjenne og utbetale så snart arbeidet er meldt
                ferdig — vi varsler deg.
              </p>
            )}

            {isCustomer && orderId && (readyForApproval || isCompleted) && (
              <button onClick={() => navigate(`/safepay/approval/${orderId}`)} className={SOLID}>
                {isCompleted ? 'Se oppsummeringen' : 'Godkjenn jobb og utbetal'}
              </button>
            )}

            {(isCustomer || isProvider) && (
              <button
                onClick={() => navigate('/my-applicants')}
                // The only action a customer has while waiting, so it carries the weight
                // here and steps down to a secondary once approval is actually available.
                className={isCustomer && !readyForApproval && !isCompleted ? SOLID : OUTLINE}
              >
                {isProvider ? 'Mine søknader' : 'Mine søkere'}
              </button>
            )}

            <button onClick={() => navigate('/home')} className={OUTLINE}>
              Tilbake til forsiden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafePaySuccess;
