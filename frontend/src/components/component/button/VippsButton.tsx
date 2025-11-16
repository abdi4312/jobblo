import * as Icon from "../../../assets/icons";
import styles from "./VippsButton.module.css";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore.ts";

export function VippsButton() {
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const navigate = useNavigate();

  function handleLogin() {
    navigate("/login");
  }

  return (
    <>
      {isAuth ? (
        <button
          className={styles.buttonContainer}
          onClick={() => navigate("profile")}
        >
          <Icon.VippsIcon />
          Min side
        </button>
      ) : (
        <button className={styles.buttonContainer} onClick={handleLogin}>
          <Icon.VippsIcon />
          Logg inn
        </button>
      )}
    </>
  );
}
