import { Modal, Radio, Button } from "antd";
import { useEffect, useState } from "react";
import { getSubscriptionPlans } from "../../../api/subscriptionPlanApi";
import mainLink from "../../../api/mainURLs";

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
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [userType, setUserType] = useState<"business" | "private">("business");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handlePlanSelection = async(planId: string) => {
    console.log("Selected plan ID:", planId);
    try {
      const res = await mainLink.post("/api/stripe/create-checkout-session", {
        planId,
      });
      console.log(res.data);
      
        window.location.href = res.data.url;
    } catch (error) {
      console.error("Failed to create checkout session:", error);
    }
  };

  // Filter plans based on selected user type
  const currentPlans = plans.filter(plan => plan.type === userType);

  // Determine which plan is popular (Premium for business, Job Plus for private)
  const getIsPopular = (plan: Plan) => {
    if (plan.type === "business") {
      return plan.name === "Premium";
    }
    return plan.name === "Job Plus";
  };

  return (
    <Modal
      title={<div style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center' }}>Våre Priser</div>}
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} size="large">
          Lukk
        </Button>
      ]}
      width="90%"
      style={{ maxWidth: '900px' }}
    >
      <div style={{ padding: '20px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Radio.Group
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            buttonStyle="solid"
            size="large"
          >
            <Radio.Button value="business">Bedrift</Radio.Button>
            <Radio.Button value="private">Privatperson</Radio.Button>
          </Radio.Group>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Laster planer...</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {currentPlans.map((plan) => {
              const isPopular = getIsPopular(plan);

              return (
                <div
                  key={plan._id}
                  style={{
                    border: isPopular ? '2px solid var(--color-primary)' : '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '16px',
                    position: 'relative',
                    backgroundColor: isPopular ? '#f8f9ff' : 'white',
                    transition: 'transform 0.2s',
                    minWidth: '0',
                  }}
                >
                  {isPopular && (
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--color-primary)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      POPULÆR
                    </div>
                  )}
                  <h3 style={{
                    fontSize: '16px',
                    marginBottom: '8px',
                    color: isPopular ? 'var(--color-primary)' : '#333',
                    fontWeight: 700
                  }}>
                    {plan.name}
                  </h3>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--color-text-strong)',
                    marginBottom: '4px'
                  }}>
                    {plan.price} kr
                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#666', display: 'block' }}>/ måned</span>
                  </div>
                  <p style={{ color: '#666', marginBottom: '12px', fontSize: '12px' }}>
                    {plan.entitlements.freeContact} gratis visninger
                  </p>
                  <ul style={{
                    textAlign: 'left',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    marginBottom: '12px',
                    paddingLeft: '18px',
                    minHeight: '80px'
                  }}>
                    {plan.featuresText.map((feature, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{feature}</li>
                    ))}
                  </ul>
                  <Button
                    type={isPopular ? "primary" : "default"}
                    size="small"
                    block
                    style={isPopular ? {} : { borderColor: '#d0d0d0' }}
                    onClick={() => handlePlanSelection(plan._id)}
                  >
                    Velg {plan.name}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '12px',
          lineHeight: '1.5',
          color: '#666'
        }}>
          <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#333' }}>Viktig informasjon:</p>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            <li>Løpende abonnement, må sies opp innen siste dagen i måneden</li>
            <li>Transaksjonsgebyr: 2% på alle oppdrag</li>
            {userType === "private" && (
              <li>Privatperson-abonnementer gjelder for oppdrag estimert under 15 000 kr</li>
            )}
            {userType === "business" && (
              <>
                <li>Premium-kunder kommer øverst når kunder søker på jobber</li>
                <li>Start og Pro kommer øverst etter at kunde har sendt forespørsel</li>
              </>
            )}
            {userType === "private" && (
              <li>Privatpersoner vises under bedrifter når det gjelder forespørsler</li>
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
}