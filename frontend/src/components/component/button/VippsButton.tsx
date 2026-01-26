import * as Icon from "../../../assets/icons";
// import styles from "./VippsButton.module.css";
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
          className="bg-[#ff5b24] text-white p-[6px] rounded-[6px] gap-1 flex !text-[12px] sm:!text-[14px]"
          onClick={() => navigate("profile")}
        >
          <Icon.VippsIcon/>
          Min side
        </button>
      ) : (
        <button className="bg-[#ff5b24] text-white p-[6px] rounded-[6px] gap-1 flex !text-[12px] sm:!text-[14px]" onClick={handleLogin}>
          <Icon.VippsIcon />
          Logg inn
        </button>
      )}
    </>
  );
}
