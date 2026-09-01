const User = require('../models/User');

/**
 * Account-linking policy for third-party sign-in (Vipps, Google).
 *
 * ============================================================================
 * THE RULE
 * ============================================================================
 * A third-party identity may take ownership of an existing Jobblo account only
 * when the person has proved they control that account. Matching e-mail
 * addresses is not that proof.
 *
 * Both callbacks used to do this:
 *
 *     let user = await User.findOne({ 'oauthProviders.providerId': profile.sub });
 *     if (!user) {
 *       const existing = await User.findOne({ email: profile.email });
 *       if (existing) { existing.oauthProviders.push(...); user = existing; }
 *     }
 *
 * which reads as "whoever turns up holding this e-mail address gets the account".
 * The attack does not even need the provider to be dishonest -- it needs one
 * account somewhere whose e-mail can be set to a Jobblo user's address, or one
 * Jobblo user who signed up with an address they later stopped controlling. The
 * result is full takeover: session cookies for an account the attacker never had
 * the password to, including its order history, payout details and chat.
 *
 * ============================================================================
 * WHAT REPLACES IT
 * ============================================================================
 * Three separate cases, decided in this order:
 *
 *   1. The provider identity is already linked.
 *      -> log that exact user in. This is the ordinary returning-user path and
 *         is the ONLY automatic path to an existing account.
 *
 *   2. The person is already signed in to Jobblo and asked to link.
 *      -> attach the identity to the session's user. Safe, because the session
 *         cookie is the proof of ownership that e-mail equality was not.
 *
 *   3. The provider identity is new.
 *      -> create a NEW account when the e-mail is free.
 *      -> when an account already holds that e-mail, refuse and send them to
 *         sign in normally. We cannot create (User.email is unique) and we must
 *         not link, so the only honest answer is to ask for the password.
 *
 * `email_verified: false` removes the e-mail from consideration entirely: it is
 * not used to detect a collision and it is not written onto a new account.
 *
 * ============================================================================
 * NOT AN ACCOUNT LOCKOUT
 * ============================================================================
 * Case 3's refusal is recoverable without support: sign in with the password, or
 * use the existing forgot-password flow, then link Vipps from the profile page.
 * That is the whole point -- it moves the proof from "knows an e-mail address" to
 * "can log in to the account".
 */

/** Providers this policy governs. Used only for clearer error messages. */
const SUPPORTED_PROVIDERS = new Set(['vipps', 'google']);

/**
 * A provider subject id we are willing to trust as an identity.
 *
 * This is not defensive boilerplate. Mongoose strips `undefined` values out of a
 * query, so when `profile.sub` was missing:
 *
 *     User.findOne({ 'oauthProviders.provider': 'vipps',
 *                    'oauthProviders.providerId': undefined })
 *
 * degraded to `User.findOne({ 'oauthProviders.provider': 'vipps' })` -- "any user
 * who has ever used Vipps" -- and the callback logged the attacker in as whoever
 * came back first. A truncated or unexpected userinfo response was enough.
 *
 * Objects are rejected too, so a `{ $ne: null }` shaped value cannot reach the
 * query as an operator.
 */
