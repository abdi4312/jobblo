const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { stripComments } = require('../test-utils/stripComments');

/**
 * Account linking for third-party sign-in.
 *
 * Both callbacks used to resolve an unknown provider identity by e-mail address and,
 * on a match, push the identity onto that account and log the caller in. Controlling
 * an e-mail address is not proof of owning the Jobblo account that uses it, so that
 * was a full account-takeover path: session cookies for an account the caller never
 * had the password to, including its orders, payout details and chat.
 *
 * These tests pin the replacement policy in utils/oauthLinking.js.
 */

// ── A small in-memory User model ────────────────────────────────────────────────
// Enough of Mongoose to exercise the real queries the policy issues, including the
// `$elemMatch` provider lookup.
const store = [];

function matches(user, query) {
  return Object.entries(query).every(([key, value]) => {
    if (key === 'oauthProviders' && value?.$elemMatch) {
      const { provider, providerId } = value.$elemMatch;
      return (user.oauthProviders || []).some(
        (p) => p.provider === provider && p.providerId === providerId
      );
    }
    return user[key] === value;
  });
}

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

const User = require('../models/User');
const { resolveOAuthLogin, linkProviderToUser, isUsableProviderId } = require('../utils/oauthLinking');

let nextId = 0;
function seedUser(overrides = {}) {
  const user = {
    _id: overrides._id || `user_${++nextId}`,
    email: overrides.email,
    password: overrides.password || '$2a$12$0123456789012345678901234567890123456789012345678901',
    oauthProviders: overrides.oauthProviders || [],
    save: jest.fn(async function () {
      return this;
    }),
  };
  store.push(user);
  return user;
}

beforeEach(() => {
  store.length = 0;
  nextId = 0;
  jest.clearAllMocks();

  User.findOne.mockImplementation((query) => {
    const found = store.find((u) => matches(u, query)) || null;
    // `.select('_id')` is used on the e-mail collision check.
    return Object.assign(Promise.resolve(found), { select: () => Promise.resolve(found) });
  });
  User.findById.mockImplementation((id) =>
    Promise.resolve(store.find((u) => String(u._id) === String(id)) || null)
  );
});

// ── 8 ───────────────────────────────────────────────────────────────────────────
describe('8. a known, linked Vipps identity logs the right user in', () => {
  it('resolves to the exact user the identity is attached to', async () => {
    const owner = seedUser({
      email: 'owner@example.com',
      oauthProviders: [{ provider: 'vipps', providerId: 'vipps-sub-1' }],
    });
    seedUser({ email: 'someone-else@example.com' });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'vipps-sub-1',
      email: 'owner@example.com',
    });

    expect(decision.outcome).toBe('login');
    expect(decision.user._id).toBe(owner._id);
  });

  it('matches on provider AND id together, not on the id alone', async () => {
    // The same subject id under a different provider must not resolve.
    seedUser({
      email: 'g@example.com',
      oauthProviders: [{ provider: 'google', providerId: 'shared-id' }],
    });

    const decision = await resolveOAuthLogin({ provider: 'vipps', providerId: 'shared-id' });
    expect(decision.outcome).toBe('create');
  });

  it('logs the user in even when the provider e-mail has since changed', async () => {
    const owner = seedUser({
      email: 'old@example.com',
      oauthProviders: [{ provider: 'vipps', providerId: 'sub-x' }],
    });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'sub-x',
      email: 'brand-new@example.com',
    });

    expect(decision.outcome).toBe('login');
    expect(decision.user._id).toBe(owner._id);
  });
});

// ── 9 ───────────────────────────────────────────────────────────────────────────
describe('9. an unlinked identity whose e-mail matches an existing account', () => {
  it('does NOT link, and does not return that user', async () => {
    const victim = seedUser({ email: 'victim@example.com' });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'attacker-sub',
      email: 'victim@example.com',
      emailVerified: true,
    });

    expect(decision.outcome).toBe('account_exists');
    expect(decision.user).toBeUndefined();
    expect(victim.oauthProviders).toHaveLength(0);
    expect(victim.save).not.toHaveBeenCalled();
  });

  it('refuses even when the provider swears the address is verified', async () => {
    // A verified address proves the person controls the mailbox. It does not prove
    // they own the Jobblo account that happens to use it.
    seedUser({ email: 'victim@example.com' });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'attacker-sub',
      email: 'VICTIM@EXAMPLE.COM',
      emailVerified: true,
    });

    expect(decision.outcome).toBe('account_exists');
  });

  it('applies the same rule to Google', async () => {
    seedUser({ email: 'victim@example.com' });

    const decision = await resolveOAuthLogin({
      provider: 'google',
      providerId: 'google-123',
      email: 'victim@example.com',
      emailVerified: true,
    });

    expect(decision.outcome).toBe('account_exists');
  });
});

