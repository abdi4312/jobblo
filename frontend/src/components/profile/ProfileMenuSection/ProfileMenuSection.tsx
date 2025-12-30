import styles from "./ProfileMenuSection.module.css";
import { ProfileMenuItem } from "../ProfileMenuItem/ProfileMenuItem";
import * as Icons from "../../../assets/icons";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";

export function ProfileMenuSection() {
  const navigate = useNavigate();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  
  const handleMenuItemClick = (item: string) => {
    console.log(`Clicked on: ${item}`);
    // Add navigation logic here
  };

  return (
    <>
      <div className={styles.container}>
        <ProfileMenuItem
          icon={<Icons.ProfileIcon />}
          text="Min profil"
          onClick={() => navigate("/Min-profil")}
        />
        <ProfileMenuItem
          icon={<Icons.CashIcon />}
          text="Min inntekt"
          onClick={() => handleMenuItemClick("Min inntekt")}
        />
        <ProfileMenuItem
          icon={<Icons.MyPostsIcon />}
          text="Mine annonser"
          onClick={() => navigate("/Mine-annonser")}
        />
        <ProfileMenuItem
          icon={<Icons.HeartIcon />}
          text="Favoritter"
          onClick={() => navigate("/favoritter")}
        />
        <ProfileMenuItem
          icon={<Icons.StarIcon />}
          text="Anmeldelser"
          onClick={() => navigate("/Anmeldelser")}
        />
        <ProfileMenuItem
          icon={<Icons.HelpIcon />}
          text="Kundeservice"
          onClick={() => handleMenuItemClick("Kundeservice")}
        />
        <ProfileMenuItem
          icon={<Icons.SettingsIcon />}
          text="Innstillinger"
          onClick={() => navigate("/Innstillinger")}
        />
        <ProfileMenuItem
          icon={<Icons.StarIcon />}
          text="Se våre priser"
          showDivider={false}
          onClick={() => setIsPricingModalOpen(true)}
        />
      </div>
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </>
  );
}
