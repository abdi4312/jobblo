import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import mainLink from '../../api/mainURLs';
import { usePlans } from './hooks';
import type { Plan } from './types';
import { useUserStore } from '../../stores/userStore';

export const usePricingLogic = () => {
  const user = useUserStore((state) => state.user);
  const accountType: 'business' | 'private' | null =
    user?.role === 'company'
      ? 'business'
      : user?.role === 'user' || user?.role === 'provider'
        ? 'private'
        : null;
  const [publicType, setPublicType] = useState<'business' | 'private'>('business');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<'pricing' | 'checkout'>('pricing');

  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: plans, isLoading } = usePlans();
  const userType = accountType ?? publicType;

  useEffect(() => {
    setSelectedPlan(null);
    setStep('pricing');
  }, [accountType]);

  const handleUpgradeClick = (plan: Plan) => {
    if (accountType && plan.type !== accountType) {
      toast.error(
        plan.type === 'business'
          ? 'Denne planen er kun tilgjengelig for bedriftskontoer.'
          : 'Denne planen er kun tilgjengelig for privatkontoer.'
      );
      return;
    }
    setSelectedPlan(plan);
    setStep('checkout');
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;

    setIsRedirecting(true);
    try {
      const res = await mainLink.post('/api/stripe/create-checkout-session', {
        planId: selectedPlan._id,
      });
      window.location.href = res.data.url;
    } catch (err: any) {
      if (err?.response?.data?.code === 'plan_type_not_allowed') {
        toast.error('Denne planen er ikke tilgjengelig for kontotypen din.');
        setSelectedPlan(null);
        setStep('pricing');
      } else {
        toast.error(err?.response?.data?.message || 'Kunne ikke starte betalingen. Prøv igjen om litt.');
      }
      setIsRedirecting(false);
    }
  };

  const currentPlans = plans?.filter((plan) => plan.type === userType) || [];

  const getIsPopular = (plan: Plan) => {
    if (plan.type === 'business') {
      return plan.name === 'Pro';
    }
    return plan.name === 'Jobblo Plus';
  };

  return {
    userType,
    setUserType: setPublicType,
    isAccountSpecific: accountType !== null,
    selectedPlan,
    setSelectedPlan,
    step,
    setStep,
    isRedirecting,
    plans,
    isLoading,
    currentPlans,
    handleUpgradeClick,
    handleCheckout,
    getIsPopular,
    canPurchase: (plan: Plan) => !accountType || plan.type === accountType,
  };
};
