import { Modal, Radio, Button } from "antd";
import { useState } from "react";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [userType, setUserType] = useState<"business" | "private">("business");
  
  const businessPlans = [
    {
      name: "Gratis",
      price: 0,
      freeViews: 2,
      features: [
        "2 gratis visninger",
        "Grunnleggende funksjoner",
        "Begrenset tilgang"
      ]
    },
    {
      name: "Start",
      price: 199,
      freeViews: 5,
      features: [
        "5 gratis visninger",
        "Kommer øverst etter forespørsel",
        "Standardsupport"
      ]
    },
    {
      name: "Pro",
      price: 399,
      freeViews: 10,
      features: [
        "10 gratis visninger",
        "Kommer øverst etter forespørsel",
        "Prioritert support"
      ]
    },
    {
      name: "Premium",
      price: 639,
      freeViews: 20,
      popular: true,
      features: [
        "20 gratis visninger",
        "Kommer øverst når kunder søker",
        "Premium support 24/7",
        "Verifisert bedriftsbadge"
      ]
    }
  ];

  const privatePlans = [
    {
      name: "Gratis",
      price: 0,
      freeViews: 2,
      features: [
        "2 gratis visninger",
        "Grunnleggende funksjoner",
        "Begrenset tilgang"
      ]
    },
    {
      name: "Fleksibel",
      price: 99,
      freeViews: 5,
      features: [
        "5 gratis visninger",
        "Standardsupport",
        "Estimat under 15 000 kr"
      ]
    },
    {
      name: "Jobbpluss",
      price: 149,
      freeViews: 15,
      popular: true,
      features: [
        "15 gratis visninger",
        "Prioritert support",
        "Estimat under 15 000 kr",
        "Ekstra fordeler"
      ]
    }
  ];

  const currentPlans = userType === "business" ? businessPlans : privatePlans;

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

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '16px',
          marginBottom: '24px'
        }}>
          {currentPlans.map((plan, index) => (
            <div 
              key={index}
              style={{
                border: plan.popular ? '2px solid var(--color-primary)' : '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '16px',
                position: 'relative',
                backgroundColor: plan.popular ? '#f8f9ff' : 'white',
                transition: 'transform 0.2s',
                minWidth: '0',
              }}
            >
              {plan.popular && (
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
                color: plan.popular ? 'var(--color-primary)' : '#333',
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
                {plan.freeViews} gratis visninger
              </p>
              <ul style={{ 
                textAlign: 'left', 
                fontSize: '12px', 
                lineHeight: '1.6', 
                marginBottom: '12px',
                paddingLeft: '18px',
                minHeight: '80px'
              }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{feature}</li>
                ))}
              </ul>
              <Button 
                type={plan.popular ? "primary" : "default"}
                size="small" 
                block
                style={plan.popular ? {} : { borderColor: '#d0d0d0' }}
              >
                Velg {plan.name}
              </Button>
            </div>
          ))}
        </div>

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
            <li>Privatperson-abonnementer gjelder for oppdrag estimert under 15 000 kr</li>
            <li>Premium-kunder kommer øverst når kunder søker på jobber</li>
            <li>Start og Pro kommer øverst etter at kunde har sendt forespørsel</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
