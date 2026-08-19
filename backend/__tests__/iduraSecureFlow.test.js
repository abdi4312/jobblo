const fs = require('fs');
const path = require('path');
const { stripComments } = require('../test-utils/stripComments');

/**
 * Regression guard for the BankID rebuild.
 *
 * This replaces `iduraDisabled.test.js`, which asserted the opposite: that
 * `/api/auth/idura` answered 410 and the bespoke controller sat in the tree marked
 * unreachable. That was the correct guard while the flow was quarantined through Stage
 * B1, and it is deliberately obsolete now — Stage B2's whole purpose is to make those
 * endpoints live again on top of a real OpenID Connect client. Three of its seven
 * assertions described the quarantine and could not survive; the other four are
 * preserved below.
 *
 * What replaces them is the more useful guard: not "the door is locked" but "the
 * specific mistakes that made the old door dangerous have not come back". Each
 * assertion below maps to a defect in the implementation that was removed.
 *
 * Asserted on source rather than by booting the app: requiring the real router pulls in
 * passport, Stripe config and a Mongo connection, and the wiring is what matters here.
 */

const ROOT = path.join(__dirname, '..');
const FRONTEND = path.join(ROOT, '..', 'frontend', 'src');

const routerCode = stripComments(fs.readFileSync(path.join(ROOT, 'routes', 'auth.js'), 'utf8'));
const controllerCode = stripComments(
  fs.readFileSync(path.join(ROOT, 'controllers', 'iduraAuthController.js'), 'utf8')
);
/**
 * The card moved. It used to be `components/verified/Verified.tsx`, rendered only by
 * `CoinsSection`, which nothing rendered — so it was unreachable on the real profile.
 * It now lives in the profile tree and is mounted at both breakpoints.
 */
const verifiedPath = path.join(FRONTEND, 'components', 'profile', 'IdentityVerificationCard.tsx');
const verifiedCode = stripComments(fs.readFileSync(verifiedPath, 'utf8'));

