import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';
import { apiUrl } from '../../config/env';
import { oauthErrorMessage } from '../../features/auth/oauthErrors';
import type { User } from '../../types/userTypes';

/**
 * BankID identity verification, on the profile.
 *
 * This lived in `components/verified/Verified.tsx`, which was rendered only by
 * `CoinsSection` — and `<CoinsSection />` was rendered by nothing at all. Both belonged
 * to the profile implementation that `components/profile/ProfilePage.tsx` replaced, so
 * the card had been unreachable long before BankID was rebuilt on top of it. It is
 * mounted in the real profile tree now.
 *
 * ── What counts as verified ────────────────────────────────────────────────────
 * `identityVerified`, and nothing else. Specifically NOT `user.verified`, which is an
 * older flag set by several unrelated paths — an admin marking an account, and the
 * removed Idura controller which set it on a bare e-mail match. Treating the two as
 * equivalent would put a "Bekreftet med BankID" badge on accounts that never completed
 * BankID, which is a false trust claim on a marketplace where the badge is the point.
 * An account carrying the legacy flag with no Idura identity is shown the CTA, because
 * it genuinely is not BankID-verified.
 *
 * The server decides: `utils/userProjections.js` derives `identityVerified` from
 * `identityVerification.provider === 'idura'` AND a subject, then strips the raw
 * subdocument so the OIDC `sub`, `uniqueuserid`, `acr`, asserted name and birth year
 * never reach the browser at all.
 *
 * ── What this component does NOT do ────────────────────────────────────────────
 * It builds no authorization URL, holds no client id, and knows nothing about OIDC. It
 * navigates to `/api/auth/idura?link=1` and the server does the rest — state, nonce and
 * the PKCE verifier are minted and held server-side. A browser-built authorize URL was
 * the original defect; there is deliberately nothing here to get wrong.
 */

interface IdentityVerificationCardProps {
  user?: User | null;
  /** The CTA is the owner's. A verified badge is shown to everyone. */
  isOwnProfile: boolean;
  className?: string;
}

const CARD = 'rounded-3xl border border-[#E6E7E1] bg-white';

export function IdentityVerificationCard({
  user,
  isOwnProfile,
  className = '',
}: IdentityVerificationCardProps) {
  const [searchParams] = useSearchParams();
  const [isStarting, setIsStarting] = useState(false);

  const isVerified = user?.identityVerified === true;

  // Read-only, so it is safe for this component to be mounted at two breakpoints.
  const errorMessage = oauthErrorMessage(searchParams.get('error'));

  // A stranger looking at an unverified profile gets nothing — an empty "not verified"
  // state would read as an accusation rather than information.
  if (!isVerified && !isOwnProfile) return null;

  if (isVerified) {
    const verifiedAt = user?.identityVerifiedAt
      ? new Date(user.identityVerifiedAt).toLocaleDateString('nb-NO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    return (
      <section
        data-testid="identity-verification-card"
        className={`rounded-3xl border border-[#2E6641]/25 bg-[#EAF1E9] p-5 ${className}`}
      >
        <div className="flex items-start gap-3">
          <BadgeCheck size={20} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[#2E6641]" />
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-bold tracking-[-0.02em] text-[#0B0B0B]">
              Identitet bekreftet
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#3F5A46]">
              Bekreftet med BankID
              {/* The date and nothing else. Never the name BankID asserted, the
                  assurance level, or the birth year — none of it is on a profile. */}
              {verifiedAt ? ` · ${verifiedAt}` : ''}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const startVerification = () => {
    // A second click would start a second OIDC transaction; the server keeps one per
    // session, so the first callback would then fail its state check — a confusing
    // failure for somebody who simply double-tapped.
    if (isStarting) return;
    setIsStarting(true);
    window.location.href = apiUrl('/api/auth/idura?link=1');
  };

  return (
    <section data-testid="identity-verification-card" className={`${CARD} p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[#2E6641]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-bold tracking-[-0.02em] text-[#0B0B0B]">
            Identitetsbekreftelse
          </h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
            Bekreft identiteten din med BankID for å skape mer trygghet på Jobblo.
          </p>

          {errorMessage && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-[#FCF4F3] px-3 py-2 text-[0.8125rem] leading-snug text-[#B0453B]"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={startVerification}
            disabled={isStarting}
            aria-busy={isStarting}
            data-testid="bankid-verify-button"
            // h-11 is the 44px touch target; full width so it is easy to hit on a phone
            // and still reads as a card action in the 20rem desktop column.
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2E6641] px-4 text-[0.875rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {isStarting ? (
              <>
                <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
                Åpner BankID …
              </>
            ) : (
              <>
                <ShieldCheck size={15} strokeWidth={2.2} />
                Verifiser med BankID
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

export default IdentityVerificationCard;
