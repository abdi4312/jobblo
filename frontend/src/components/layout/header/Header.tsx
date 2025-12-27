import styles from "./Header.module.css";
import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { VerticalDivider } from "../../component/divider/verticalDivider/VerticalDivider.tsx";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore.ts";
import { toast } from 'react-toastify';
import { Modal } from 'antd';

export default function Header() {
  const navigate = useNavigate();
  const logout = useUserStore((state) => state.logout);
  const isAuth = useUserStore((state) => state.isAuthenticated);

  function handleLogout() {
    Modal.confirm({
      title: 'Er du sikker?',
      content: 'Vil du virkelig logge ut?',
      okText: 'Ja, logg ut',
      cancelText: 'Avbryt',
      onOk() {
        logout();
        toast.success("Du har blitt logget ut");
        navigate("/login");
      },
    });
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.jobbloIcon} onClick={() => navigate("/")}>
          <Icons.JobbloIcon />
        </div>

        <div className={styles.iconContainer}>
          <Icons.BellIcon onClick={() => navigate("/Alert")} />
          <VerticalDivider />
          <Icons.PlusIcon onClick={() => navigate("/publish-job")} />
          <VerticalDivider />
          <Icons.MessageIcon />
        </div>

        <div className={styles.buttonContainer}>
          <VippsButton />
          {isAuth && <button onClick={handleLogout}>logout</button>}
        </div>
      </div>
    </>
  );
}
