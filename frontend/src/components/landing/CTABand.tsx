import { useNavigate } from 'react-router-dom';
import { CONTAINER, DISPLAY } from '../../theme/brand';

export function CTABand() {
  const navigate = useNavigate();

  const action =
    'flex h-13 items-center justify-center rounded-full px-6 text-[0.9375rem] font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 active:scale-[0.995]';

  return (
    <div className={`${CONTAINER} pb-16 sm:pb-20`}>
      {/* The one saturated block on the page, in the logo's own green rather than the
          #1a3a1a and #4ade80 pair it used before — neither of which appeared anywhere else. */}
      <div className="grid items-center gap-12 rounded-3xl bg-[#2E6641] px-7 py-14 sm:px-12 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
        <div>
          <h2 className={`text-white ${DISPLAY}`}>Klar til å komme i gang?</h2>
          <p className="mt-5 max-w-[46ch] text-[1rem] leading-relaxed text-white/75">
            Gratis å registrere seg — ingen abonnement nødvendig.
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => navigate('/Publish-job')}
            className={`${action} bg-white text-[#0B0B0B] hover:bg-[#EFF0EA]`}
          >
            Legg ut oppdrag
          </button>
          <button
            type="button"
            onClick={() => navigate('/search/job/all')}
            className={`${action} border border-white/40 text-white hover:bg-white/10`}
          >
            Finn oppdrag
          </button>
        </div>
      </div>
    </div>
  );
}
