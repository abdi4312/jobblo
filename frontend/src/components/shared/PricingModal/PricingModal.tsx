import { Modal, Radio, Button, Input } from "antd";
import { useEffect, useState } from "react";
import { getSubscriptionPlans } from "../../../api/subscriptionPlanApi";
import mainLink from "../../../api/mainURLs";
import Swal from "sweetalert2";
import { Check, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button as AppButton } from "../../Ui/Button"
import { useQuery } from "@tanstack/react-query";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

// NEW: Beautiful Coupon Modal Component
interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (code: string) => void;
  loading?: boolean;
}

function CouponModal({ isOpen, onClose, onApply, loading }: CouponModalProps) {
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState("");

  const handleApply = () => {
    if (!couponCode.trim()) {
      setError("Kupongkode er påkrevd");
      return;
    }
    onApply(couponCode.trim());
  };

  const handleCancel = () => {
    setCouponCode("");
    setError("");
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleCancel}
      footer={null}
      width={480}
      centered
      closable={false}
      styles={{
        body: { padding: 0 },
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #2d4a3e 0%, #3d5a4e 100%)",
          padding: "32px",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "32px",
            }}
          >
            🎟️
          </div>
          <h2
            style={{
              color: "white",
              fontSize: "24px",
              fontWeight: "600",
              margin: "0 0 8px 0",
            }}
          >
            Har du en kupongkode?
          </h2>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "14px",
              margin: 0,
            }}
          >
            Bruk kupongkoden din for å få ekstra rabatt
          </p>
        </div>
      </div>

      <div style={{ padding: "32px" }}>
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "500",
              marginBottom: "8px",
              color: "#333",
            }}
          >
            Kupongkode
          </label>
          <Input
            placeholder="F.eks: SAVE20, WELCOME50"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              setError("");
            }}
            onPressEnter={handleApply}
            status={error ? "error" : ""}
            size="large"
            disabled={loading}
            style={{
              borderRadius: "8px",
              fontSize: "16px",
              letterSpacing: "1px",
              fontWeight: "500",
            }}
            prefix={
              <span style={{ fontSize: "18px", marginRight: "4px" }}>🏷️</span>
            }
          />
          {error && (
            <p
              style={{
                color: "#ff4d4f",
                marginTop: "8px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>⚠️</span>
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            background: "#f6f8f7",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              color: "#666",
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            💡 <strong>Tips:</strong> Kupongkoder kan gi deg opptil 50% rabatt
            på ditt første abonnement!
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexDirection: "column",
          }}
        >
          <Button
            type="primary"
            size="large"
            onClick={handleApply}
            loading={loading}
            disabled={!couponCode.trim() || loading}
            block
            style={{
              backgroundColor: "#2d4a3e",
              borderColor: "#2d4a3e",
              height: "48px",
              fontSize: "16px",
              fontWeight: "600",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(45, 74, 62, 0.3)",
            }}
          >
            {loading ? "Sjekker kupong..." : "Bruk kupong og fortsett"}
          </Button>

          <Button
            size="large"
            onClick={() => onApply("")}
            disabled={loading}
            block
            style={{
              height: "48px",
              fontSize: "15px",
              borderRadius: "8px",
              border: "1px solid #d9d9d9",
            }}
          >
            Fortsett uten kupong
          </Button>

          <Button
            type="text"
            onClick={handleCancel}
            disabled={loading}
            block
            style={{
              color: "#666",
              fontSize: "14px",
            }}
          >
            Avbryt
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [userType, setUserType] = useState<"business" | "private">("business");
  // const [plans, setPlans] = useState<Plan[]>([]);
  // const [isLoading, setLoading] = useState(true);

  // Coupon modal state
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [couponLoading, setCouponLoading] = useState(false);

  // const fetchPlans = async () => {
  //   try {
  //     setLoading(true);
  //     const data = await getSubscriptionPlans();
  //     setPlans(data.filter((plan: Plan) => plan.isActive));

  //   } catch (error) {
  //     console.error("Failed to fetch plans:", error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // useEffect(() => {
  //   void fetchPlans();
  // }, []);

  // useQuery({
  //   queryKey:['plans'],
  //   queryFn: fetchPlans
  // })

const { data: plans, isLoading } = useQuery({
  // Unique key used for caching and identifying this specific query
  queryKey: ['plans'],

  // The function that fetches data from the backend/database
  queryFn: getSubscriptionPlans,

  // Prevents the data from ever becoming "stale" since plans are static
  staleTime: Infinity,

  // Keeps the data in memory for 1 hour after the component unmounts
  gcTime: 1000 * 60 * 60,

  // Disables background fetching when switching browser tabs
  refetchOnWindowFocus: false,

  // Disables automatic refetching when the component remounts
  refetchOnMount: false,

  // Transforms the data to return only active plans to the component
  select: (data) => data?.filter((plan: any) => plan.isActive),
});

  const handlePlanSelection = async (planId: string) => {
    setSelectedPlanId(planId);
    setShowCouponModal(true);
  };

  const handleCouponApply = async (couponCode: string) => {
    setCouponLoading(true);

    try {
      // If no coupon code (user clicked "Fortsett uten kupong")
      if (!couponCode) {
        setShowCouponModal(false);

        Swal.fire({
          title: "Omdirigerer til betaling...",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const res = await mainLink.post("/api/stripe/create-checkout-session", {
          planId: selectedPlanId,
        });

        window.location.href = res.data.url;
        return;
      }

      // Validate coupon
      const res = await mainLink.post("/api/coupons/validate", {
        planId: selectedPlanId,
        code: couponCode,
      });

      const { originalPrice, discountPercent, finalPrice } = res.data;

      setShowCouponModal(false);
      setCouponLoading(false);

      const { isConfirmed } = await Swal.fire({
        title: "Rabatt brukt 🎉",
        html: `
          <div style="text-align: left; padding: 10px;">
            <p><strong>Original pris:</strong> ${originalPrice} kr</p>
            <p><strong>Rabatt:</strong> ${discountPercent}%</p>
            <p style="font-size: 18px; color: #2d4a3e;"><strong>Ny pris:</strong> ${finalPrice} kr / måned</p>
          </div>
        `,
        icon: "success",
        confirmButtonText: "Fortsett til betaling",
        confirmButtonColor: "#2d4a3e",
        showCancelButton: true,
        cancelButtonText: "Avbryt",
      });

      if (isConfirmed) {
        Swal.fire({
          title: "Omdirigerer til betaling...",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const checkout = await mainLink.post(
          "/api/stripe/create-checkout-session",
          { planId: selectedPlanId, couponCode },
        );

        window.location.href = checkout.data.url;
      }
    } catch (error: any) {
      setCouponLoading(false);
      setShowCouponModal(false);

      Swal.fire({
        icon: "error",
        title: "Ugyldig kupong",
        text:
          error?.response?.data?.message ||
          "Kupongkoden er ikke gyldig eller er utløpt",
        confirmButtonColor: "#2d4a3e",
      });
    }
  };

  const currentPlans = plans?.filter((plan) => plan.type === userType);

  const getIsPopular = (plan: Plan) => {
    if (plan.type === "business") {
      return plan.name === "Pro";
    }
    return plan.name === "Jobblo Pluss";
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={onClose}
        >
          <div
            className="bg-[#F2F2F2] rounded-xl w-[98%] max-w-280 max-h-[99vh] overflow-y-auto p-10"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex justify-between">
              <div>

                <h2 className="text-[40px] font-bold tracking-normal mb-4">
                  Velg din <span className="text-[#2F7E47]">plan</span>
                </h2>

                <p className="text-base font-light text-[#0A0A0A9E]">
                  Transparente priser uten skjulte kostnader. Start gratis og oppgrader når du er klar.
                </p>

              </div>

              {/* Close Button */}
              <div >
                <button onClick={onClose} className="p-3.5 bg-white rounded-[14px] hover:text-[#E08835] hover:border-[#E08835]">
                  <X size={16} />
                </button>
              </div>

            </div>

            <div className="py-5">
              {/* <Radio.Group
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                buttonStyle="solid"
                size="large"
                style={{
                  marginBottom: "30px",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Radio.Button value="business">Bedrift</Radio.Button>
                <Radio.Button value="private">Privatperson</Radio.Button>
              </Radio.Group> */}
              <div className="flex justify-center mb-[30px]">
                {/* Main wrapper jo buttons ko ek saath jorta hai */}
                <div className="inline-flex bg-white border border-[#E08835] rounded-[14px] p-1 shadow-sm">

                  {/* Bedrift Button */}
                  <AppButton
                    label="Bedrift"
                    onClick={() => setUserType("business")}
                    className={`h-12! px-10! font-semibold! rounded-[10px]! transition-all! duration-300! ${userType === "business"
                      ? "!bg-[#E48A3C] !text-white !border-none shadow-md"
                      : "!bg-transparent !text-[#1A1A1A] !border-none hover:!bg-orange-50"
                      }`}
                  />

                  {/* Privatperson Button */}
                  <AppButton
                    label="Privatperson"
                    onClick={() => setUserType("private")}
                    className={`!h-[48px] !px-10 !text-[18px] !font-semibold !rounded-[10px] !transition-all !duration-300 ${userType === "private"
                      ? "!bg-[#E48A3C] !text-white !border-none shadow-md"
                      : "!bg-transparent !text-[#1A1A1A] !border-none hover:!bg-orange-50"
                      }`}
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="text-center p-10">
                  <p>Laster planer...</p>
                </div>
              ) : (
                <div className={`flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap gap-4`}>
                  {currentPlans.map((plan) => {
                    const isPopular = getIsPopular(plan);
                    return (
                      <div
                        key={plan._id}
                        className={`relative rounded-lg min-w-80.25 min-h-140 bg-[#F2F2F2] p-8 items-center justify-center my-auto
                          ${isPopular ? "border border-[#E08835] lg:min-w-91.5 lg:min-h-152"
                            : "border border-[#d9d9d9]"
                          }`}>

                        <div className="flex flex-col gap-2 mb-2">
                          <div className="flex justify-between">
                            <div>
                              <h3 className="text-[20px] font-bold">
                                {plan.name}
                              </h3>
                            </div>
                            {isPopular && (
                              <div className="px-5 py-1.5 rounded-full shadow-md bg-[linear-gradient(180deg,#55E480_-131.16%,#2F7E47_184.59%)]">
                                <p className="text-[14px] font-semibold text-white tracking-wide whitespace-nowrap">
                                  Most Popular
                                </p>
                              </div>
                            )}
                          </div>

                        </div>

                        <div className="mb-8">
                          <p className="text-base font-light text-[#0A0A0A9E]">
                            For seriøse freelancere
                          </p>
                        </div>

                        <div className="flex flex-col text-[##0A0A0A]">
                          <p className="text-[32px] font-bold">
                            {plan.price} kr
                          </p>
                          <p className="text-[16px] font-light">
                            måned
                          </p>
                        </div>

                        <AppButton label="Se alle oppdrag" onClick={() => handlePlanSelection(plan._id)}
                          className={`w-50 my-8 border rounded-xl
                          ${isPopular ? "hover:bg-transparent hover:text-[#E08835]!"
                              : "text-[#E08835]! border-[#E08835] bg-transparent hover:bg-[#E08835] hover:text-white!"}`} />

                        <ul className="list-none p-0 mb-5">
                          {plan.featuresText?.map((feature, i) => (
                            <li key={i} className="mb-2 pl-7.5 relative text-base font-normal">
                              <span className="absolute left-0 size-5 text-[#2F7E47] p-0.75 bg-amber-600 rounded-full">
                                <Check className="size-3.5" />
                              </span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                </div>
              )}

              <div className="flex items-center justify-center text-base md:text-[24px] pt-10 gap-2">
                <p className="font-normal">Har du spørsmål om våre planer?</p>
                <NavLink to="/" className="text-[#2F7E47]!  font-semibold decoration-solid hover:underline">Kontakt oss</NavLink>
              </div>

            </div>
          </div>
        </div >
      )
      }

      {/* Coupon Modal same rahega */}
      <CouponModal
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        onApply={handleCouponApply}
        loading={couponLoading}
      />
    </>

  );
}
