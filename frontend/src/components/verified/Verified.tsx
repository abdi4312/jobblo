import { useUserStore } from "../../stores/userStore";
import styles from "./Verified.module.css";

export default function Verified() {
  const isAuth = useUserStore(
    (state: { isAuthenticated: boolean }) => state.isAuthenticated
  );
  if (!isAuth) {
    return;
  }
  const handleIdura = () => {
    const domain = import.meta.env.VITE_IDURA_DOMAIN;
    const acr = import.meta.env.VITE_IDURA_ACR;
    const clientId = import.meta.env.VITE_IDURA_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_IDURA_REDIRECT_URI;

    if (!domain || !acr || !clientId || !redirectUri) {
      console.error("Idura env variables missing");
      return;
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid email profile",
      state: "idura_login",
    });

    window.location.href = `${domain}/${acr}/oauth2/authorize?${params.toString()}`;
  };

  return (
    <div className={styles["custom-alert-container"]}>
      {/* <span className="material-symbols-outlined alert-icon">warning</span> */}
      <p className={styles["alert-text"]}>
        Identitetsverifisering er påkrevd i henhold til norske regelverk.
        <span
          style={{ textDecoration: "underline", cursor: "pointer" }}
          onClick={handleIdura}
        >
          Verifiser med IDURa.
        </span>
      </p>
    </div>
  );
}
