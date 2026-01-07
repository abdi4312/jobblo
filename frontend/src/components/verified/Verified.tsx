import { useUserStore } from "../../stores/userStore";

export default function Verified() {

    const isAuth = useUserStore((state: { isAuthenticated: boolean }) => state.isAuthenticated);
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
    <div>
      <button
        onClick={handleIdura}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Verify with BankID
      </button>
    </div>
  );
}
