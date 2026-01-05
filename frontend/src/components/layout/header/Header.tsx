import styles from "./Header.module.css";
import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { VerticalDivider } from "../../component/divider/verticalDivider/VerticalDivider.tsx";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { toast } from 'react-toastify';

export default function Header() {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      toast.warning("Du må være logget inn for å få tilgang");
      navigate("/login");
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.jobbloIcon} onClick={() => navigate("/")}>
          <Icons.JobbloIcon />
        </div>

        <div className={styles.iconContainer}>
          <Icons.BellIcon onClick={() => handleProtectedNavigation("/Alert")} />
          <VerticalDivider />
          <Icons.PlusIcon onClick={() => handleProtectedNavigation("/publish-job")} />
          <VerticalDivider />
          <Icons.MessageIcon onClick={() => handleProtectedNavigation("/messages")} />
        </div>

        <div className={styles.buttonContainer}>
          <VippsButton />
        </div>
      </div>
    </>
  );
}
