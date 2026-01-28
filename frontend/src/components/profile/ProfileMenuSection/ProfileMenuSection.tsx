import styles from "./ProfileMenuSection.module.css";
import { ProfileMenuItem } from "../ProfileMenuItem/ProfileMenuItem";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";

export function ProfileMenuSection() {
  const navigate = useNavigate();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const iconStyle = { color: "var(--color-accent)", fontSize: "24px" };

  return (
    <>
      <div className={styles.container}>
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>person</span>}
          text="Min profil"
          onClick={() => navigate("/Min-profil")}
        />
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>payments</span>}
          text="Min inntekt"
          onClick={() => navigate("/min-inntekt")}
        />
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>campaign</span>}
          text="Mine annonser"
          onClick={() => navigate("/Mine-annonser")}
        />
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>favorite</span>}
          text="Favoritter"
          onClick={() => navigate("/favoritter")}
        />
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>star</span>}
          text="Anmeldelser"
          onClick={() => navigate("/Anmeldelser")}
        />
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>support_agent</span>}
          text="Kundeservice"
          onClick={() => navigate("/Support")}
        />
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>settings</span>}
          text="Innstillinger"
          onClick={() => navigate("/Innstillinger")}
        />
        <ProfileMenuItem
          icon={<span className="material-symbols-outlined" style={iconStyle}>sell</span>}
          text="Endre abonnement"
          showDivider={false}
          onClick={() => setIsPricingModalOpen(true)}
        />
      </div>
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </>
  );
}
