import styles from "./Subscription.module.css";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";

export function Subscription() {
  const navigate = useNavigate();
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  
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

      <PricingModal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} />
    </>
  );
}
