import { NavLink } from 'react-router-dom';
import { Loader2, ShieldCheck, Zap, Users, ArrowRight } from 'lucide-react';
import { usePricingLogic } from '../../features/plans/usePricingLogic';
import { PricingCard } from '../../components/pricing/PricingCard';
import { CheckoutView } from '../../components/pricing/CheckoutView';

const TRUST_POINTS = [
  { icon: ShieldCheck, text: 'Trygg betaling via Stripe' },
  { icon: Zap, text: 'Aktiver eller si opp når som helst' },
  { icon: Users, text: 'Brukt av tusenvis i Norge' },
];

export default function PricingPage() {
  const {
    userType,
    setUserType,
    canPurchase,
    selectedPlan,
    step,
    setStep,
    isRedirecting,
    isLoading,
    currentPlans,
    handleUpgradeClick,
    handleCheckout,
    getIsPopular,
  } = usePricingLogic();

  if (step === 'checkout' && selectedPlan) {
    return (
      <CheckoutView
        selectedPlan={selectedPlan}
        step={step}
        setStep={setStep}
        isRedirecting={isRedirecting}
        handleCheckout={handleCheckout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Hero */}
      <div className="bg-[#1a3a1a] text-white py-14 px-4 text-center">
        <p className="text-[#4ade80] text-xs font-bold uppercase tracking-widest mb-3">
          Jobblo Medlemskap
        </p>
        <h1 className="text-3xl sm:text-4xl font-black mb-3 leading-tight">
          Velg det som passer deg
        </h1>
        <p className="text-white/60 text-sm max-w-md mx-auto mb-8">
          Bygget for det norske markedet. Start gratis — oppgrader når du er klar.
        </p>

        {/* Type switcher */}
        <div className="inline-flex bg-white/10 rounded-xl p-1 gap-1">
          {(['private', 'business'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setUserType(type)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${userType === type
                ? 'bg-white text-[#1a3a1a]'
                : 'text-white/70 hover:text-white'
                }`}
            >
              {type === 'private' ? 'Privatperson' : 'Bedrift'}
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-16">
        {isLoading ? (
          <div className="flex justify-center items-center py-24 gap-2">
            <Loader2 className="animate-spin text-custom-green" size={20} />
            <p className="text-sm text-gray-500">Henter planer...</p>
          </div>
        ) : (
          <div className={`grid gap-5 ${currentPlans.length === 2
            ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
            {currentPlans.map((plan) => (
              <PricingCard
                key={plan._id}
                plan={plan}
                isPopular={getIsPopular(plan)}
                canPurchase={canPurchase(plan)}
                onUpgradeClick={handleUpgradeClick}
              />
            ))}
          </div>
        )}

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {TRUST_POINTS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-500">
              <Icon size={15} className="text-custom-green shrink-0" />
              {text}
            </div>
          ))}
        </div>

        {/* Support CTA */}
        <div className="mt-12 bg-[#1a3a1a] rounded-2xl p-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[#4ade80] text-xs font-bold uppercase tracking-widest mb-2">Support</p>
            <h4 className="text-xl font-black text-white mb-2">Usikker på hva du trenger?</h4>
            <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
              Vi svarer raskt og hjelper deg finne riktig plan for ditt behov.
            </p>
            <NavLink
              to="/support"
              className="inline-flex items-center gap-2 bg-white text-[#1a3a1a] font-bold text-sm px-5 py-2.5 rounded-full hover:bg-[#f0faf0] transition-colors"
            >
              Kontakt oss <ArrowRight size={14} />
            </NavLink>
          </div>
          {/* decorative circles */}
          <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-white/5 rounded-full" />
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
        </div>
      </div>
    </div>
  );
}
