import { Award } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';

/**
 * Membership / verification card.
 *
 * The BankID ("Verifiser nå") action is INTENTIONALLY DISABLED.
 *
 * It used to build an Idura authorize URL in the browser and send the user straight
 * into an OAuth flow that was not safe to complete:
 *
 *   - `state` was the hardcoded constant 'idura_login', so it carried no CSRF
 *     protection whatsoever;
 *   - no `nonce` and no PKCE were sent;
 *   - the backend callback never requested or verified an `id_token`, so nothing
 *     proved the identity assertion actually came from Idura;
 *   - that callback then linked to any existing account whose e-mail happened to
 *     match and marked it `verified` — an account-takeover path.
 *
 * The backend half now answers 410 (see routes/auth.js), so leaving the button live
 * would only produce a dead end. The card still renders, because "verify your
 * profile" is real product copy and the section is linked from the profile page —
 * it just states that the method is temporarily unavailable instead of starting a
 * flow that cannot safely finish.
 *
 * Re-enable only together with the rebuilt server-side OIDC flow (authorization code
 * + PKCE, `state`/`nonce` in the session, verified `id_token`). The old click handler
 * is not preserved here on purpose: it should not be restored, it should be replaced.
 */
export default function Verified() {
  const isAuth = useUserStore((state: { isAuthenticated: boolean }) => state.isAuthenticated);
  if (!isAuth) {
    return null;
  }

  return (
    <div className="bg-[linear-gradient(111.15deg,#2BFF00_-59.46%,#A9FF98_100%)] flex items-center p-6 gap-4 rounded-[14px]">
      <div>
        <Award size={50} className="text-white bg-custom-green rounded-full p-3" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[18px] font-bold leading-7 text-custom-black">
          Medlemskapsinformasjon
        </p>
        <p className="text-[14px] font-normal text-[#4A5565] leading-5">
          Verifiser og fullfør profilen din for å kunne jobbe og annonsere på Jobblo.
        </p>
        <p className="text-[13px] font-medium text-[#4A5565] leading-5" data-testid="bankid-disabled-notice">
          Verifisering med BankID er midlertidig utilgjengelig. Du kan bruke Jobblo som
          vanlig i mellomtiden — vi gir beskjed så snart den er klar.
        </p>
      </div>
    </div>
  );
}
