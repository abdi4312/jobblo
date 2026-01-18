import styles from "./Footer.module.css";
import { Link } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";

export default function Footer() {
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  return (
    <>
      <footer className={styles.container}>
        <div className={styles.columns}>
          {/* Kolonne 1 – Jobblo */}
          <div className={styles.company}>
            <p className={styles.title}>Jobblo</p>
            <Link to="/om-oss">Om oss</Link>
            <Link to="/tjenester">Tjenester</Link>
            <Link to="/team">Vårt team</Link>
            <a onClick={() => setIsPricingModalOpen(true)} style={{ cursor: 'pointer' }}>Se våre priser</a>
          </div>

          {/* Kolonne 2 – Kundeservice */}
          <div className={styles.knowMore}>
            <p className={styles.title}>Kundeservice</p>
            <Link to="/support">Support</Link>
            <Link to="/annonseregler">Annonseregler</Link>
          </div>

          {/* Kolonne 3 – Rettigheter */}
          <div className={styles.rights}>
            <p className={styles.title}>Rettigheter</p>
            <Link to="/user-term">Brukervilkår</Link>
            <Link to="/sale-subscription-terms">
              Vilkår for bruk og abonnement
            </Link>
          </div>
        </div>
        <div className={styles.bottom}>
          <p>© 2026 Jobblo. All rights reserved.</p>
        </div>
      </footer>
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </>
  );
}
