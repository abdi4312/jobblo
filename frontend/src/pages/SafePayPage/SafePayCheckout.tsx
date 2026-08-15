import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Users,
  FileText,
  ShieldCheck,
  Lock,
  CreditCard,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import { toast } from 'react-hot-toast';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { useUserStore } from '../../stores/userStore';
import { dateFormatter } from '../../utils/dateFormatter';
import { timeFormatter } from '../../utils/timeFormatter';
import { BackLink } from '../../components/Ui/BackLink';
import { CARD, MICRO_LABEL } from '../../theme/brand';

/**
 * Step 2 of SafePay: the contract, and the payment that commits to it.
 *
 * Everything on this page is presented to the customer as a binding agreement, so nothing
 * here may be invented — the rows below render real order data or are omitted entirely.
 */

/**
 * Order states in which money has already been taken.
 *
 * This list used to be `['paid', 'in_progress', 'completed']`, missing `ready_for_review`,
 * `disputed` and `refunded`. On an order sitting at ready-for-review the page therefore
 * re-armed "Bekreft og betal 2 575 kr" as a live button on an order that was paid weeks
 * ago. The server does refuse the second session with a 409, so no one was charged twice
 * — but the customer was shown a payment button for a bill they had already settled and
 * got an error for pressing it. `paymentStatus` is checked alongside, since that is the
 * field the backend guards on first.
 */
const SETTLED_STATUSES = [
  'paid',
  'in_progress',
  'ready_for_review',
  'completed',
  'disputed',
  'refunded',
];

const kr = (value?: number) =>
  typeof value === 'number' ? `${value.toLocaleString('nb-NO')} kr` : '—';

const Row = ({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-[#E6E7E1] py-2.5 last:border-b-0 last:pb-0">
    <span className="shrink-0 text-[0.8125rem] text-[#63665F]">{label}</span>
    <span
      className={`text-right text-[0.875rem] ${
        strong ? 'font-semibold text-[#0B0B0B]' : 'text-[#0B0B0B]'
      }`}
    >
      {children}
    </span>
  </div>
);

const Party = ({
  role,
  name,
  avatarUrl,
  rating,
}: {
  role: string;
  name: string;
  avatarUrl?: string;
  rating?: number;
}) => (
  <div className="rounded-2xl bg-[#F4F6F0] p-4 text-center">
    <span className="mx-auto mb-2 flex size-11 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] text-[0.9375rem] font-semibold text-[#2E6641]">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        (name?.[0] || '?').toUpperCase()
      )}
    </span>
    <p className={MICRO_LABEL}>{role}</p>
    <p className="mt-1 line-clamp-1 text-[0.875rem] font-semibold text-[#0B0B0B]">{name}</p>
    {rating !== undefined && (
      /* Was `averageRating || '4.9'` — an invented rating for every provider who had
         none, on the screen where the customer commits money. */
      <p className="mt-0.5 text-[0.75rem] text-[#63665F]">
        {rating > 0 ? `★ ${rating}` : <span className="text-[#9B9E96]">Ingen vurderinger ennå</span>}
      </p>
    )}
  </div>
);

const Centered = ({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] p-4">
    <div className={`${CARD} w-full max-w-md p-10 text-center`}>
      <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
        <ShieldCheck size={20} strokeWidth={2} />
      </span>
      <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">{title}</p>
      {body && (
        <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
          {body}
        </p>
      )}
      {children}
    </div>
  </div>
);

