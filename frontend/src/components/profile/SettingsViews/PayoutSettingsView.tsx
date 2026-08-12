import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import mainLink from '../../../api/mainURLs';
import { useUserStore } from '../../../stores/userStore';
import { toast } from 'react-hot-toast';

interface ConnectStatus {
  hasAccount: boolean;
  payoutOnboardingStatus: 'none' | 'started' | 'restricted' | 'enabled' | 'pending_verification';
  payoutEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  connectedAt?: string;
  lastRefreshed?: string;
}

export const PayoutSettingsView = () => {
  const user = useUserStore((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [linking, setLinking] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await mainLink.get('/api/connect/status');
      setConnectStatus(res.data);
    } catch (err: any) {
      console.error('Failed to fetch connect status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const isSuccess = searchParams.get('success') === '1';
    const isRefresh = searchParams.get('refresh') === '1';

    if (isSuccess || isRefresh) {
      mainLink
        .post('/api/connect/refresh')
        .then((res) => {
          setConnectStatus({
            hasAccount: true,
            payoutOnboardingStatus: res.data.payoutOnboardingStatus,
            payoutEnabled: res.data.payoutEnabled,
            chargesEnabled: res.data.chargesEnabled,
            detailsSubmitted: res.data.detailsSubmitted,
          });
          if (res.data.payoutEnabled) {
            toast.success('Utbetalingskonto er verifisert og klar!');
          } else {
            toast.success('Stripe status ble oppdatert');
          }
        })
        .catch(() => {
          fetchStatus();
        })
        .finally(() => {
          // Clean up query string
          navigate('/settings/payout', { replace: true });
        });
    } else {
      fetchStatus();
    }
  }, [location.search]);

  const handleStartOnboarding = async () => {
    try {
      setLinking(true);
      const res = await mainLink.post('/api/connect/account-link');
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error('Kunne ikke opprette onboarding-lenke');
      }
    } catch (err: any) {
      console.error('Failed to create account link:', err);
      toast.error(err.response?.data?.error || 'Kunne ikke starte Stripe-onboarding');
    } finally {
      setLinking(false);
    }
  };

  // Determine worker payout status state
  const isReady = connectStatus?.payoutEnabled && connectStatus?.payoutOnboardingStatus === 'enabled';
  const isPendingVerification =
    connectStatus?.detailsSubmitted && !connectStatus?.payoutEnabled;
  const isNotConfigured = !connectStatus?.hasAccount || connectStatus?.payoutOnboardingStatus === 'none';

  return (
    <section className="flex flex-col gap-6 max-w-2xl w-full">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-bold text-gray-900">Utbetalingsinformasjon</h2>
        <p className="text-[15px] text-[#555] leading-[1.4] font-normal">
          Jobblo bruker <strong>Stripe Connect</strong> for trygg og direkte utbetaling til din bankkonto for fullførte oppdrag.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8 bg-gray-50 rounded-2xl border border-gray-100">
          <Loader2 size={24} className="animate-spin text-custom-green" />
        </div>
      ) : isReady ? (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-5">
          <CheckCircle2 size={22} className="text-green-600 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-green-900">Klar for utbetalinger</p>
              <span className="px-2 py-0.5 bg-green-200 text-green-800 font-semibold text-[11px] rounded-full uppercase tracking-wider">
                Verifisert
              </span>
            </div>
            <p className="text-[13px] text-green-800">
              Din Stripe Connect-konto er aktiv og klar til å motta midler direkte når oppdrag godkjennes.
            </p>
          </div>
        </div>
      ) : isPendingVerification ? (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <Clock size={22} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-amber-900">Verifisering kreves</p>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-semibold text-[11px] rounded-full uppercase tracking-wider">
                Under behandling
              </span>
            </div>
            <p className="text-[13px] text-amber-800">
              Stripe behandler opplysningene dine. Du kan bli bedt om ytterligere dokumentasjon eller verifisering i Stripe Dashboard.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-amber-900">Ikke satt opp</p>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-semibold text-[11px] rounded-full uppercase tracking-wider">
                Handling kreves
              </span>
            </div>
            <p className="text-[13px] text-amber-800">
              Du må koble til din utbetalingskonto via Stripe for å kunne motta utbetalinger for utførte jobber.
            </p>
          </div>
        </div>
      )}

      {/* Stripe Connect CTA Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-custom-green-light flex items-center justify-center text-custom-green">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-gray-900">Stripe Connect-oppsett</h3>
              <p className="text-[13px] text-gray-500">
                Sikker ID-verifisering og registrering av kontonummer
              </p>
            </div>
          </div>
        </div>

        <p className="text-[14px] text-gray-600 leading-relaxed">
          Ved å klikke på knappen nedenfor blir du omdirigert til Stripes trygge onboarding-portal der du kan legge inn bankinformasjon og verifisere identitet.
        </p>

        <button
          type="button"
          onClick={handleStartOnboarding}
          disabled={linking}
          className="w-full font-bold text-base py-3.5 px-5 rounded-2xl text-white bg-custom-green hover:bg-custom-green/90 active:scale-[0.98] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {linking ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Kobler til Stripe...
            </>
          ) : isReady ? (
            <>
              <ExternalLink size={18} />
              Oppdater eller endre Stripe-opplysninger
            </>
          ) : isPendingVerification ? (
            <>
              <ExternalLink size={18} />
              Fullfør verifisering i Stripe
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              Start Stripe-onboarding
            </>
          )}
        </button>
      </div>

      {/* Info box — neutral wording */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-gray-500" />
          <span className="text-[13px] font-bold text-gray-700 uppercase tracking-tight">
            Informasjon om utbetalingstid
          </span>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed">
          Din utbetalingstid fastlegges av din utbetalingsplan i Stripe. Når oppdragsgiver godkjenner jobben via SafePay, overføres midlene umiddelbart til din tilknyttede Stripe Connect-konto.
        </p>
      </div>
    </section>
  );
};
