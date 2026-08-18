/**
 * The only module in the codebase that touches `openid-client`.
 *
 * ── Why this library ───────────────────────────────────────────────────────────
 * Idura Verify is Criipto white-labelled (the vendor's own Express package is
 * `@criipto/verify-express`, and the Norwegian BankID ACRs are Criipto's
 * `urn:grn:authn:no:bankid…` namespace). Both Idura's OIDC introduction and its
 * security-practices page say to use a standard OIDC library rather than hand-rolling
 * the flow, and explicitly warn that receiving a JWT is not the same as validating one.
 *
 * `openid-client` is the certified OpenID Connect Relying Party implementation for
 * Node. It performs discovery, builds the authorization URL, exchanges the code, and —
 * the part that matters — validates the `id_token` signature against the issuer's JWKS
 * and checks `iss`, `aud`, `exp`, `iat` and `nonce` before returning anything. Writing
 * any of that by hand is how these integrations go wrong.
 *
 * `@criipto/verify-express` was the other candidate. It is the vendor's own package,
 * but it is a thin Passport strategy that owns its own session keys and expresses only
 * "log this person in" — it has no way to carry "attach this identity to the account
 * that is already signed in", which is Jobblo's primary use case. Driving
 * `openid-client` directly keeps the transaction state, the intent and the account
 * decision in our hands, where the security review can see them.
 *
 * ── Why the dynamic import ─────────────────────────────────────────────────────
 * The backend is CommonJS. `openid-client` v6 is ESM-only (`"type": "module"`), so it
 * cannot be `require()`d. The alternative was pinning v5, the last CommonJS release,
 * for a brand-new security-sensitive integration — a legacy major on day one. Instead
 * the ESM module is pulled in once via `await import()`, which Node has supported from
 * CommonJS for years, and cached. The cost is that every entry point here is async,
 * which they already are.
 *
 * Nothing outside this file imports `openid-client`, so a future swap — to the vendor
 * package, or to v7 — touches one module.
 */

const { load: loadClient } = require('./oidcModule');

/** Cached discovery result, keyed by issuer so a config change is picked up on restart. */
let configPromise = null;
let configKey = null;

/**
 * Norwegian BankID, as Idura names it.
 *
 *   urn:grn:authn:no:bankid              kodebrikke / code device
 *   urn:grn:authn:no:bankid:high         kodebrikke, explicitly high assurance
 *   urn:grn:authn:no:bankid:substantial  BankID Biometrics, substantial assurance
 *
 * Default is the plain kodebrikke value, which is the broadest — biometrics is not
 * available to every holder. `IDURA_ACR_VALUES` overrides it without a code change.
 */
const DEFAULT_ACR = 'urn:grn:authn:no:bankid';

/** Map the returned acr onto the two levels the User schema records. */
function assuranceLevelFor(acr) {
  if (typeof acr !== 'string') return undefined;
  if (acr.endsWith(':substantial')) return 'substantial';
  // Both the bare value and ':high' are kodebrikke, which Idura documents as high.
  if (acr.startsWith('urn:grn:authn:no:bankid')) return 'high';
  return undefined;
}

/**
 * The tenant issuer URL.
 *
 * Idura issues a domain per tenant — the dashboard documents the development form as
 * `<tenant>.test.idura.broker`. `IDURA_ISSUER` may be given with or without a scheme;
 * a bare domain is assumed https, because an OIDC issuer over plaintext is not a thing
 * we should quietly accept.
 */
function issuerUrl(env = process.env) {
  const raw = String(env.IDURA_ISSUER || env.IDURA_DOMAIN || '').trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme.replace(/\/+$/, ''));
  } catch {
    return null;
  }
}

/**
 * Is BankID switched on?
 *
 * Every entry point checks this and the routes answer 503 when it is false, so an
 * unconfigured environment produces a clear "not available here" rather than a crash
 * or, worse, a half-completed authentication.
 */
function isIduraConfigured(env = process.env) {
  return Boolean(
    issuerUrl(env) && env.IDURA_CLIENT_ID && env.IDURA_CLIENT_SECRET && env.IDURA_REDIRECT_URI
  );
}

