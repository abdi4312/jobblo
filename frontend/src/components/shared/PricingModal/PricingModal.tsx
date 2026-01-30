import { Modal, Radio, Button, Input } from "antd";
import { useEffect, useState } from "react";
import { getSubscriptionPlans } from "../../../api/subscriptionPlanApi";
import mainLink from "../../../api/mainURLs";
import Swal from "sweetalert2";

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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Coupon modal state
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [couponLoading, setCouponLoading] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await getSubscriptionPlans();
      setPlans(data.filter((plan: Plan) => plan.isActive));
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPlans();
  }, []);

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

  const currentPlans = plans.filter((plan) => plan.type === userType);

  const getIsPopular = (plan: Plan) => {
    if (plan.type === "business") {
      return plan.name === "Premium";
    }
    return plan.name === "Job Plus";
  };

  return (
    <>
      <Modal
        title={
          <span style={{ fontSize: "24px", fontWeight: "bold" }}>
            Våre Priser
          </span>
        }
        open={isOpen}
        onCancel={onClose}
        footer={[
          <Button key="close" onClick={onClose}>
            Lukk
          </Button>,
        ]}
        width="90%"
        style={{ maxWidth: "900px" }}
      >
        <div style={{ padding: "20px 0" }}>
          <Radio.Group
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
          </Radio.Group>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p>Laster planer...</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "20px",
              }}
            >
              {currentPlans.map((plan) => {
                const isPopular = getIsPopular(plan);
                return (
                  <div
                    key={plan._id}
                    style={{
                      border: isPopular
                        ? "2px solid var(--color-primary)"
                        : "1px solid #d9d9d9",
                      borderRadius: "8px",
                      padding: "24px",
                      position: "relative",
                      backgroundColor: isPopular ? "#f6f8f7" : "white",
                    }}
                  >
                    {isPopular && (
                      <div
                        style={{
                          position: "absolute",
                          top: "-12px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          backgroundColor: "var(--color-primary)",
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        POPULÆR
                      </div>
                    )}
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      {plan.name}
                    </h3>
                    <p
                      style={{
                        fontSize: "32px",
                        fontWeight: "bold",
                        color: "#2d4a3e",
                        marginBottom: "8px",
                      }}
                    >
                      {plan.price} kr{" "}
                      <span style={{ fontSize: "16px", fontWeight: "normal" }}>
                        / måned
                      </span>
                    </p>
                    <p style={{ marginBottom: "16px", color: "#666" }}>
                      {plan.entitlements?.freeContact} gratis visninger
                    </p>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        marginBottom: "20px",
                      }}
                    >
                      {plan.featuresText?.map((feature, i) => (
                        <li
                          key={i}
                          style={{
                            marginBottom: "8px",
                            paddingLeft: "20px",
                            position: "relative",
                          }}
                        >
                          <span style={{ position: "absolute", left: 0 }}>
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      type={isPopular ? "primary" : "default"}
                      size="large"
                      block
                      onClick={() => handlePlanSelection(plan._id)}
                      style={
                        isPopular
                          ? {
                              backgroundColor: "var(--color-primary)",
                              borderColor: "var(--color-primary)",
                            }
                          : {}
                      }
                    >
                      Velg {plan.name}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              marginTop: "40px",
              padding: "20px",
              backgroundColor: "#f5f5f5",
              borderRadius: "8px",
            }}
          >
            <h4 style={{ marginBottom: "12px" }}>Viktig informasjon:</h4>
            <ul style={{ paddingLeft: "20px" }}>
              <li>
                Løpende abonnement, må sies opp innen siste dagen i måneden
              </li>
              <li>Transaksjonsgebyr: 2% på alle oppdrag</li>
              {userType === "private" && (
                <li>
                  Privatperson-abonnementer gjelder for oppdrag estimert under
                  15 000 kr
                </li>
              )}
              {userType === "business" && (
                <>
                  <li>
                    Premium-kunder kommer øverst når kunder søker på jobber
                  </li>
                  <li>
                    Start og Pro kommer øverst etter at kunde har sendt
                    forespørsel
                  </li>
                </>
              )}
              {userType === "private" && (
                <li>
                  Privatpersoner vises under bedrifter når det gjelder
                  forespørsler
                </li>
              )}
            </ul>
          </div>
        </div>
      </Modal>

      {/* Beautiful Coupon Modal */}
      <CouponModal
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        onApply={handleCouponApply}
        loading={couponLoading}
      />
    </>
  );
}
