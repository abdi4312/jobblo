const fs = require('fs');
const path = require('path');
const { stripComments } = require('../test-utils/stripComments');

/**
 * Vipps login used to create a Subscription on every sign-in.
 *
 * The `Subscription.create(...)` sat *outside* the `if (!user)` branch, so it ran on
 * every callback rather than only at signup. A user who signed in ten times had ten
 * subscription rows. Every reader in the codebase — `middleware/checkSubscription`,
 * `stripeController`, `services/stripe/provisioning` — resolves the subscription with
 * `findOne({ userId })`, so which row won was down to natural document order: someone
 * who had upgraded could be served a stale free row and silently lose their paid plan
 * and contact quota.
 *
 * The idempotent upsert that fixes it has since moved out of this controller and into
 * `utils/subscription.ensureDefaultSubscription`, shared with the Google and e-mail
 * signup paths so all three provision identically. Its semantics — upsert,
 * `$setOnInsert` only, no `$set`, concurrency-safe — are owned by
 * __tests__/subscriptionUniqueness.test.js.
 *
 * What remains here is the controller's end of the contract: that it delegates, and
 * that it has not grown a second way to write a subscription.
 */

const controllerSource = stripComments(
  fs.readFileSync(path.join(__dirname, '..', 'controllers', 'vippsController.js'), 'utf8')
);

describe('Vipps login subscription handling', () => {
  describe('the controller writes subscriptions one way only', () => {
    it('no longer calls Subscription.create at all', () => {
      expect(controllerSource).not.toMatch(/Subscription\.create\s*\(/);
    });

    it('delegates to the shared idempotent helper', () => {
      expect(controllerSource).toMatch(/ensureDefaultSubscription\(user\)/);
    });

    it('does not reach for the Subscription model directly', () => {
      // A second write path is how the original bug got in. There should be exactly
      // one way for this controller to touch subscriptions.
      expect(controllerSource).not.toMatch(/require\(['"]\.\.\/models\/Subscription['"]\)/);
      expect(controllerSource).not.toMatch(/Subscription\./);
    });

    it('provisions after the user is resolved, not on every branch', () => {
      // One call site, reached once per successful callback.
      const calls = controllerSource.match(/ensureDefaultSubscription\(/g) || [];
      expect(calls).toHaveLength(1);
    });
  });

  describe('e-mail is no longer a linking credential', () => {
    /**
     * Stage A added a narrow guard here: skip the e-mail match when Vipps explicitly
     * said `email_verified: false`. That guard is gone because the thing it was
     * guarding is gone — the controller does not link by e-mail at all any more.
     *
     * A verified address proves the person controls the mailbox. It never proved they
     * own the Jobblo account that happens to use it, which is what linking grants.
     * The policy now lives in utils/oauthLinking.js and is tested in
     * __tests__/oauthAccountLinking.test.js.
     */
    it('does not look a user up by e-mail', () => {
      expect(controllerSource).not.toMatch(/User\.findOne\s*\(\s*\{\s*email/);
      expect(controllerSource).not.toMatch(/existingEmailUser/);
    });

    it('does not attach a provider identity to an account it found', () => {
      expect(controllerSource).not.toMatch(/oauthProviders\.push/);
    });

    it('delegates the decision to the shared policy', () => {
      expect(controllerSource).toMatch(/resolveOAuthLogin\s*\(/);
      expect(controllerSource).toMatch(/linkToUserId:\s*pending\.linkUserId/);
    });

    it('only creates an account on the outcome that authorises it', () => {
      const createCalls = controllerSource.match(/User\.create\s*\(/g) || [];
      expect(createCalls).toHaveLength(1);

      // And that call sits inside the `create` branch.
      const createBranch = controllerSource.slice(
        controllerSource.indexOf("case 'create'"),
        controllerSource.indexOf('default:')
      );
      expect(createBranch).toMatch(/User\.create\s*\(/);
    });
  });
});