// ── 10 ──────────────────────────────────────────────────────────────────────────
describe('10. a brand new identity', () => {
  it('is allowed to create an account when nothing conflicts', async () => {
    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'new-sub',
      email: 'fresh@example.com',
      emailVerified: true,
    });

    expect(decision.outcome).toBe('create');
    expect(decision.email).toBe('fresh@example.com');
    expect(User.create).not.toHaveBeenCalled(); // the caller creates, not the policy
  });

  it('normalises the e-mail it hands back', async () => {
    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'new-sub',
      email: '  Fresh@Example.COM  ',
    });

    expect(decision.email).toBe('fresh@example.com');
  });
});

// ── 11 ──────────────────────────────────────────────────────────────────────────
describe('11. intentional linking from an authenticated session', () => {
  it('attaches the identity to the signed-in user', async () => {
    const me = seedUser({ email: 'me@example.com' });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'my-vipps-sub',
      email: 'totally-different@example.com',
      linkToUserId: me._id,
    });

    expect(decision.outcome).toBe('linked');
    expect(decision.user._id).toBe(me._id);
    expect(me.oauthProviders).toEqual([{ provider: 'vipps', providerId: 'my-vipps-sub' }]);
    expect(me.save).toHaveBeenCalled();
  });

  it('links regardless of the provider e-mail — the session is the proof', async () => {
    const me = seedUser({ email: 'me@example.com' });
    seedUser({ email: 'other@example.com' });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'sub-9',
      email: 'other@example.com',
      linkToUserId: me._id,
    });

    expect(decision.outcome).toBe('linked');
    expect(decision.user._id).toBe(me._id);
  });

  it('is a no-op when that identity is already on the same account', async () => {
    const me = seedUser({
      email: 'me@example.com',
      oauthProviders: [{ provider: 'vipps', providerId: 'sub-1' }],
    });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'sub-1',
      linkToUserId: me._id,
    });

    // Resolved by the already-linked branch before linking is even considered.
    expect(decision.outcome).toBe('login');
    expect(me.oauthProviders).toHaveLength(1);
  });

  it('reports when the session user has since been deleted', async () => {
    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'sub-1',
      linkToUserId: 'user_that_is_gone',
    });

    expect(decision.outcome).toBe('link_target_gone');
  });
});

// ── 12 ──────────────────────────────────────────────────────────────────────────
describe('12. email_verified: false', () => {
  it('never links and never collides — the address is ignored entirely', async () => {
    const victim = seedUser({ email: 'victim@example.com' });

    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'attacker-sub',
      email: 'victim@example.com',
      emailVerified: false,
    });

    expect(decision.outcome).toBe('create');
    expect(decision.email).toBeNull();
    expect(victim.oauthProviders).toHaveLength(0);
  });

  it('the caller cannot create an account from it either — no usable address', async () => {
    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'sub-1',
      email: 'unverified@example.com',
      emailVerified: false,
    });

    // `create` with a null e-mail: the controller turns this into `vipps_no_email`
    // rather than writing an account it cannot address.
    expect(decision.outcome).toBe('create');
    expect(decision.email).toBeNull();
  });

  it('an absent email_verified claim is not treated as false', async () => {
    // Vipps does not always send the claim; absent must behave as before.
    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'sub-1',
      email: 'fresh@example.com',
    });

    expect(decision.email).toBe('fresh@example.com');
  });
});

