import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import mainLink from '../../../api/mainURLs';
import { toast } from 'react-hot-toast';

type OnboardingStatus = 'none' | 'started' | 'restricted' | 'enabled' | 'pending_verification';

interface ConnectStatus {
  hasAccount: boolean;
  mode: 'test' | 'live';
  payoutReady: boolean;
  transfersEnabled: boolean;
  payoutOnboardingStatus: OnboardingStatus;
  payoutEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string | null;
  connectedAt?: string | null;
  lastRefreshed?: string | null;
}

type AccountState = 'ready' | 'pending' | 'incomplete' | 'restricted' | 'none';

function getAccountState(status: ConnectStatus): AccountState {
  if (!status.hasAccount || status.payoutOnboardingStatus === 'none') return 'none';
  if (status.payoutReady) return 'ready';
  if (status.payoutOnboardingStatus === 'restricted') return 'restricted';
  if (status.payoutOnboardingStatus === 'pending_verification') return 'pending';
  return 'incomplete';
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    if (response?.data?.error || response?.data?.message) {
      return response.data.error || response.data.message || 'Ukjent feil';
    }
  }
  return 'Stripe-status er midlertidig utilgjengelig. Prøv igjen.';
}

function dateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_COPY: Record<AccountState, { title: string; label: string; description: string }> = {
  ready: {
    title: 'Kontoen er verifisert',
    label: 'Klar for utbetalinger',
    description: 'Stripe Connect-kontoen din er verifisert og klar til å motta overføringer.',
  },
  pending: {
    title: 'Stripe gjennomgår opplysningene',
    label: 'Venter på verifisering',
    description: 'Stripe gjennomgår opplysningene dine. Vi oppdaterer statusen når kontoen er klar.',
  },
  incomplete: {
    title: 'Oppsett ikke fullført',
    label: 'Handling kreves',
    description: 'Fullfør Stripe Connect-oppsettet for å kunne sende forespørsler, starte oppdrag og motta utbetalinger.',
  },
  restricted: {
    title: 'Stripe trenger mer informasjon',
    label: 'Handling kreves',
    description: 'Stripe har begrenset kontoen. Åpne Stripe for å se hvilke opplysninger eller verifiseringer som mangler.',
  },
  none: {
    title: 'Koble til Stripe Connect',
    label: 'Ikke tilkoblet',
    description: 'Koble til Stripe Connect for å kunne sende forespørsler og motta betaling for oppdrag.',
  },
};

const PROCESS_STEPS = [
  {
    title: 'Kunden betaler',
    description: 'Kunden fullfører betalingen gjennom SafePay.',
  },
  {
    title: 'Oppdraget godkjennes',
    description: 'Du fullfører jobben, og kunden godkjenner arbeidet.',
  },
  {
    title: 'Overføring til Stripe Connect',
    description: 'Jobblo overfører tilgjengelige midler til Stripe-kontoen din.',
  },
  {
    title: 'Utbetaling til bankkonto',
    description: 'Stripe utbetaler til banken etter kontoens utbetalingsplan.',
  },
];

