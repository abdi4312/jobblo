import styles from "./Footer.module.css";
import { Link } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";

export default function Footer() {
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  return (
    <>
      <footer className={styles.container}>
        <p className={styles.title}>Jobblo</p>
        <Link to="/om-oss">Om oss</Link>
        <Link to="/tjenester">Tjenester</Link>
        <Link to="/team">Vårt team</Link>
        <Link to="/user-term">Brukervilkår</Link>
        <Link to="/sale-subscription-terms">Vilkår for bruk og abonnement</Link>
        <Link to="/support">Support</Link>
        <Link to="/annonseregler">Annonseregler</Link>
        <a onClick={() => setIsPricingModalOpen(true)} style={{ cursor: 'pointer' }}>Se våre priser</a>
      </footer>
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </>
  );
}