const SafePayCheckout: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['safepay-checkout', orderId],
    queryFn: async () => {
      const res = await mainLink.get(`/api/safepay-checkout/details/${orderId}`);
      return res.data;
    },
    enabled: !!orderId,
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const res = await mainLink.post('/api/safepay-checkout/create-session', { orderId });
      return res.data;
    },
    onSuccess: (res) => {
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      // Without this the button simply stopped spinning and nothing happened — a silent
      // dead end on the one action this page exists for.
      toast.error('Fikk ingen betalingslenke fra Stripe. Prøv igjen.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Kunne ikke starte betalingen');
      // A 409 means the server's view of the order has moved on (already paid, service
      // gone). Re-reading it puts the page back in step with reality instead of leaving
      // a stale payment button on screen.
      if (err?.response?.status === 409) refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EFF0EA]">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <div className="jb-skeleton h-4 w-24 rounded" />
          <div className="jb-skeleton mt-8 h-14 w-full rounded-2xl" />
          <div className="jb-skeleton mt-4 h-44 w-full rounded-3xl" />
          <div className="jb-skeleton mt-4 h-72 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !data?.order || !data?.calculation) {
    return (
      <Centered
        title="Kunne ikke laste betalingsinformasjon"
        body="Sjekk internettforbindelsen din og prøv igjen."
      >
        <button
          onClick={() => refetch()}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
        >
          Prøv igjen
        </button>
      </Centered>
    );
  }

  const { order, calculation } = data;
  const service = order.serviceId;

  // The service is populated by the endpoint, but comes back null if the underlying job
  // was deleted. Reading `service.title` and destructuring its dates unguarded made that
  // a white screen rather than a message.
  if (!service) {
    return (
      <Centered
        title="Oppdraget finnes ikke lenger"
        body="Oppdraget denne kontrakten gjelder er slettet, så betalingen kan ikke gjennomføres. Ta kontakt med support hvis dette ser feil ut."
      >
        <Link
          to="/support"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
        >
          Kontakt support
        </Link>
      </Centered>
    );
  }

  const isCustomer = String(order.customerId?._id) === String(user?._id);
  const isProvider = String(order.providerId?._id) === String(user?._id);

  if (isProvider && !isCustomer) {
    return (
      <Centered
        title="Betaling håndteres av oppdragsgiver"
        body="Du kan følge oppdragets status og starte arbeidet fra din egen arbeidsside."
      >
        <button
          onClick={() => navigate(`/provider/orders/${orderId}`)}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
        >
          Gå til mitt oppdrag
        </button>
      </Centered>
    );
  }

  if (!isCustomer && !isProvider) {
    return <Centered title="Ikke tilgang" body="Denne kontrakten tilhører andre parter." />;
  }

  const isPaid =
    order.paymentStatus === 'paid' || SETTLED_STATUSES.includes(order.status);

  const { fromDate, toDate, duration } = service;
  const contractDate = fromDate
    ? toDate && new Date(toDate).toDateString() !== new Date(fromDate).toDateString()
      ? `${dateFormatter.toLongDate(fromDate)} – ${dateFormatter.toLongDate(toDate)}`
      : dateFormatter.toLongDate(fromDate)
    : null;
  const contractDuration = timeFormatter.toJobDuration(duration);

  return (
    <div className="min-h-screen bg-[#EFF0EA] pb-16">
      <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
        <BackLink
          label="Tilbake til søkere"
          fallback={service._id ? `/job-applicants/${service._id}` : '/my-applicants'}
        />

        <header className="mb-8 mt-6">
          <p className={MICRO_LABEL}>SafePay</p>
          <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
            Kontrakt og betaling
          </h1>
          <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-[#63665F]">
            Beløpet trekkes nå og holdes av Jobblo til du har godkjent arbeidet.
          </p>
        </header>

        <SafePaySteps currentStep={2} orderId={orderId} serviceId={service._id} />

        {/* ── Parter ───────────────────────────────────────────────────────── */}
        <section className={`${CARD} mb-4 p-5 sm:p-6`}>
          <h2 className="mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
            <Users size={16} strokeWidth={2} className="text-[#2E6641]" />
            Avtale mellom
          </h2>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Party
              role="Oppdragsgiver"
              name={`${order.customerId?.name || 'Ukjent'} ${order.customerId?.lastName || ''}`.trim()}
              avatarUrl={order.customerId?.avatarUrl}
            />
            <div className="flex flex-col items-center gap-1 px-1">
              <ShieldCheck size={18} className="text-[#2E6641]" />
              <span className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[#2E6641]">
                SafePay
              </span>
            </div>
            <Party
              role="Oppdragstaker"
              name={`${order.providerId?.name || 'Ukjent'} ${order.providerId?.lastName || ''}`.trim()}
              avatarUrl={order.providerId?.avatarUrl}
              rating={order.providerId?.averageRating ?? 0}
            />
          </div>
        </section>

        {/* ── Kontrakt ─────────────────────────────────────────────────────── */}
        <section className={`${CARD} mb-4 p-5 sm:p-6`}>
          <h2 className="mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
            <FileText size={16} strokeWidth={2} className="text-[#2E6641]" />
            Digital kontrakt
          </h2>

          <div className="rounded-2xl bg-[#F4F6F0] px-4 py-1">
            <Row label="Oppdrag" strong>
              {service.title}
            </Row>
            {/* Every row renders real order data or is omitted. These previously showed a
                hardcoded city, date and duration on a panel calling itself binding. */}
            {service.location?.city && <Row label="Sted">{service.location.city}</Row>}
            {contractDate && <Row label="Dato">{contractDate}</Row>}
            {contractDuration && <Row label="Estimert tid">{contractDuration}</Row>}
            <Row label="Oppdragsbeløp" strong>
              {kr(calculation.basePrice)}
            </Row>
            <Row label="Betalingsmetode">SafePay — holdes til godkjenning</Row>
            <Row label="Kontrakt-ID">
              <span className="tabular-nums">
                #JB-{String(order._id).substring(0, 8).toUpperCase()}
              </span>
            </Row>
          </div>

          <p className="mt-4 text-[0.75rem] leading-relaxed text-[#63665F]">
            Kontrakten sendes til begge parter på e-post og lagres under «Kontrakt» i menyen. Den
            er juridisk bindende og beskytter deg ved en eventuell tvist.
          </p>
        </section>

        {/* ── Betaling ─────────────────────────────────────────────────────── */}
        <section className={`${CARD} p-5 sm:p-6`}>
          <h2 className="mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
            <CreditCard size={16} strokeWidth={2} className="text-[#2E6641]" />
            Betaling
          </h2>

          <div className="mb-5">
            <Row label="Oppdragsbeløp">{kr(calculation.basePrice)}</Row>
            <Row label="SafePay-gebyr (3 %)">{kr(calculation.fee)}</Row>
            <div className="flex items-baseline justify-between gap-4 pt-3">
              <span className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                {isPaid ? 'Betalt' : 'Totalt å betale nå'}
              </span>
              <span className="text-[1.25rem] font-bold tabular-nums tracking-[-0.03em] text-[#0B0B0B]">
                {kr(calculation.total)}
              </span>
            </div>
          </div>

          {!isPaid && (
            <>
              {/* The saved "Visa •••• 4242 / Utløper 09/28" was a hardcoded Stripe test
                  card presented as the user's own, and the Vipps and Apple Pay options
                  only set local state — the session is unconditionally
                  payment_method_types: ['card']. Offering Vipps and then silently
                  charging a card is a trust problem, so this states what actually
                  happens. Re-add options once the backend passes the method through. */}
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#E6E7E1] p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F6F0] text-[#63665F]">
                  <CreditCard size={16} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-semibold text-[#0B0B0B]">Kort</p>
                  <p className="text-[0.75rem] text-[#63665F]">
                    Du fullfører betalingen sikkert hos Stripe i neste steg.
                  </p>
                </div>
              </div>

              <div className="mb-5 flex gap-3 rounded-2xl bg-[#EAF1E9] p-4">
                <Lock size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-[#2E6641]" />
                <p className="text-[0.8125rem] leading-relaxed text-[#2E6641]">
                  <strong className="mb-0.5 block font-semibold">Pengene holdes av Jobblo</strong>
                  {kr(calculation.total)} trekkes nå, men{' '}
                  {order.providerId?.name || 'oppdragstakeren'} mottar{' '}
                  {kr(calculation.providerNet)} først når du har godkjent jobben. Er du ikke
                  fornøyd, kan du opprette en tvist.
                </p>
              </div>
            </>
          )}

          {isPaid ? (
            <>
              <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-[#EAF1E9] px-4 py-3.5 text-[0.875rem] font-semibold text-[#2E6641]">
                <CheckCircle2 size={17} strokeWidth={2.2} />
                Betalingen er gjennomført
              </div>
              <button
                onClick={() => navigate(`/safepay/approval/${order._id}`)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2E6641] text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25"
              >
                Gå til godkjenning
              </button>
            </>
          ) : (
            <button
              onClick={() => paymentMutation.mutate()}
              disabled={paymentMutation.isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2E6641] text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paymentMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sender deg til Stripe…
                </>
              ) : (
                <>
                  <ShieldCheck size={16} strokeWidth={2.2} /> Bekreft og betal{' '}
                  {kr(calculation.total)}
                </>
              )}
            </button>
          )}

          {/* These were four `href="#"` anchors — on the page where the customer legally
              commits money, the terms link went nowhere. */}
          <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-[#9B9E96]">
            Ved å bekrefte godtar du{' '}
            <Link to="/user-term" className="font-medium text-[#2E6641] hover:underline">
              Jobblos vilkår
            </Link>{' '}
            og{' '}
            <Link
              to="/sale-subscription-terms"
              className="font-medium text-[#2E6641] hover:underline"
            >
              SafePay-avtalen
            </Link>
            .
          </p>
        </section>

        {order.paymentStatus === 'failed' && (
          <p className="mt-4 flex items-center justify-center gap-2 text-[0.8125rem] font-medium text-[#B4453A]">
            <AlertCircle size={14} /> Forrige betalingsforsøk mislyktes. Du kan prøve igjen over.
          </p>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#E6E7E1] pt-6 text-[0.75rem] text-[#9B9E96]">
          <div className="flex flex-wrap gap-5">
            <Link to="/support" className="hover:text-[#0B0B0B]">
              Kundesenter
            </Link>
            <Link to="/cookies" className="hover:text-[#0B0B0B]">
              Personvern
            </Link>
            <Link to="/user-term" className="hover:text-[#0B0B0B]">
              Vilkår for bruk
            </Link>
            <Link to="/about" className="hover:text-[#0B0B0B]">
              Om oss
            </Link>
          </div>
          <span>© Jobblo AS {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
};

export default SafePayCheckout;
