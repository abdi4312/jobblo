import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Headphones, Loader2, RefreshCw } from 'lucide-react';
import mainLink from '../../api/mainURLs';
import { CARD, MICRO_LABEL } from '../../theme/brand';

/**
 * Where Stripe drops you after paying for a plan.
 *
 * It was one line of `text-green-600` on an otherwise empty white viewport — Tailwind's
 * green, which is not the brand's — followed by a silent three-second redirect with no way
 * to skip it and no mention of what had just been bought or charged. The three failure
 * branches were the same line in `text-red-600`: no retry, no support link, no way out
 * except the browser's back button, on the screen a person lands on when their money may
 * or may not have moved.
 *
 * It reads as a receipt now. The mark draws once (see `jb-check-*` in `styles/index.css`),
 * the plan and the amount are stated, the redirect counts down visibly and can be skipped,
 * and every failure state says what it means for the person's money and offers a way
 * forward.
 */

type Status = 'loading' | 'success' | 'failed' | 'error' | 'no-session';

interface SessionResult {
  payment_status: string;
  plan?: string;
  planType?: string;
  amount?: number;
  currency?: string;
  discountAmount?: number;
  coupon?: string | null;
}

const SOLID =
  'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2E6641]! text-[0.9375rem] font-semibold text-white! transition-colors hover:bg-[#255335]! focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-[0.995] disabled:opacity-60';

const OUTLINE =
  'flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#E6E7E1] bg-white! text-[0.9375rem] font-medium text-[#0B0B0B]! transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641]! focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15';

/** Seconds on the automatic redirect. Visible, and skippable. */
const REDIRECT_SECONDS = 5;

const formatAmount = (amount: number, currency = 'nok') =>
  `${amount.toLocaleString('nb-NO', { minimumFractionDigits: amount % 1 ? 2 : 0 })} ${currency.toUpperCase()}`;

/** The confirmation mark. Ring wipes in, tick draws after it. */
function PaidMark() {
  return (
    <span className="flex size-16 items-center justify-center rounded-full bg-[#EAF1E9]">
      <svg viewBox="0 0 48 48" className="size-8" fill="none" aria-hidden="true">
        <circle
          className="jb-check-ring"
          cx="24"
          cy="24"
          r="20"
          pathLength={1}
          stroke="#2E6641"
          strokeWidth="3"
          strokeOpacity="0.28"
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
        <path
          className="jb-check-tick"
          d="M15 24.5 L21.5 31 L33 19"
          pathLength={1}
          stroke="#2E6641"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Shared frame: one centred card, so every state has the same silhouette. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#EFF0EA] px-5 py-14">
      <div className={`${CARD} w-full max-w-115 p-7 text-center sm:p-9`}>{children}</div>
    </div>
  );
}

