import styles from "./ProfilePage.module.css";
import { ProfileHeader } from "./ProfileHeader/ProfileHeader";
import { CoinsSection } from "./CoinsSection/CoinsSection";
import { ProfileMenuSection } from "./ProfileMenuSection/ProfileMenuSection";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { App } from 'antd';

export default function ProfilePage() {
  const logout = useUserStore((state) => state.logout);
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();
  const { modal } = App.useApp();

  const handleLogout = () => {
    modal.confirm({
      title: 'Er du sikker?',
      content: 'Vil du virkelig logge ut?',
      okText: 'Ja, logg ut',
      cancelText: 'Avbryt',
      onOk() {
        logout();
        toast.success("Du har blitt logget ut");
        navigate("/");
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <ProfileHeader />

        <CoinsSection />
        <ProfileMenuSection />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={styles.logoutButton}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            logout
          </span>
          Logg ut
        </button>
      </div>
    </div>
  );
}
