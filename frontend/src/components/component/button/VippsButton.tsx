import * as Icon from "../../../assets/icons";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore.ts";
import { Button } from "../../Ui/Button.tsx";

export function VippsButton() {
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const navigate = useNavigate();

  function handleLogin() {
    navigate("/login");
  }

  return (
    <>
      {isAuth ? (
        <Button label="Min Side" size="lg" icon={<Icon.VippsIcon />} onClick={() => navigate("profile")}></Button>
      ) : (
        <Button label="Logg inn/Registrer deg" size="lg" onClick={handleLogin} ></Button>
      )}
    </>
  );
}