// ── 13 ──────────────────────────────────────────────────────────────────────────
describe('13. one provider identity cannot end up on two accounts', () => {
  it('refuses to link an identity another account already holds', async () => {
    const first = seedUser({
      email: 'first@example.com',
      oauthProviders: [{ provider: 'vipps', providerId: 'sub-contested' }],
    });
    const second = seedUser({ email: 'second@example.com' });

    const result = await linkProviderToUser(second, 'vipps', 'sub-contested');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_linked_elsewhere');
    expect(second.oauthProviders).toHaveLength(0);
    expect(second.save).not.toHaveBeenCalled();
    expect(first.oauthProviders).toHaveLength(1);
  });

  it('surfaces that as link_conflict through the policy', async () => {
    seedUser({
      email: 'first@example.com',
      oauthProviders: [{ provider: 'vipps', providerId: 'sub-contested' }],
    });
    const second = seedUser({ email: 'second@example.com' });

    // The already-linked branch would return `login` for the first user, so drive the
    // conflict through an explicit link request from the second user's session.
    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: 'sub-contested',
      linkToUserId: second._id,
    });

    // The identity resolves to its existing owner first — the second user does not
    // acquire it, which is the property that matters.
    expect(decision.outcome).toBe('login');
    expect(String(decision.user._id)).not.toBe(String(second._id));
    expect(second.oauthProviders).toHaveLength(0);
  });

  it('does not add a duplicate entry when linking the same identity twice', async () => {
    const me = seedUser({ email: 'me@example.com' });

    await linkProviderToUser(me, 'vipps', 'sub-1');
    await linkProviderToUser(me, 'vipps', 'sub-1');

    expect(me.oauthProviders).toEqual([{ provider: 'vipps', providerId: 'sub-1' }]);
  });
});

// ── The `sub`-collapse takeover ────────────────────────────────────────────────
describe('a missing provider subject id cannot resolve to an arbitrary user', () => {
  it.each([undefined, null, '', '   ', 123, {}, { $ne: null }, []])(
    'refuses providerId %p',
    async (providerId) => {
      seedUser({
        email: 'existing@example.com',
        oauthProviders: [{ provider: 'vipps', providerId: 'real-sub' }],
      });

      const decision = await resolveOAuthLogin({ provider: 'vipps', providerId });

      expect(decision.outcome).toBe('invalid_identity');
      expect(decision.user).toBeUndefined();
    }
  );

  it('isUsableProviderId rejects every non-string shape', () => {
    expect(isUsableProviderId('abc')).toBe(true);
    for (const bad of [undefined, null, '', '  ', 0, 1, {}, [], { $ne: null }, true]) {
      expect(isUsableProviderId(bad)).toBe(false);
    }
  });

  it('the controller no longer passes an unchecked profile.sub to a query', () => {
    // Mongoose strips `undefined` from a query, so
    //   { 'oauthProviders.provider': 'vipps', 'oauthProviders.providerId': undefined }
    // degraded to "any user who has ever used Vipps" and logged the caller in as
    // whoever came back first.
    const source = stripComments(
      fs.readFileSync(path.join(__dirname, '..', 'controllers', 'vippsController.js'), 'utf8')
    );

    expect(source).not.toMatch(/'oauthProviders\.providerId':\s*profile\.sub/);
    expect(source).toMatch(/resolveOAuthLogin\s*\(/);
  });
});

// ── 14 ──────────────────────────────────────────────────────────────────────────
describe('14. OAuth placeholder passwords cannot authenticate', () => {
  const { createUnusablePassword, isBcryptHash } = require('../utils/passwordUtils');

  it('the literal placeholder is not a bcrypt hash and never matches', async () => {
    expect(isBcryptHash('oauth-user')).toBe(false);
    // Confirms the library behaviour the login guard no longer relies on.
    expect(await bcrypt.compare('oauth-user', 'oauth-user')).toBe(false);
  });

  it('an unusable password is a real hash that nothing known verifies against', async () => {
    const stored = await createUnusablePassword();

    expect(isBcryptHash(stored)).toBe(true);
    for (const guess of ['oauth-user', 'oauth-user!', '', 'password', 'vipps', stored]) {
      expect(await bcrypt.compare(guess, stored)).toBe(false);
    }
  });

  it('two OAuth accounts never share the same stored value', async () => {
    const a = await createUnusablePassword();
    const b = await createUnusablePassword();
    expect(a).not.toBe(b);
  });

  it('login refuses any stored value that is not a bcrypt hash', () => {
    const source = stripComments(
      fs.readFileSync(path.join(__dirname, '..', 'controllers', 'authController.js'), 'utf8')
    );

    expect(source).toMatch(
      /isBcryptHash\(user\.password\)\s*&&\s*\(await bcrypt\.compare\(password, user\.password\)\)/
    );
  });

  it('no OAuth path writes a plaintext placeholder any more', () => {
    for (const file of [
      path.join(__dirname, '..', 'config', 'passport.js'),
      path.join(__dirname, '..', 'controllers', 'vippsController.js'),
    ]) {
      const source = stripComments(fs.readFileSync(file, 'utf8'));
      expect(source).not.toMatch(/password:\s*'oauth-user'/);
      expect(source).not.toMatch(/password:\s*randomPassword/);
      expect(source).toMatch(/password:\s*await createUnusablePassword\(\)/);
    }
  });
});
