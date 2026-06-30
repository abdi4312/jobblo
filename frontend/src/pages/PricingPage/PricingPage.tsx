import { NavLink } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePricingLogic } from '../../features/plans/usePricingLogic';
import { PricingHeader } from '../../components/pricing/PricingHeader';
import { PricingSwitcher } from '../../components/pricing/PricingSwitcher';
import { PricingCard } from '../../components/pricing/PricingCard';
import { CheckoutView } from '../../components/pricing/CheckoutView';

export default function PricingPage() {
  const {
    userType,
    setUserType,
    selectedPlan,
    step,
    setStep,
    promoCode,
    setPromoCode,
    isApplyingPromo,
    discountInfo,
    setDiscountInfo,
    isRedirecting,
    isLoading,
    currentPlans,
    handleUpgradeClick,
    handleApplyPromo,
    handleCheckout,
    getIsPopular,
  } = usePricingLogic();

  if (step === 'checkout' && selectedPlan) {
    return (
      <CheckoutView
        selectedPlan={selectedPlan}
        step={step}
        setStep={setStep}
        promoCode={promoCode}
        setPromoCode={setPromoCode}
        isApplyingPromo={isApplyingPromo}
        discountInfo={discountInfo}
        setDiscountInfo={setDiscountInfo}
        isRedirecting={isRedirecting}
        handleApplyPromo={handleApplyPromo}
        handleCheckout={handleCheckout}
      />
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <PricingHeader />

        <PricingSwitcher userType={userType} setUserType={setUserType} />

        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-orange-custom mr-2" />
            <p className="text-xl">Loading plans...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {currentPlans.map((plan) => (
              <PricingCard
                key={plan._id}
                plan={plan}
                isPopular={getIsPopular(plan)}
                onUpgradeClick={handleUpgradeClick}
              />
            ))}
          </div>
        )}

        <div className="mt-20 text-center py-12 bg-white rounded-[40px] border border-[#E9ECEF] shadow-sm">
          <h4 className="text-2xl font-bold text-[#212529] mb-4">
            Have questions about our plans?
          </h4>
          <NavLink
            to="/support"
            className="inline-flex items-center text-custom-green font-black text-lg hover:underline gap-2"
          >
            Contact us
            <span className="material-symbols-outlined">arrow_forward</span>
          </NavLink>
        </div>
      </div>
    </div>
  );
}
