const { assuranceLevelFor } = require('../config/iduraClient');

/**
 * Turning a validated Idura ID token into the little that Jobblo stores.
 *
 * The claims arriving here have already been through `openid-client` — signature,
 * issuer, audience, expiry and nonce are all verified before this function is reached.
 * What is left is a product decision: of everything Idura sends, what does Jobblo
 * actually need?
 *
 * Idura's Norwegian BankID returns, per its documentation:
 *
 *   sub, name, given_name, family_name, birthdate, country,
 *   uniqueuserid, identityscheme,                      (all methods)
 *   certissuer, certsubject, nameidentifier,           (kodebrikke)
 *   email, phone_number, authenticationtype, …         (biometrics)
 *   socialno                                           (only with the `ssn` scope)
 *
 * Jobblo keeps seven of those, reduces one, and drops the rest. An allow-list, not a
 * blocklist: a claim Idura adds in a future release cannot end up in the database
 * because nobody remembered to exclude it.
 */

/**
 * Claim names that carry a national identity number.
 *
 * Jobblo never requests the `ssn` scope, so none of these should ever arrive. The check
 * exists anyway because "should never" is not a security control — a dashboard
 * misconfiguration, a scope added by someone debugging, or a change on Idura's side
 * would otherwise quietly persist a fødselsnummer, and the first anyone would know is
 * a subject-access request.
 *
 * `socialno` is the claim Idura documents. The rest are the shapes other Nordic eID
 * integrations use for the same value.
 */
const NATIONAL_ID_CLAIMS = [
  'socialno',
  'ssn',
  'nin',
  'personalidentitynumber',
  'personal_identity_number',
  'nationalidentifier',
  'national_id',
  'fodselsnummer',
  'fødselsnummer',
  'birthnumber',
  'cpr',
];

/** Does this claim set contain a national identity number? */
function findNationalIdClaims(claims) {
  if (!claims || typeof claims !== 'object') return [];
  const lower = new Set(NATIONAL_ID_CLAIMS);
  return Object.keys(claims).filter((key) => lower.has(key.toLowerCase().replace(/[-\s]/g, '_')));
}

/**
 * The year out of an ISO or partial birthdate.
 *
 * Only the year is kept. A full date of birth is a strong identifier and Jobblo has no
 * use for one — the product question is "is this a verified adult person", and the year
 * answers it. Returns undefined rather than guessing when the value is not a date.
 */
function birthYearFrom(birthdate) {
  if (typeof birthdate === 'number' && birthdate > 1900 && birthdate < 2200) return birthdate;
  if (typeof birthdate !== 'string') return undefined;

  const match = birthdate.trim().match(/^(\d{4})/);
  if (!match) return undefined;

  const year = Number(match[1]);
  const thisYear = new Date().getFullYear();
  // A year outside living memory is corrupt data, not a very old customer.
  return year >= 1900 && year <= thisYear ? year : undefined;
}

/** Trimmed non-empty string, or undefined. Keeps blanks out of the document. */
function str(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Build the `identityVerification` subdocument.
 *
 * @param {Object} claims the verified ID token claim set
 * @returns {{ok: true, identity: Object}|{ok: false, reason: string}}
 */
function buildIdentityVerification(claims) {
  if (!claims || typeof claims !== 'object') {
    return { ok: false, reason: 'missing_claims' };
  }

  /**
   * No subject, no identity.
   *
   * `sub` is what makes a returning BankID user the same person as last time. Without
   * it there is nothing to link, nothing to look up, and nothing to make exclusive —
   * and a lookup built from an absent value is how the Vipps callback was once able to
   * resolve to an arbitrary account. Fail closed.
   */
  const subject = str(claims.sub);
  if (!subject) {
    return { ok: false, reason: 'missing_subject' };
  }

  const name =
    str(claims.name) ||
    [str(claims.given_name) || str(claims.givenname), str(claims.family_name) || str(claims.surname)]
      .filter(Boolean)
      .join(' ') ||
    undefined;

  const acr = str(claims.acr) || str(claims.authenticationtype);

  return {
    ok: true,
    identity: {
      provider: 'idura',
      scheme: 'no_bankid',
      subject,
      uniqueUserId: str(claims.uniqueuserid),
      verifiedName: name,
      birthYear: birthYearFrom(claims.birthdate),
      acr,
      assuranceLevel: assuranceLevelFor(acr),
      verifiedAt: new Date(),
    },
  };
}

/**
 * A trustworthy e-mail from the claim set, or null.
 *
 * Only used to decide whether a BRAND NEW account can be created without asking for an
 * address — never to find an existing account. Norwegian BankID via kodebrikke returns
 * no e-mail at all; biometrics returns one. Either way it is not proof of ownership of
 * a Jobblo account that happens to use the same address, and `utils/oauthLinking.js`
 * is what enforces that.
 */
function verifiedEmailFrom(claims) {
  const email = str(claims?.email) || str(claims?.emailaddress);
  if (!email) return null;
  if (claims.email_verified === false) return null;
  return email.toLowerCase();
}

module.exports = {
  buildIdentityVerification,
  findNationalIdClaims,
  verifiedEmailFrom,
  birthYearFrom,
  NATIONAL_ID_CLAIMS,
};
