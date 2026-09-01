/**
 * Messages for the `?error=` codes the Vipps and Google callbacks redirect with.
 *
 * The backend used to send everyone to a bare `/login` on failure, so a refused
 * social login landed on an ordinary empty sign-in form with no explanation — the
 * person had no way to tell "we do not accept this" from "the button is broken".
 *
 * The one that matters most is `*_account_exists`. Sign-in with Vipps or Google no
 * longer attaches the identity to a pre-existing account just because the e-mail
 * addresses match; controlling an address is not proof of owning the account that
 * uses it (see backend/utils/oauthLinking.js). The message has to explain the way
 * out, not just report a refusal: sign in with the password, then connect the
 * provider from the profile page.
 */

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  // An account already uses this e-mail address, and the provider identity is not
  // linked to it. We refuse to link on e-mail alone.
  vipps_account_exists:
    'Det finnes allerede en konto med denne e-postadressen. Logg inn med e-post og passord først — så kan du koble til Vipps fra profilen din.',
  google_account_exists:
    'Det finnes allerede en konto med denne e-postadressen. Logg inn med e-post og passord først — så kan du koble til Google fra profilen din.',

  // The provider identity is already attached to a different Jobblo account.
  vipps_already_linked: 'Denne Vipps-kontoen er allerede koblet til en annen bruker.',
  google_already_linked: 'Denne Google-kontoen er allerede koblet til en annen bruker.',

  // The provider sent no usable subject id, or no e-mail address we can register.
  vipps_identity: 'Vi fikk ikke en gyldig identitet fra Vipps. Prøv igjen.',
  google_identity: 'Vi fikk ikke en gyldig identitet fra Google. Prøv igjen.',
  vipps_no_email: 'Vipps delte ingen e-postadresse, og den trengs for å opprette en konto.',
  google_no_email: 'Google delte ingen e-postadresse, og den trengs for å opprette en konto.',

  // State missing, mismatched or expired — usually a stale tab or a slow login.
  vipps_invalid_state: 'Innloggingen tok for lang tid eller ble avbrutt. Prøv igjen.',

  vipps_failed: 'Vipps-innloggingen mislyktes. Prøv igjen.',
  // ── BankID (Idura Verify) ──────────────────────────────────────────────────
  // Deliberately coarse. The backend distinguishes a bad signature from a wrong
  // issuer from a mismatched nonce for its own logs, but that distinction is
  // information for somebody probing the endpoint and useless to a person holding
  // a code device — so several backend reasons collapse into one message here.
  bankid_verification_failed:
    'BankID-verifiseringen kunne ikke fullføres. Prøv igjen.',
  bankid_invalid_state:
    'BankID-økten var utløpt eller ugyldig. Start verifiseringen på nytt.',
  bankid_cancelled: 'Du avbrøt BankID-verifiseringen.',
  bankid_identity: 'Vi fikk ikke en gyldig identitet fra BankID. Prøv igjen.',
  bankid_already_linked:
    'Denne BankID-identiteten er allerede knyttet til en annen Jobblo-konto.',
  bankid_account_exists:
    'Det finnes allerede en konto med denne e-postadressen. Logg inn først — så kan du verifisere med BankID fra profilen din.',
  bankid_no_email:
    'BankID delte ingen e-postadresse. Opprett en konto med e-post først, og verifiser deretter med BankID fra profilen din.',
  bankid_auth_required: 'Du må være innlogget for å verifisere kontoen din med BankID.',
  bankid_unavailable: 'BankID er ikke tilgjengelig akkurat nå. Prøv igjen senere.',

  google_failed: 'Google-innloggingen mislyktes. Prøv igjen.',
};

/** The message for a `?error=` code, or null when the code is unknown/absent. */
export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return OAUTH_ERROR_MESSAGES[code] ?? 'Innloggingen mislyktes. Prøv igjen.';
}
