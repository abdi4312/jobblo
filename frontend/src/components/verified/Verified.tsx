import { Award, ChevronRight } from "lucide-react";
import { useUserStore } from "../../stores/userStore";

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
    <>
      <div className="bg-[linear-gradient(111.15deg,#2BFF00_-59.46%,#A9FF98_100%)] flex items-center p-6 gap-4 rounded-[14px]">
        <div className=""><Award size={50} className="text-white bg-[#2F7E47] rounded-full p-3" /></div>
        <div className="flex flex-col gap-2">
          <p className="text-[18px] font-bold leading-7 text-[#0A0A0A]">Medlemskapsinformasjon</p>
          <p className="text-[14px] font-normal text-[#4A5565] leading-5">Verifiser og fullfør profilen din for å kunne jobbe og annonsere på Jobblo.</p>
          <div className="flex items-center text-[#2D6640] gap-1 cursor-pointer" onClick={handleIdura}>
            <p className="text-[14px] font-bold leading-5">Verifiser nå</p>
            <span><ChevronRight size={16} /></span>
          </div>
        </div>
      </div>
    </>
  );
}
