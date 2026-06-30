import { useNavigate } from 'react-router-dom';

export function CTABand() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#1a3a1a] rounded-[20px] px-3 py-12 sm:p-12 flex flex-col md:flex-row items-center justify-between mx-5 sm:mx-12 mb-15 max-w-275 lg:mx-auto">
      <div className="text-center md:text-left mb-6 md:mb-0">
        <h2 className="text-[26px] font-normal text-white mb-1.5 leading-tight">
          Klar til å komme
          <br />i <em className="text-[#4ade80] not-italic">gang?</em>
        </h2>
        <p className="text-[13px] text-white/60">
          Gratis å registrere seg – ingen abonnement nødvendig
        </p>
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={() => navigate('/home')}
          className="px-6 py-3 bg-[#4ade80] text-[#1a3a1a] rounded-full text-sm font-medium cursor-pointer hover:bg-[#3ce673] transition-colors"
        >
          Finn oppdrag
        </button>
        <button
          onClick={() => navigate('/publish-job')}
          className="px-6 py-3 bg-transparent text-white border border-white/40 rounded-full text-sm font-medium cursor-pointer hover:bg-white/10 transition-colors"
        >
          Legg ut oppdrag
        </button>
      </div>
    </div>
  );
}