const SuccessPage = () => {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<SessionResult | null>(null);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [isRetrying, setIsRetrying] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get('session_id');

  const check = useCallback(async () => {
    if (!sessionId) {
      setStatus('no-session');
      return;
    }
    try {
      const res = await mainLink.get<SessionResult>(`/api/stripe/checkout-session/${sessionId}`);
      setResult(res.data);
      setStatus(res.data.payment_status === 'paid' ? 'success' : 'failed');
    } catch {
      // The response body is a Stripe session — it is never logged.
      setStatus('error');
    }
  }, [sessionId]);

  useEffect(() => {
    check();
  }, [check]);

  // Tick down visibly rather than jumping without warning. Anyone reading the amount gets
  // to finish reading it, and the button below moves on immediately if they would rather.
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) {
      // '/dashboard' was an admin route: AdminProtectedRoute bounced every ordinary user
      // to /profile, or to /login if auth was lost over the Stripe round-trip, so the
      // paid funnel ended in a redirect bounce.
      navigate('/membership', { replace: true });
      return;
    }
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, navigate]);

  const retry = async () => {
    setIsRetrying(true);
    setStatus('loading');
    await check();
    setIsRetrying(false);
  };

  if (status === 'loading') {
    return (
      <Panel>
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
          <Loader2 size={26} className="animate-spin" />
        </span>
        <h1 className="mt-5 text-[1.375rem] font-bold tracking-[-0.03em] text-[#0B0B0B]">
          Bekrefter betalingen
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#63665F]">
          Vi henter bekreftelsen fra Stripe. Ikke lukk vinduet.
        </p>
      </Panel>
    );
  }

  if (status === 'success') {
    const amount = result?.amount;
    const discount = result?.discountAmount || 0;

    return (
      <Panel>
        <div className="mx-auto w-fit">
          <PaidMark />
        </div>

        <h1 className="mt-5 text-[1.375rem] font-bold tracking-[-0.03em] text-[#0B0B0B]">
          Betalingen er gjennomført
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#63665F]">
          Medlemskapet er aktivt med én gang. Kvitteringen er sendt til e-posten din.
        </p>

        {(result?.plan || amount != null) && (
          <dl className="mt-6 overflow-hidden rounded-2xl border border-[#E6E7E1] text-left">
            {result?.plan && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className={MICRO_LABEL}>Plan</dt>
                <dd className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{result.plan}</dd>
              </div>
            )}
            {discount > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-[#E6E7E1] px-4 py-3">
                <dt className={MICRO_LABEL}>Rabatt{result?.coupon ? ` · ${result.coupon}` : ''}</dt>
                <dd className="text-[0.9375rem] font-semibold text-[#2E6641]">
                  −{formatAmount(discount, result?.currency)}
                </dd>
              </div>
            )}
            {amount != null && (
              <div className="flex items-center justify-between gap-3 border-t border-[#E6E7E1] bg-[#F4F6F0] px-4 py-3">
                <dt className={MICRO_LABEL}>Betalt</dt>
                <dd className="text-[1.0625rem] font-bold tabular-nums text-[#0B0B0B]">
                  {formatAmount(amount, result?.currency)}
                </dd>
              </div>
            )}
          </dl>
        )}

        <button type="button" onClick={() => navigate('/membership', { replace: true })} className={`${SOLID} mt-6`}>
          Til medlemskapet
          <ArrowRight size={16} strokeWidth={2.4} />
        </button>
        <p className="mt-3 text-[0.8125rem] tabular-nums text-[#9B9E96]">
          Sender deg videre om {countdown} s
        </p>
      </Panel>
    );
  }

  // ── Failure states ─────────────────────────────────────────────────────────
  const failures: Record<
    Exclude<Status, 'loading' | 'success'>,
    { title: string; body: string; retry: boolean }
  > = {
    failed: {
      title: 'Betalingen ble ikke fullført',
      body: 'Ingen penger er trukket fra kortet ditt. Du kan prøve igjen når du vil.',
      retry: false,
    },
    error: {
      title: 'Vi fikk ikke bekreftet betalingen',
      body: 'Dette kan være et midlertidig problem. Prøv å sjekke på nytt — og ta kontakt med kundesenteret hvis beløpet er trukket.',
      retry: true,
    },
    'no-session': {
      title: 'Mangler betalingsreferanse',
      body: 'Lenken har ingen referanse til en betaling. Åpne medlemskapssiden for å se hvilken plan du har.',
      retry: false,
    },
  };

  const copy = failures[status];

  return (
    <Panel>
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#FBF4F2] text-[#B4544A]">
        <AlertCircle size={26} strokeWidth={2} />
      </span>

      <h1 className="mt-5 text-[1.375rem] font-bold tracking-[-0.03em] text-[#0B0B0B]">
        {copy.title}
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#63665F]">{copy.body}</p>

      <div className="mt-6 flex flex-col gap-2.5">
        {copy.retry && (
          <button type="button" onClick={retry} disabled={isRetrying} className={SOLID}>
            <RefreshCw size={16} strokeWidth={2.4} className={isRetrying ? 'animate-spin' : ''} />
            Sjekk på nytt
          </button>
        )}
        <Link to="/membership" className={copy.retry ? OUTLINE : SOLID}>
          {status === 'failed' ? 'Prøv igjen' : 'Til medlemskapet'}
          <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
        <Link to="/support" className={OUTLINE}>
          <Headphones size={16} strokeWidth={2} />
          Kontakt kundesenteret
        </Link>
      </div>
    </Panel>
  );
};

export default SuccessPage;