export const PayoutSettingsView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [platformSetupRequired, setPlatformSetupRequired] = useState(false);

  const fetchStatus = useCallback(async () => {
    const response = await mainLink.get<ConnectStatus>('/api/connect/status');
    setConnectStatus(response.data);
    setStatusError(null);
    return response.data;
  }, []);

  const refreshStatus = useCallback(async (showToast = true) => {
    setRefreshing(true);
    setStatusError(null);
    try {
      await mainLink.post('/api/connect/refresh');
      const status = await fetchStatus();
      if (showToast) {
        if (status.payoutReady) toast.success('Stripe Connect er klar for utbetalinger.');
        else toast('Stripe-statusen er oppdatert.');
      }
    } catch (error) {
      setStatusError(getErrorMessage(error));
      if (showToast) toast.error(getErrorMessage(error));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search);
    const returnedFromStripe = params.has('success') || params.has('refresh');

    const load = async () => {
      setLoading(true);
      try {
        if (returnedFromStripe) {
          await mainLink.post('/api/connect/refresh');
        }
        const response = await mainLink.get<ConnectStatus>('/api/connect/status');
        if (cancelled) return;
        setConnectStatus(response.data);
        setStatusError(null);
        if (returnedFromStripe) {
          if (response.data.payoutReady) toast.success('Stripe Connect er klar for utbetalinger.');
          else toast('Stripe-statusen er oppdatert.');
        }
      } catch (error) {
        if (!cancelled) setStatusError(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (returnedFromStripe) navigate('/settings/payout', { replace: true });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  const handleAccountAction = async () => {
    setLinking(true);
    setPlatformSetupRequired(false);
    try {
      const response = await mainLink.post<{ url?: string }>('/api/connect/account-link');
      if (!response.data?.url) {
        toast.error('Stripe returnerte ingen kontolenke. Prøv igjen.');
        return;
      }
      window.location.assign(response.data.url);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        (error as { response?: { data?: { code?: string } } }).response?.data?.code ===
          'STRIPE_CONNECT_PLATFORM_SETUP_REQUIRED'
      ) {
        setPlatformSetupRequired(true);
      }
      toast.error(getErrorMessage(error));
    } finally {
      setLinking(false);
    }
  };

  const handleCopyAccount = async () => {
    if (!connectStatus?.accountId) return;
    try {
      await navigator.clipboard.writeText(connectStatus.accountId);
      toast.success('Stripe-konto-ID kopiert.');
    } catch {
      toast.error('Kunne ikke kopiere konto-ID.');
    }
  };

  const state = connectStatus ? getAccountState(connectStatus) : null;
  const copy = state ? STATUS_COPY[state] : null;
  const actionLabel =
    state === 'ready'
      ? 'Administrer Stripe-konto'
      : state === 'none'
        ? 'Koble til Stripe Connect'
        : state === 'pending'
          ? 'Åpne Stripe-konto'
          : state === 'restricted'
            ? 'Oppdater Stripe-opplysninger'
            : 'Fullfør Stripe Connect-oppsett';

  const detailRows = connectStatus && state
    ? [
        {
          label: 'Tilkoblingsstatus',
          value: STATUS_COPY[state].label,
        },
        {
          label: 'Identitetsverifisering',
          value: state === 'ready'
            ? 'Fullført'
            : state === 'pending'
              ? 'Under behandling'
              : connectStatus.detailsSubmitted
                ? 'Opplysninger sendt'
                : state === 'none'
                  ? 'Ikke tilkoblet'
                  : 'Ikke fullført',
        },
        {
          label: 'Klar for overføringer',
          value: connectStatus.transfersEnabled ? 'Ja' : connectStatus.hasAccount ? 'Nei' : 'Ikke tilkoblet',
        },
        {
          label: 'Bankutbetalinger aktivert',
          value: connectStatus.payoutEnabled ? 'Ja' : connectStatus.hasAccount ? 'Nei' : 'Ikke tilkoblet',
        },
      ]
    : [];

  return (
    <section className="w-full space-y-6" aria-busy={loading}>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-[#63665F]">
          Administrer Stripe Connect-kontoen din og se status for utbetalinger.
        </p>
        {connectStatus?.mode === 'test' && (
          <span className="inline-flex w-fit items-center rounded-full border border-[#E6E7E1] bg-[#F4F6F0] px-3 py-1 text-xs font-semibold text-[#63665F]">
            Testmodus
          </span>
        )}
      </div>

      {connectStatus?.mode === 'test' && (
        <p className="rounded-xl bg-[#F4F6F0] px-4 py-3 text-xs leading-5 text-[#63665F]">
          Dette er en testkonto. Ingen ekte bankoverføringer gjennomføres.
        </p>
      )}

      {statusError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-[#E6E7E1] bg-[#F8F8F5] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#63665F]" />
            <p className="text-sm leading-5 text-[#42443F]">{statusError}</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshStatus(false)}
            disabled={refreshing}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D7D9D1] bg-white px-4 text-sm font-semibold text-[#30332F] transition-colors hover:bg-[#F4F6F0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />}
            Prøv igjen
          </button>
        </div>
      )}

      {platformSetupRequired && (
        <div role="alert" className="rounded-xl border border-[#F1E1C4] bg-[#FBF5E9] px-4 py-3 text-sm leading-5 text-[#614109]">
          Stripe Connect-oppsettet må fullføres av plattformadministratoren. Du trenger ikke gjøre flere forsøk nå.
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4" aria-label="Laster Stripe-status">
          <div className="h-36 rounded-2xl bg-[#F4F6F0]" />
          <div className="h-48 rounded-2xl bg-[#F4F6F0]" />
        </div>
      ) : connectStatus && copy ? (
        <>
          <section
            aria-labelledby="connect-status-heading"
            aria-live="polite"
            className="rounded-2xl border border-[#E6E7E1] bg-white p-5 sm:p-6"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3.5">
                <span
                  className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    state === 'ready' ? 'bg-[#EAF1E9] text-[#2E6641]' : 'bg-[#F4F6F0] text-[#63665F]'
                  }`}
                >
                  {state === 'ready' ? <ShieldCheck size={20} /> : state === 'pending' ? <Clock3 size={20} /> : <AlertCircle size={20} />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#85887F]">Stripe Connect</p>
                  <h3 id="connect-status-heading" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                    {copy.title}
                  </h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#63665F]">{copy.description}</p>
                  <span
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      state === 'ready'
                        ? 'bg-[#EAF1E9] text-[#245536]'
                        : 'bg-[#F4F6F0] text-[#55584F]'
                    }`}
                  >
                    {state === 'ready' ? <CheckCircle2 size={14} /> : <Info size={14} />}
                    {copy.label}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:min-w-52">
                <button
                  type="button"
                  onClick={() => void handleAccountAction()}
                  disabled={linking || refreshing || platformSetupRequired}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2E6641] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245536] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {linking ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                  {linking ? 'Åpner Stripe...' : platformSetupRequired ? 'Venter på plattformadministrator' : actionLabel}
                </button>
                {state === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void refreshStatus()}
                    disabled={refreshing || linking}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#2E6641] transition-colors hover:bg-[#F4F6F0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Sjekk status
                  </button>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="account-info-heading" className="rounded-2xl border border-[#E6E7E1] bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 id="account-info-heading" className="text-base font-semibold tracking-[-0.015em] text-[#0B0B0B]">
                  Kontoinformasjon
                </h3>
                <p className="mt-1 text-xs text-[#85887F]">Status hentet fra Stripe</p>
              </div>
              {connectStatus.lastRefreshed && (
                <span className="hidden text-xs text-[#85887F] sm:block">
                  Oppdatert {dateLabel(connectStatus.lastRefreshed)}
                </span>
              )}
            </div>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {detailRows.map((row) => (
                <div key={row.label} className="flex min-h-14 items-center justify-between gap-4 border-t border-[#F0F1EC] py-3">
                  <dt className="text-sm text-[#63665F]">{row.label}</dt>
                  <dd className={`text-right text-sm font-medium ${row.value === 'Ja' || row.value === 'Fullført' ? 'text-[#245536]' : 'text-[#30332F]'}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
              {connectStatus.accountId && (
                <div className="flex min-h-14 items-center justify-between gap-4 border-t border-[#F0F1EC] py-3">
                  <dt className="text-sm text-[#63665F]">Stripe-konto</dt>
                  <dd className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-xs text-[#30332F]" title={connectStatus.accountId}>
                      {connectStatus.accountId.slice(0, 9)}…{connectStatus.accountId.slice(-4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyAccount()}
                      aria-label="Kopier Stripe-konto-ID"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#63665F] transition-colors hover:bg-[#F4F6F0] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                    >
                      <Copy size={14} />
                    </button>
                  </dd>
                </div>
              )}
              {connectStatus.connectedAt && (
                <div className="flex min-h-14 items-center justify-between gap-4 border-t border-[#F0F1EC] py-3">
                  <dt className="text-sm text-[#63665F]">Tilkoblet siden</dt>
                  <dd className="text-sm font-medium text-[#30332F]">{dateLabel(connectStatus.connectedAt)}</dd>
                </div>
              )}
            </dl>
            {state !== 'ready' && (
              <p className="mt-4 rounded-xl bg-[#F7F8F4] px-4 py-3 text-xs leading-5 text-[#63665F]">
                Fullfør Stripe Connect-oppsettet for å kunne sende forespørsler, starte oppdrag og motta utbetalinger.
              </p>
            )}
          </section>
        </>
      ) : null}

      <section aria-labelledby="payout-process-heading" className="rounded-2xl border border-[#E6E7E1] bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="payout-process-heading" className="text-base font-semibold tracking-[-0.015em] text-[#0B0B0B]">
              Slik fungerer utbetalinger
            </h3>
            <p className="mt-1 text-sm text-[#63665F]">Fire steg fra kundebetaling til bankutbetaling.</p>
          </div>
          <Info size={17} className="mt-0.5 shrink-0 text-[#85887F]" aria-hidden="true" />
        </div>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#F4F6F0] text-xs font-bold tabular-nums text-[#2E6641]">
                {index + 1}
              </span>
              <div>
                <h4 className="text-sm font-semibold text-[#30332F]">{step.title}</h4>
                <p className="mt-1 text-xs leading-5 text-[#63665F]">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 border-t border-[#F0F1EC] pt-4 text-xs leading-5 text-[#63665F]">
          En overføring til Stripe Connect betyr ikke at beløpet allerede er utbetalt til bankkontoen. Bankutbetaling følger Stripes utbetalingsplan.
        </p>
        <button
          type="button"
          onClick={() => navigate('/settings/safepay')}
          className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#2E6641] transition-colors hover:text-[#245536] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
        >
          Se transaksjonshistorikk <ArrowRight size={15} />
        </button>
      </section>
    </section>
  );
};
