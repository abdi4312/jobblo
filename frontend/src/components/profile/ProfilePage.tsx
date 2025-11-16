import styles from "./ProfilePage.module.css";
import { ProfileHeader } from "./ProfileHeader/ProfileHeader";
import { CoinsSection } from "./CoinsSection/CoinsSection";
import { ProfileMenuSection } from "./ProfileMenuSection/ProfileMenuSection";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className={styles.container}>
      <ProfileHeader />
      <CoinsSection />
      <ProfileMenuSection />
      
      <button
        onClick={handleLogout}
        style={{
          width: "90%",
          maxWidth: "400px",
          margin: "24px auto",
          padding: "16px",
          backgroundColor: "#ff4444",
          color: "white",
          border: "none",
          borderRadius: "12px",
          fontSize: "16px",
          fontWeight: "600",
          cursor: "pointer",
          display: "block",
        }}
      >
        Logg ut
      </button>
    </div>
  );
}
