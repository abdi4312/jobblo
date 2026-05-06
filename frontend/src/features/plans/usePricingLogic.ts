import { useState } from "react";
import mainLink from "../../api/mainURLs";
import { toast } from "react-hot-toast";
import { usePlans } from "./hooks";
import type { Plan } from "./types";

export const usePricingLogic = () => {
  const [userType, setUserType] = useState<"business" | "private">("business");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<"pricing" | "checkout">("pricing");

  // Checkout States
  const [promoCode, setPromoCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [discountInfo, setDiscountInfo] = useState<{
    originalPrice: number;
    discountPercent: number;
    finalPrice: number;
    code: string;
  } | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: plans, isLoading } = usePlans();

  const handleUpgradeClick = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep("checkout");
    // Reset checkout states
    setPromoCode("");
    setDiscountInfo(null);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selectedPlan) return;

    setIsApplyingPromo(true);
    try {
      const res = await mainLink.post("/api/coupons/validate", {
        planId: selectedPlan._id,
        code: promoCode.trim(),
      });

      setDiscountInfo({
        ...res.data,
        code: promoCode.trim(),
      });
      toast.success("Promo code activated! 🎉");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Invalid coupon code");
      setDiscountInfo(null);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;

    setIsRedirecting(true);
    try {
      const payload: { planId: string; couponCode?: string } = {
        planId: selectedPlan._id,
      };

      if (discountInfo) {
        payload.couponCode = discountInfo.code;
      }

      const res = await mainLink.post(
        "/api/stripe/create-checkout-session",
        payload,
      );
      window.location.href = res.data.url;
    } catch {
      toast.error("Could not start payment. Please try again later.");
      setIsRedirecting(false);
    }
  };

  const currentPlans = plans?.filter((plan) => plan.type === userType) || [];

  const getIsPopular = (plan: Plan) => {
    if (plan.type === "business") {
      return plan.name === "Pro";
    }
    return plan.name === "Jobblo Plus";
  };

  return {
    userType,
    setUserType,
    selectedPlan,
    setSelectedPlan,
    step,
    setStep,
    promoCode,
    setPromoCode,
    isApplyingPromo,
    discountInfo,
    setDiscountInfo,
    isRedirecting,
    plans,
    isLoading,
    currentPlans,
    handleUpgradeClick,
    handleApplyPromo,
    handleCheckout,
    getIsPopular,
  };
};