/**
 * Discover the tenant's OIDC configuration.
 *
 * `discovery()` fetches `/.well-known/openid-configuration` and returns a Configuration
 * carrying the endpoints and the JWKS location. Cached for the process: the document is
 * stable, and re-fetching it on every login would add a round trip to the authorization
 * redirect and a dependency on Idura being reachable at that exact moment.
 */
async function getIduraConfig(env = process.env) {
  if (!isIduraConfigured(env)) {
    throw new Error('Idura is not configured');
  }

  const issuer = issuerUrl(env);
  const key = `${issuer.href}|${env.IDURA_CLIENT_ID}`;

  if (!configPromise || configKey !== key) {
    configKey = key;
    const client = await loadClient();
    configPromise = client
      .discovery(
        issuer,
        String(env.IDURA_CLIENT_ID),
        undefined,
        // Idura generates a client secret for server-side ("Regular Web Application")
        // clients. client_secret_post is the widely supported form.
        client.ClientSecretPost(String(env.IDURA_CLIENT_SECRET))
      )
      .catch((err) => {
        // Do not cache a failure: a transient network problem at boot would otherwise
        // disable BankID until the process restarts.
        configPromise = null;
        configKey = null;
        throw err;
      });
  }

  return configPromise;
}

/**
 * Fresh, cryptographically random per-transaction values.
 *
 * From the library rather than our own `crypto` calls so the encodings are exactly what
 * the verification side expects — in particular the PKCE verifier's charset and length,
 * which are constrained by RFC 7636.
 */
async function createTransactionSecrets() {
  const client = await loadClient();
  const codeVerifier = client.randomPKCECodeVerifier();
  return {
    state: client.randomState(),
    nonce: client.randomNonce(),
    codeVerifier,
    codeChallenge: await client.calculatePKCECodeChallenge(codeVerifier),
  };
}

/**
 * Build the URL to send the browser to.
 *
 * `scope` is `openid` only. Idura returns name and birthdate for Norwegian BankID with
 * no additional scope, and the one scope that would add a national identity number —
 * `ssn` — is deliberately never requested. See STEP 9 of the brief and
 * `assertNoNationalIdentityNumber` in utils/iduraIdentity.js.
 */
async function buildAuthorizationUrl({ state, nonce, codeChallenge }, env = process.env) {
  const client = await loadClient();
  const config = await getIduraConfig(env);

  return client.buildAuthorizationUrl(config, {
    redirect_uri: String(env.IDURA_REDIRECT_URI),
    scope: 'openid',
    response_type: 'code',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    acr_values: String(env.IDURA_ACR_VALUES || DEFAULT_ACR),
  });
}

/**
 * Exchange the code and validate the resulting ID token.
 *
 * Everything security-relevant happens inside `authorizationCodeGrant`:
 *
 *   - the authorization response `state` must equal `expectedState`;
 *   - the `id_token` signature is verified against the issuer's JWKS;
 *   - `iss` must match the discovered issuer and `aud` our client id;
 *   - `exp` / `iat` are checked against the clock;
 *   - the `nonce` claim must equal `expectedNonce`, which is what stops an `id_token`
 *     minted for a different authentication transaction being replayed into this one;
 *   - `pkceCodeVerifier` is sent to the token endpoint, so an intercepted code is
 *     useless without the verifier that never left this server.
 *
 * Any failure throws. There is no branch here that returns a partially validated
 * result, and the caller treats a throw as a failed login — nothing is written.
 *
 * @param {URL} currentUrl the full callback URL as received, including the query string
 */
async function exchangeCode(currentUrl, { state, nonce, codeVerifier }, env = process.env) {
  const client = await loadClient();
  const config = await getIduraConfig(env);

  return client.authorizationCodeGrant(config, currentUrl, {
    expectedState: state,
    expectedNonce: nonce,
    pkceCodeVerifier: codeVerifier,
    // Refuse a response with no ID token. Without this an authorization server that
    // returned only an access token would sail through, and there would be no signed
    // assertion of identity at all.
    idTokenExpected: true,
  });
}

module.exports = {
  isIduraConfigured,
  issuerUrl,
  getIduraConfig,
  createTransactionSecrets,
  buildAuthorizationUrl,
  exchangeCode,
  assuranceLevelFor,
  DEFAULT_ACR,
};
