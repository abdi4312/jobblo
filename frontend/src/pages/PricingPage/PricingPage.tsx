import { useState } from "react";
import mainLink from "../../api/mainURLs";
import { Check, X, ArrowLeft, Tag, ShoppingCart, Loader2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button as AppButton } from "../../components/Ui/Button";
import { usePlans } from "../../features/plans/hooks";
import { toast } from "react-hot-toast";

interface Plan {
  _id: string;
  name: string;
  price: number;
  freeViews: number;
  pricePerExtraView: number;
  features: string[];
  type: "business" | "private";
  isActive: boolean;
  featuresText: string[];
  entitlements: {
    freeContact: number;
  };
}

export default function PricingPage() {
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

  if (step === "checkout" && selectedPlan) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setStep("pricing")}
            className="flex items-center gap-2 text-[#6C757D] hover:text-[#212529] mb-8 font-semibold transition-colors"
          >
            <ArrowLeft size={20} />
            Back to plans
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Summary */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E9ECEF]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#E0883515] flex items-center justify-center text-[#E08835]">
                  <ShoppingCart size={20} />
                </div>
                <h2 className="text-2xl font-bold text-[#212529]">
                  Order Summary
                </h2>
              </div>

              <div className="space-y-6">
                <div className="pb-6 border-b border-[#F8F9FA]">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-xl font-bold text-[#212529]">
                        {selectedPlan.name}
                      </h3>
                      <p className="text-sm text-[#6C757D]">
                        Monthly subscription
                      </p>
                    </div>
                    <span className="text-xl font-black text-[#212529]">
                      {selectedPlan.price} kr
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[#6C757D]">
                    <span>Subtotal</span>
                    <span>{selectedPlan.price} kr</span>
                  </div>

                  {discountInfo && (
                    <div className="flex justify-between text-[#22C55E] font-medium">
                      <span className="flex items-center gap-1">
                        <Tag size={14} />
                        Discount ({discountInfo.discountPercent}%)
                      </span>
                      <span>
                        -{selectedPlan.price - discountInfo.finalPrice} kr
                      </span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#F8F9FA] flex justify-between items-center">
                    <span className="text-lg font-bold text-[#212529]">
                      Total to pay
                    </span>
                    <span className="text-3xl font-black text-[#2F7E47]">
                      {discountInfo
                        ? discountInfo.finalPrice
                        : selectedPlan.price}{" "}
                      kr
                    </span>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="text-sm font-bold text-[#212529] uppercase tracking-wider mb-4">
                    Included features
                  </p>
                  <ul className="space-y-3">
                    {selectedPlan.featuresText
                      ?.slice(0, 4)
                      .map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-[#495057]"
                        >
                          <Check
                            size={14}
                            className="text-[#2F7E47] mt-0.5 shrink-0"
                          />
                          {feature}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Payment & Promo */}
            <div className="space-y-6">
              {/* Promo Code Card */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E9ECEF]">
                <h3 className="text-lg font-bold text-[#212529] mb-4 flex items-center gap-2">
                  <Tag size={18} className="text-[#E08835]" />
                  Do you have a promo code?
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="h-12 rounded-xl border-[#E9ECEF] focus:border-[#E08835] focus:ring-0"
                    disabled={isApplyingPromo || !!discountInfo}
                  />
                  <Button
                    onClick={handleApplyPromo}
                    loading={isApplyingPromo}
                    disabled={!promoCode.trim() || !!discountInfo}
                    className="h-12 px-6 rounded-xl bg-[#212529] text-white hover:bg-black border-none font-bold"
                  >
                    Apply
                  </Button>
                </div>
                {discountInfo && (
                  <div className="mt-3 flex items-center justify-between bg-[#F0FFF4] px-4 py-2 rounded-lg border border-[#C6F6D5]">
                    <span className="text-sm text-[#2F855A] font-medium">
                      Code <strong>{discountInfo.code}</strong> activated!
                    </span>
                    <button
                      onClick={() => {
                        setDiscountInfo(null);
                        setPromoCode("");
                      }}
                      className="text-[#2F855A] hover:text-[#276749]"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Checkout Button */}
              <div className="bg-[#2d4a3e] rounded-3xl p-8 shadow-lg text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-2">Complete upgrade</h3>
                  <p className="text-sm text-white/70 mb-8">
                    You will be redirected to Stripe for a safe and secure
                    payment.
                  </p>
                  <AppButton
                    label={isRedirecting ? "Redirecting..." : "Go to payment"}
                    onClick={handleCheckout}
                    disabled={isRedirecting}
                    className="w-full py-4 !bg-white !text-[#2d4a3e] rounded-2xl font-black text-lg hover:!bg-orange-50 transition-all shadow-xl"
                  />
                  <div className="mt-6 flex items-center justify-center gap-4 opacity-60">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg"
                      alt="Stripe"
                      className="h-6 brightness-0 invert"
                    />
                  </div>
                </div>
                {/* Decorative Background Pattern */}
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-[40px] font-bold tracking-normal mb-4">
            Choose your <span className="text-[#2F7E47]">plan</span>
          </h2>
          <p className="text-lg font-light text-[#0A0A0A9E] max-w-2xl mx-auto">
            Transparent pricing with no hidden costs. Start for free and upgrade
            when you're ready.
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-white border border-[#E08835] rounded-[14px] p-1 shadow-sm">
            <AppButton
              label="Business"
              onClick={() => setUserType("business")}
              className={`h-12! px-10! font-semibold! rounded-[10px]! transition-all! duration-300! ${
                userType === "business"
                  ? "!bg-[#E48A3C] !text-white !border-none shadow-md"
                  : "!bg-transparent !text-[#1A1A1A] !border-none hover:!bg-orange-50"
              }`}
            />
            <AppButton
              label="Individual"
              onClick={() => setUserType("private")}
              className={`!h-[48px] !px-10 !text-[18px] !font-semibold !rounded-[10px] !transition-all !duration-300 ${
                userType === "private"
                  ? "!bg-[#E48A3C] !text-white !border-none shadow-md"
                  : "!bg-transparent !text-[#1A1A1A] !border-none hover:!bg-orange-50"
              }`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-[#E08835] mr-2" />
            <p className="text-xl">Loading plans...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {currentPlans.map((plan) => {
              const isPopular = getIsPopular(plan);
              return (
                <div
                  key={plan._id}
                  className={`flex flex-col bg-white rounded-3xl p-8 transition-all duration-300 relative ${
                    isPopular
                      ? "ring-2 ring-[#E08835] shadow-2xl scale-105 z-10"
                      : "border border-[#E9ECEF] shadow-sm hover:shadow-md"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(180deg,#55E480_-131.16%,#2F7E47_184.59%)] px-6 py-1.5 rounded-full shadow-lg">
                      <p className="text-sm font-bold text-white uppercase tracking-wider">
                        Most Popular
                      </p>
                    </div>
                  )}

                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-[#212529] mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-base text-[#6C757D]">
                      For serious freelancers
                    </p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-[#212529]">
                        {plan.price}
                      </span>
                      <span className="text-xl text-[#6C757D]">kr</span>
                    </div>
                    <p className="text-sm text-[#ADB5BD] mt-1">per month</p>
                  </div>

                  <AppButton
                    label="Upgrade now"
                    onClick={() => handleUpgradeClick(plan)}
                    className={`w-full py-4 rounded-2xl font-bold transition-all mb-8 ${
                      isPopular
                        ? "!bg-[#E08835] !text-white hover:!bg-black shadow-lg"
                        : "!bg-transparent !text-[#E08835] !border-2 !border-[#E08835] hover:!bg-[#E08835] hover:!text-white"
                    }`}
                  />

                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#212529] uppercase tracking-wider mb-4 px-1">
                      Features
                    </p>
                    <ul className="space-y-4">
                      {plan.featuresText?.map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-[15px] text-[#495057]"
                        >
                          <div className="mt-1 shrink-0 w-5 h-5 rounded-full bg-[#E0883515] flex items-center justify-center text-[#E08835]">
                            <Check size={12} strokeWidth={3} />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-20 text-center py-12 bg-white rounded-[40px] border border-[#E9ECEF] shadow-sm">
          <h4 className="text-2xl font-bold text-[#212529] mb-4">
            Have questions about our plans?
          </h4>
          <NavLink
            to="/support"
            className="inline-flex items-center text-[#2F7E47] font-black text-lg hover:underline gap-2"
          >
            Contact us
            <span className="material-symbols-outlined">arrow_forward</span>
          </NavLink>
        </div>
      </div>
    </div>
  );
}
