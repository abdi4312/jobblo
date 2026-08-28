/**
 * Messages for the `?error=` codes a Google or Vipps sign-in can come back with.
 *
 * Mirrored from frontend/src/features/auth/oauthErrors.ts so the same refusal reads the
 * same on the phone as it does on the website — the backend emits one vocabulary and both
 * clients have to speak it. Kept as a copy rather than an import because the app is a
 * separate package with no path into the web bundle.
 *
 * The one that matters most is `*_account_exists`. Signing in with Vipps or Google does not
 * attach the identity to a pre-existing account just because the e-mail addresses match;
 * controlling an address is not proof of owning the account that uses it (see
 * backend/utils/oauthLinking.js). The message has to explain the way out, not just report a
 * refusal: sign in with the password first, then connect the provider from the profile.
 *
 * The web file also carries a `bankid_*` block. It is deliberately absent here: the app has
 * no BankID sign-in button, so those codes can never arrive, and copy for a screen that
 * does not exist is copy nobody maintains. BankID *verification* on the backend is
 * untouched — this is only about what this app can be told.
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

  /**
   * Mobile-only. The website returns silently to /login when Vipps itself refuses or the
   * person backs out; the app cannot do that, because "nothing happened" is
   * indistinguishable from "still working on it" once the browser has closed.
   */
  vipps_cancelled: 'Vipps-innloggingen ble avbrutt.',

  vipps_failed: 'Vipps-innloggingen mislyktes. Prøv igjen.',
  google_failed: 'Google-innloggingen mislyktes. Prøv igjen.',

  // The account exists but is closed or deactivated.
  account_deactivated:
    'Denne kontoen er deaktivert. Kontakt support hvis du vil åpne den igjen.',

  // Generic: the hand-off page could not tell us anything more specific.
  oauth_failed: 'Innloggingen mislyktes. Prøv igjen.',
};

/** The message for a `?error=` code, or null when the code is absent. */
export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return OAUTH_ERROR_MESSAGES[code] ?? 'Innloggingen mislyktes. Prøv igjen.';
}
