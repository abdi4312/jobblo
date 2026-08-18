const fs = require('fs');
const path = require('path');
const { stripComments } = require('../test-utils/stripComments');

/**
 * Regression guard: the insecure Idura / BankID path must stay unreachable.
 *
 * The implementation in the Idura controller is not a safe OIDC client — no `state`
 * validation (the frontend sent a hardcoded constant), no nonce, no PKCE, no verified
 * id_token, a bespoke token exchange, account linking on bare e-mail equality, and a
 * literal non-hashed string written into `password`.
 *
 * It is disabled rather than deleted, which is exactly the situation that rots: the
 * controller still sits in the tree looking callable, and re-wiring it is a one-line
 * change someone could make while tidying up. This test is the tripwire.
 *
 * It asserts on source rather than by booting the app, because requiring the real
 * router pulls in passport, Stripe config and a Mongo connection. What matters here is
 * the wiring, and the wiring is visible in the file.
 */

const ROOT = path.join(__dirname, '..');
const routerSource = fs.readFileSync(path.join(ROOT, 'routes', 'auth.js'), 'utf8');
const verifiedPath = path.join(ROOT, '..', 'frontend', 'src', 'components', 'verified', 'Verified.tsx');

const routerCode = stripComments(routerSource);

describe('Idura / BankID entry points are disabled', () => {
  it('does not route the callback to the insecure controller', () => {
    expect(routerCode).not.toMatch(/router\.get\(\s*['"]\/idura\/callback['"]\s*,\s*iduraCallback/);
    expect(routerCode).not.toMatch(/\biduraCallback\b/);
  });

  it('does not import the Idura controller into the live router', () => {
    expect(routerCode).not.toMatch(/iduraAuthcontroller/);
  });

  it('answers both Idura endpoints with an explicit disabled response', () => {
    expect(routerCode).toMatch(/router\.all\(\s*['"]\/idura\/callback['"]/);
    expect(routerCode).toMatch(/router\.all\(\s*['"]\/idura['"]/);
    expect(routerCode).toMatch(/status\(410\)/);
    expect(routerCode).toMatch(/IDURA_DISABLED/);
  });

  it('keeps the controller in the tree, marked unreachable, for the planned rebuild', () => {
    const controllerPath = path.join(ROOT, 'controllers', 'iduraAuthcontroller.js');
    expect(fs.existsSync(controllerPath)).toBe(true);
    expect(fs.readFileSync(controllerPath, 'utf8')).toMatch(/INTENTIONALLY DISABLED/);
  });

  it('leaves e-mail/password and Vipps login untouched', () => {
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/login['"]/);
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/register['"]/);
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/logout['"]/);
    expect(routerCode).toMatch(/router\.post\(\s*['"]\/refresh-token['"]/);
    expect(routerCode).toMatch(/router\.get\(\s*['"]\/vipps['"]\s*,\s*vippsController\.redirectToVipps/);
    expect(routerCode).toMatch(
      /router\.get\(\s*['"]\/vipps\/callback['"]\s*,\s*vippsController\.vippsCallback/
    );
    expect(routerCode).toMatch(/passport\.authenticate\(\s*['"]google['"]/);
  });
});

describe('the frontend cannot start the Idura flow', () => {
  it('has no authorize-URL construction left in the verification card', () => {
    const code = stripComments(fs.readFileSync(verifiedPath, 'utf8'));

    expect(code).not.toMatch(/oauth2\/authorize/);
    expect(code).not.toMatch(/VITE_IDURA/);
    expect(code).not.toMatch(/window\.location\.href\s*=/);
  });

  it('tells the user the method is unavailable instead of offering it', () => {
    const source = fs.readFileSync(verifiedPath, 'utf8');
    expect(source).toMatch(/bankid-disabled-notice/);
    expect(stripComments(source)).not.toMatch(/Verifiser nå/);
  });
});
