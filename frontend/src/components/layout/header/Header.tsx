import styles from "./Header.module.css";
import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { VerticalDivider } from "../../component/divider/verticalDivider/VerticalDivider.tsx";
import { useNavigate } from "react-router-dom";

export default function Header() {
  const navigate = useNavigate();

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
          <Icons.MessageIcon onClick={() => navigate("/messages")} />
        </div>

        <div className={styles.buttonContainer}>
          <VippsButton />
        </div>
      </div>
    </>
  );
}