describe('the BankID endpoints are live and correctly guarded', () => {
  it('routes to the rebuilt controller', () => {
    expect(routerCode).toMatch(/require\('\.\.\/controllers\/iduraAuthController'\)/);

    // Both handlers come off that controller object. The old wiring destructured a
    // bare `iduraCallback` from the removed module.
    expect(routerCode).toMatch(/iduraAuthController\.startIduraAuth/);
    expect(routerCode).toMatch(/iduraAuthController\.iduraCallback/);
    expect(routerCode).not.toMatch(/const\s*\{\s*iduraCallback\s*\}/);
  });

  it('no longer answers 410', () => {
    expect(routerCode).not.toMatch(/IDURA_DISABLED/);
    expect(routerCode).not.toMatch(/router\.all\(\s*['"]\/idura/);
  });

  it('gates the start endpoint on optionalAuthenticate so linking can be authorised', () => {
    expect(routerCode).toMatch(/router\.get\('\/idura',\s*optionalAuthenticate/);
    expect(routerCode).toMatch(/router\.get\('\/idura\/callback'/);
  });

  it('leaves e-mail/password, Vipps and Google login untouched', () => {
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/login['"]/);
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/register['"]/);
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/logout['"]/);
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/refresh-token['"]/);
    expect(routerCode).toMatch(
      /router\.get\(\s*['"]\/vipps['"]\s*,[\s\S]{0,80}?vippsController\.redirectToVipps/
    );
    expect(routerCode).toMatch(
      /router\.get\(\s*['"]\/vipps\/callback['"]\s*,\s*vippsController\.vippsCallback/
    );
    expect(routerCode).toMatch(/passport\.authenticate\(\s*['"]google['"]/);
  });
});

describe('each defect of the old implementation stays fixed', () => {
  it('state is validated — there is no hardcoded constant', () => {
    expect(controllerCode).not.toMatch(/idura_login/);
    expect(controllerCode).toMatch(/validateTransaction/);
    expect(controllerCode).toMatch(/expectedState|pending\.state/);
  });

  it('a nonce and a PKCE verifier are sent and checked', () => {
    expect(controllerCode).toMatch(/nonce/);
    expect(controllerCode).toMatch(/codeVerifier/);
  });

  it('the id_token is required and validated by the OIDC library', () => {
    const client = stripComments(
      fs.readFileSync(path.join(ROOT, 'config', 'iduraClient.js'), 'utf8')
    );
    expect(client).toMatch(/authorizationCodeGrant/);
    expect(client).toMatch(/idTokenExpected:\s*true/);
    expect(client).toMatch(/expectedNonce/);
    expect(client).toMatch(/pkceCodeVerifier/);
  });

  it('the bespoke token exchange is gone', () => {
    expect(controllerCode).not.toMatch(/\/auth\/token/);
    expect(controllerCode).not.toMatch(/IDURA_BASE_URL|IDURA_CALLBACK_URL/);
    expect(controllerCode).not.toMatch(/axios/);
  });

  it('an account is never found by e-mail in order to be linked', () => {
    // The one e-mail lookup that remains decides whether a NEW account can be created;
    // finding an existing one stops the flow rather than adopting it.
    const emailLookups = controllerCode.match(/User\.findOne\(\{\s*email/g) || [];
    expect(emailLookups).toHaveLength(1);
    expect(controllerCode).toMatch(/ACCOUNT_EXISTS/);
  });

  it('no plaintext placeholder is written into password', () => {
    expect(controllerCode).not.toMatch(/password:\s*'oauth-user'/);
    expect(controllerCode).toMatch(/createUnusablePassword\(\)/);
  });

  it('verified is only ever set alongside a validated identity', () => {
    // `verified: true` must appear exactly once, inside applyVerification, which is
    // only reachable after the token has been validated and the identity built.
    const occurrences = controllerCode.match(/verified:\s*true/g) || [];
    expect(occurrences).toHaveLength(1);
    const applyBlock = controllerCode.slice(
      controllerCode.indexOf('function applyVerification'),
      controllerCode.indexOf('async function completeLogin')
    );
    expect(applyBlock).toMatch(/verified:\s*true/);
    expect(applyBlock).toMatch(/identityVerification: identity/);
  });

  it('the ssn scope is never requested and national id claims are refused', () => {
    const client = stripComments(
      fs.readFileSync(path.join(ROOT, 'config', 'iduraClient.js'), 'utf8')
    );
    expect(client).toMatch(/scope:\s*'openid'/);
    expect(client).not.toMatch(/'openid ssn'|scope:.*ssn/);
    expect(controllerCode).toMatch(/findNationalIdClaims/);
  });
});

describe('the frontend never constructs the flow', () => {
  it('builds no authorize URL and reads no Idura config', () => {
    expect(verifiedCode).not.toMatch(/oauth2\/authorize/);
    expect(verifiedCode).not.toMatch(/VITE_IDURA/);
    expect(verifiedCode).not.toMatch(/client_id|code_challenge|nonce=|state=/);
  });

  it('offers verification instead of the disabled notice', () => {
    expect(verifiedCode).toMatch(/Verifiser med BankID/);
    expect(verifiedCode).not.toMatch(/bankid-disabled-notice/);
  });

  it('is actually mounted in the real profile tree', () => {
    // The whole reason the card was invisible: it was rendered only by CoinsSection,
    // and <CoinsSection /> appeared in no JSX anywhere.
    const profilePage = fs.readFileSync(
      path.join(FRONTEND, 'components', 'profile', 'ProfilePage.tsx'),
      'utf8'
    );
    const itemsGrid = fs.readFileSync(
      path.join(FRONTEND, 'components', 'profile', 'ProfileHeader', 'ItemsGrid.tsx'),
      'utf8'
    );

    expect(profilePage).toMatch(/<IdentityVerificationCard/);
    expect(itemsGrid).toMatch(/<IdentityVerificationCard/);
    // One visible at a time, chosen by breakpoint.
    expect(profilePage).toMatch(/className="lg:hidden"/);
    expect(itemsGrid).toMatch(/className="hidden lg:block"/);
  });

  it('does not treat the legacy `verified` flag as BankID verification', () => {
    // `user.verified` is set by an admin action and was set by the removed Idura
    // controller on a bare e-mail match. Showing "Bekreftet med BankID" for it would be
    // a false trust claim.
    expect(verifiedCode).toMatch(/user\?\.identityVerified === true/);
    expect(verifiedCode).not.toMatch(/user\?\.verified/);
    expect(verifiedCode).not.toMatch(/identityVerification\s*\|\|/);
  });

  it('starts the flow only by navigating to the backend endpoint', () => {
    expect(verifiedCode).toMatch(/apiUrl\('\/api\/auth\/idura\?link=1'\)/);
  });

  it('the login screen does not offer BankID while it is commented out', () => {
    /**
     * Deliberately inverted. The "Fortsett med BankID" button on login and register is
     * commented out at the user's request while the Idura test tenant is being
     * configured — the redirect URI and the dashboard registration do not line up yet,
     * so sign-in with BankID is a dead end on those two screens.
     *
     * `stripComments` removes the block, so this asserts it does not RENDER. The
     * profile card below is untouched, and that is the primary use case.
     */
    const authButtons = stripComments(
      fs.readFileSync(path.join(FRONTEND, 'components', 'SocialAuthButtons', 'AuthButton.tsx'), 'utf8')
    );
    expect(authButtons).not.toMatch(/Fortsett med BankID/);
    expect(authButtons).not.toMatch(/go\('\/api\/auth\/idura'\)/);

    // Vipps and Google are unaffected.
    expect(authButtons).toMatch(/go\('\/api\/auth\/vipps'\)/);
    expect(authButtons).toMatch(/go\('\/api\/auth\/google'\)/);
  });

  it('the commented-out block is intact and restorable', () => {
    // Commented out, not deleted — restoring it should be removing two markers, and it
    // must still be the sign-in intent (no `link=1`) when it comes back.
    const raw = fs.readFileSync(
      path.join(FRONTEND, 'components', 'SocialAuthButtons', 'AuthButton.tsx'),
      'utf8'
    );
    expect(raw).toMatch(/BANKID TEMPORARILY HIDDEN/);
    expect(raw).toMatch(/go\('\/api\/auth\/idura'\)/);
    expect(raw).not.toMatch(/idura\?link=1/);
  });

  it('the profile verification entry point is still live', () => {
    // Only the login/register entry point was hidden.
    expect(verifiedCode).toMatch(/apiUrl\('\/api\/auth\/idura\?link=1'\)/);
  });

  it('no VITE_IDURA_* variables remain anywhere in the frontend', () => {
    const envExample = path.join(FRONTEND, '..', '.env.example');
    if (fs.existsSync(envExample)) {
      expect(fs.readFileSync(envExample, 'utf8')).not.toMatch(/^VITE_IDURA/m);
    }
  });
});

describe('verification state reaches the frontend, safely', () => {
  const {
    sanitizeUserOwner,
    sanitizeUserPublic,
    identityVerificationSummary,
    OWN_USER_SELECT,
    PUBLIC_USER_SELECT,
  } = require('../utils/userProjections');

  const withBankId = () => ({
    _id: 'u1',
    name: 'Ola',
    verified: true,
    identityVerification: {
      provider: 'idura',
      scheme: 'no_bankid',
      subject: 'SECRET-SUBJECT',
      uniqueUserId: 'SECRET-UID',
      verifiedName: 'Ola Nordmann',
      birthYear: 1990,
      acr: 'urn:grn:authn:no:bankid',
      assuranceLevel: 'high',
      verifiedAt: new Date('2026-08-18T10:00:00Z'),
    },
  });

  it('is selected by both projections, or it could never be summarised', () => {
    // This was the second half of why the card showed nothing: the field is not in the
    // allow-list, so Mongoose never loaded it and the frontend never saw it.
    expect(OWN_USER_SELECT.split(' ')).toContain('identityVerification');
    expect(PUBLIC_USER_SELECT.split(' ')).toContain('identityVerification');
  });

  it.each([
    ['owner', sanitizeUserOwner],
    ['public', sanitizeUserPublic],
  ])('%s response exposes the summary and strips the raw subdocument', (_label, sanitize) => {
    const out = sanitize(withBankId());

    expect(out.identityVerified).toBe(true);
    expect(out.identityVerificationProvider).toBe('idura');
    expect(out.identityVerifiedAt).toBeTruthy();
    expect(out.identityVerification).toBeUndefined();
  });

  it.each([
    ['owner', sanitizeUserOwner],
    ['public', sanitizeUserPublic],
  ])('%s response leaks no claim data', (_label, sanitize) => {
    const blob = JSON.stringify(sanitize(withBankId()));

    for (const secret of [
      'SECRET-SUBJECT',
      'SECRET-UID',
      'Ola Nordmann',
      'urn:grn',
      '1990',
      'no_bankid',
    ]) {
      expect(blob).not.toContain(secret);
    }
  });

  it('the legacy `verified` flag alone is NOT BankID verification', () => {
    // Set by an admin action, and by the removed Idura controller on a bare e-mail
    // match. Treating it as BankID would badge accounts that never completed BankID.
    const legacy = { _id: 'u2', name: 'Kari', verified: true, accountStatus: 'verified' };

    expect(identityVerificationSummary(legacy).identityVerified).toBe(false);
    expect(sanitizeUserOwner(legacy).identityVerified).toBe(false);
    expect(sanitizeUserPublic(legacy).identityVerified).toBe(false);
  });

  it('a partial or foreign identity does not count', () => {
    for (const iv of [
      { provider: 'idura' },                              // no subject
      { subject: 'abc' },                                 // no provider
      { provider: 'vipps', subject: 'abc' },              // wrong provider
      {},
      null,
    ]) {
      expect(identityVerificationSummary({ identityVerification: iv }).identityVerified).toBe(
        false
      );
    }
  });

  it('an unverified user reports the state explicitly rather than omitting it', () => {
    const out = sanitizeUserOwner({ _id: 'u3', name: 'Per' });

    expect(out.identityVerified).toBe(false);
    expect(out.identityVerificationProvider).toBeNull();
    expect(out.identityVerifiedAt).toBeNull();
  });
});

describe('the session store does not collide with the auth Session collection', () => {
  const appSource = stripComments(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'));
  const sessionModel = stripComments(fs.readFileSync(path.join(ROOT, 'models', 'Session.js'), 'utf8'));

  it('express-session uses its own collection', () => {
    /**
     * `sessions` belongs to models/Session.js — the auth refresh-token store — and it
     * has a UNIQUE index on refreshToken. connect-mongo documents carry no
     * refreshToken, so the first inserts as null and every one after it fails with
     * E11000. BankID could not start at all: req.session.save() threw and the user was
     * bounced back with bankid_verification_failed.
     */
    expect(appSource).toMatch(/collectionName:\s*'expressSessions'/);
    expect(appSource).not.toMatch(/collectionName:\s*'sessions'/);
  });

  it('the collision is real, not hypothetical — Session still declares the unique index', () => {
    // If this ever stops being true the guard above is still correct, but the reason
    // recorded here would be stale.
    expect(sessionModel).toMatch(/refreshToken:[\s\S]{0,120}unique:\s*true/);
  });

  it('the store is still backed by Mongo, reusing the existing connection', () => {
    expect(appSource).toMatch(/require\('connect-mongo'\)\.default/);
    expect(appSource).toMatch(/clientPromise:\s*mongoose\.connection\.asPromise\(\)/);
  });
});
