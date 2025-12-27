import styles from "./Subscription.module.css";
import { Radio, Button, Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function Subscription() {
  const navigate = useNavigate();
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  
  return (
    <>
      <div className={styles.subscriptionContainer}>
        <div className={styles.upperContainerBg}>
          <div className={styles.upperContainer}>
            <h3 style={{ fontSize: '32px', lineHeight: '1.4', maxWidth: '700px', margin: '0 auto 24px' }}>Abonner slik at oppdragene dine blir gjort effektivt.</h3>
          </div>
        </div>
        <div className={styles.lowerContainer}>
          <h3 style={{ fontSize: '24px', marginBottom: '4px', marginTop: '0' }}>Abonement</h3>
          <div className={styles.listContainer}>
            <ul>
              <li>Økt antall visninger</li>
              <li>Økt antall kontakt oppretting</li>
              <li>Økt maks grense for intekt</li>
            </ul>
          </div>
          <Button 
            className={styles.priceButton}
            icon={<span className="material-symbols-outlined">arrow_forward</span>}
            iconPosition="end"
            onClick={() => setIsPriceModalOpen(true)}
          >
            Se våre priser
          </Button>
        </div>
        <Button 
          type="primary" 
          size="large"
          onClick={() => navigate("/job-listing")}
          className={styles.exploreButton}
        >
          Utforsk Jobblo
        </Button>
      </div>

      <Modal
        title={<div style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center' }}>Våre Priser</div>}
        open={isPriceModalOpen}
        onCancel={() => setIsPriceModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsPriceModalOpen(false)} size="large">
            Lukk
          </Button>
        ]}
        width={600}
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Radio.Group 
              value={selectedPlan} 
              onChange={(e) => setSelectedPlan(e.target.value)}
              buttonStyle="solid"
              size="large"
            >
              <Radio.Button value="monthly">Månedlig</Radio.Button>
              <Radio.Button value="yearly">Årlig</Radio.Button>
            </Radio.Group>
          </div>

          {selectedPlan === "monthly" ? (
            <div className={styles.pricingCard}>
              <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-primary)' }}>Månedlig Abonnement</h3>
              <div style={{ fontSize: '48px', fontWeight: 700, color: 'var(--color-text-strong)', marginBottom: '8px' }}>
                399,-
                <span style={{ fontSize: '20px', fontWeight: 400, color: '#666' }}> / måned</span>
              </div>
              <p style={{ color: '#666', marginBottom: '24px' }}>Faktureres hver måned</p>
              <ul style={{ textAlign: 'left', fontSize: '16px', lineHeight: '2', marginBottom: '24px' }}>
                <li>Økt antall visninger på dine annonser</li>
                <li>Opptil 50 kontakt opprettelser per måned</li>
                <li>Prioritert kundeservice</li>
                <li>Maks intekt grense: 50 000 kr/måned</li>
                <li>Verifisert bedriftsbadge</li>
                <li>Analyser og statistikk</li>
              </ul>
              <Button type="primary" size="large" block>
                Velg Månedlig Plan
              </Button>
            </div>
          ) : (
            <div className={styles.pricingCard}>
              <div style={{ 
                background: 'var(--color-primary)', 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: '12px', 
                fontSize: '14px', 
                fontWeight: 600,
                display: 'inline-block',
                marginBottom: '12px'
              }}>
                Spar 20%
              </div>
              <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-primary)' }}>Årlig Abonnement</h3>
              <div style={{ fontSize: '48px', fontWeight: 700, color: 'var(--color-text-strong)', marginBottom: '8px' }}>
                3 830,-
                <span style={{ fontSize: '20px', fontWeight: 400, color: '#666' }}> / år</span>
              </div>
              <p style={{ color: '#666', marginBottom: '24px' }}>Faktureres årlig (kun 319,- per måned)</p>
              <ul style={{ textAlign: 'left', fontSize: '16px', lineHeight: '2', marginBottom: '24px' }}>
                <li>Økt antall visninger på dine annonser</li>
                <li>Ubegrenset kontakt opprettelser</li>
                <li>Prioritert kundeservice 24/7</li>
                <li>Maks intekt grense: 100 000 kr/måned</li>
                <li>Verifisert bedriftsbadge</li>
                <li>Avanserte analyser og statistikk</li>
                <li>Eksklusiv tilgang til nye funksjoner</li>
                <li>Gratis markedsføringsmateriell</li>
              </ul>
              <Button type="primary" size="large" block>
                Velg Årlig Plan
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