function isUsableProviderId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Only treat the provider's e-mail as usable when it is not explicitly unverified. */
function usableEmail(profileEmail, emailVerified) {
  if (emailVerified === false) return null;
  if (typeof profileEmail !== 'string') return null;
  const trimmed = profileEmail.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** The user this provider identity is already attached to, or null. */
async function findUserByProviderIdentity(provider, providerId) {
  if (!isUsableProviderId(providerId)) return null;
  return User.findOne({
    oauthProviders: { $elemMatch: { provider, providerId: providerId.trim() } },
  });
}

/**
 * Attach a provider identity to a user.
 *
 * `$elemMatch` above and the ownership check here are what stop one Vipps identity
 * from ending up on two accounts: whichever account it reaches first keeps it, and
 * a second attempt is reported rather than silently creating a shared identity that
 * would log two different people into whichever row `findOne` returned.
 *
 * @returns {{ok: true, user}|{ok: false, reason: 'already_linked_elsewhere'}}
 */
async function linkProviderToUser(user, provider, providerId) {
  if (!isUsableProviderId(providerId)) {
    return { ok: false, reason: 'invalid_identity' };
  }
  const id = providerId.trim();

  const holder = await findUserByProviderIdentity(provider, id);
  if (holder && String(holder._id) !== String(user._id)) {
    return { ok: false, reason: 'already_linked_elsewhere' };
  }
  if (holder) {
    return { ok: true, user: holder }; // already linked to this same user
  }

  // Guard against a second entry for the same provider on this account.
  const alreadyHasProvider = (user.oauthProviders || []).some(
    (p) => p.provider === provider && p.providerId === id
  );
  if (!alreadyHasProvider) {
    user.oauthProviders.push({ provider, providerId: id });
    await user.save();
  }
  return { ok: true, user };
}

/**
 * Decide what a provider callback should do.
 *
 * Performs no writes except the link in the intentional-linking case, so the caller
 * stays in control of user creation and of how each outcome is presented.
 *
 * @param {Object}  args
 * @param {string}  args.provider        'vipps' | 'google'
 * @param {string}  args.providerId      the provider's subject id (`sub`)
 * @param {string}  [args.email]         e-mail claim from the provider
 * @param {boolean} [args.emailVerified] the provider's `email_verified` claim
 * @param {string}  [args.linkToUserId]  set ONLY when an authenticated Jobblo
 *                                       session asked to link this identity
 *
 * @returns {Promise<{outcome: string, user?: Object, email?: string|null, reason?: string}>}
 *   'invalid_identity'  - no usable provider subject id; refuse the login
 *   'login'             - identity already linked; log `user` in
 *   'linked'            - identity attached to the signed-in `user`; log them in
 *   'link_conflict'     - identity belongs to a different account already
 *   'link_target_gone'  - the session's user no longer exists
 *   'account_exists'    - e-mail belongs to another account; ask for the password
 *   'create'            - nothing conflicts; caller may create a new user
 */
async function resolveOAuthLogin({ provider, providerId, email, emailVerified, linkToUserId }) {
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(`resolveOAuthLogin: unsupported provider ${provider}`);
  }

  if (!isUsableProviderId(providerId)) {
    return { outcome: 'invalid_identity' };
  }

  const id = providerId.trim();
  const normalisedEmail = usableEmail(email, emailVerified);

  // 1. Already linked -- the returning-user path.
  const linked = await findUserByProviderIdentity(provider, id);
  if (linked) {
    return { outcome: 'login', user: linked, email: normalisedEmail };
  }

  // 2. Intentional linking from an authenticated session.
  if (linkToUserId) {
    const target = await User.findById(linkToUserId);
    if (!target) return { outcome: 'link_target_gone' };

    const result = await linkProviderToUser(target, provider, id);
    if (!result.ok) return { outcome: 'link_conflict', reason: result.reason };

    return { outcome: 'linked', user: result.user, email: normalisedEmail };
  }

  // 3. A new provider identity arriving at the plain "sign in with ..." button.
  //
  // This is where the takeover used to happen. An e-mail collision now stops the
  // flow instead of granting the account: `User.email` is unique so we cannot
  // create alongside it, and linking is exactly what we have established we must
  // not do without proof of ownership.
  if (normalisedEmail) {
    const emailOwner = await User.findOne({ email: normalisedEmail }).select('_id');
    if (emailOwner) {
      return { outcome: 'account_exists', email: normalisedEmail };
    }
  }

  return { outcome: 'create', email: normalisedEmail };
}

module.exports = {
  resolveOAuthLogin,
  linkProviderToUser,
  findUserByProviderIdentity,
  isUsableProviderId,
  usableEmail,
  SUPPORTED_PROVIDERS,
};
