import styles from "./ProfileMenuSection.module.css";
import { ProfileMenuItem } from "../ProfileMenuItem/ProfileMenuItem";
import * as Icons from "../../../assets/icons";
import { useNavigate } from "react-router-dom";


export function ProfileMenuSection() {
  const navigate = useNavigate();
  const handleMenuItemClick = (item: string) => {
    console.log(`Clicked on: ${item}`);
    // Add navigation logic here
  };

  return (
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
        onClick={() => handleMenuItemClick("Mine annonser")}
      />
      <ProfileMenuItem
        icon={<Icons.HeartIcon />}
        text="Favoritter"
        onClick={() => handleMenuItemClick("Favoritter")}
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
        showDivider={false}
        onClick={() => navigate("/Innstillinger")}
      />
    </div>
  );
}
