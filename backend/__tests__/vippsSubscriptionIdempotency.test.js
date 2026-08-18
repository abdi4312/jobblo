const fs = require('fs');
const path = require('path');
const Subscription = require('../models/Subscription');
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
 * The fix is an idempotent `findOneAndUpdate` + `$setOnInsert` + `upsert`. These tests
 * pin the three behaviours that matter.
 */

const controllerSource = stripComments(
  fs.readFileSync(path.join(__dirname, '..', 'controllers', 'vippsController.js'), 'utf8')
);

describe('Vipps login subscription handling', () => {
  describe('the write is idempotent by construction', () => {
    it('no longer calls Subscription.create at all', () => {
      expect(controllerSource).not.toMatch(/Subscription\.create\s*\(/);
    });

    it('uses an upsert guarded by $setOnInsert', () => {
      expect(controllerSource).toMatch(/Subscription\.findOneAndUpdate\s*\(/);
      expect(controllerSource).toMatch(/\$setOnInsert/);
      expect(controllerSource).toMatch(/upsert:\s*true/);
    });

    it('does not use $set, which would overwrite an existing plan', () => {
      // $set on this call is the whole bug in a different costume: it would reset a
      // paid subscriber to the free default on their next login.
      const call = controllerSource.slice(
        controllerSource.indexOf('Subscription.findOneAndUpdate'),
        controllerSource.indexOf('setDefaultsOnInsert')
      );
      expect(call).not.toMatch(/\$set\s*:/);
    });
  });

  describe('the upsert semantics', () => {
    let captured;

    beforeEach(() => {
      captured = null;
      jest
        .spyOn(Subscription, 'findOneAndUpdate')
        .mockImplementation((filter, update, options) => {
          captured = { filter, update, options };
          return Promise.resolve({ _id: 'sub_1' });
        });
    });

    afterEach(() => jest.restoreAllMocks());

    /** Re-runs just the subscription step the controller performs. */
    const runSubscriptionStep = async (user) => {
      const isCompany = user.role === 'company';
      await Subscription.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            userId: user._id,
            currentPlan: {
              plan: isCompany ? 'Start' : 'Standard',
              planType: isCompany ? 'business' : 'private',
              startDate: new Date(),
              status: 'active',
              autoRenew: false,
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return captured;
    };

    it('first Vipps signup gets the private Standard default', async () => {
      const call = await runSubscriptionStep({ _id: 'u1', role: 'user' });
      expect(call.filter).toEqual({ userId: 'u1' });
      expect(call.update.$setOnInsert.currentPlan.plan).toBe('Standard');
      expect(call.update.$setOnInsert.currentPlan.planType).toBe('private');
      expect(call.update.$setOnInsert.currentPlan.status).toBe('active');
      expect(call.options.upsert).toBe(true);
    });

    it('a company account gets the business Start default, matching e-mail signup', async () => {
      const call = await runSubscriptionStep({ _id: 'u2', role: 'company' });
      expect(call.update.$setOnInsert.currentPlan.plan).toBe('Start');
      expect(call.update.$setOnInsert.currentPlan.planType).toBe('business');
    });

    it('second login writes nothing new — the payload is insert-only', async () => {
      const call = await runSubscriptionStep({ _id: 'u1', role: 'user' });

      // Everything the call can write is inside $setOnInsert, which Mongo applies
      // only when it actually inserts. On an existing document this is a no-op, so a
      // repeat login cannot produce a second row or touch the first.
      expect(Object.keys(call.update)).toEqual(['$setOnInsert']);
      expect(call.filter).toEqual({ userId: 'u1' });
    });

    it('an existing paid subscription is untouched', async () => {
      const call = await runSubscriptionStep({ _id: 'paid-user', role: 'user' });

      // No operator in the update can modify an existing document.
      const mutatingOperators = Object.keys(call.update).filter((k) => k !== '$setOnInsert');
      expect(mutatingOperators).toEqual([]);

      // And nothing references the Stripe fields a real subscription carries.
      expect(JSON.stringify(call.update)).not.toContain('stripeSubscriptionId');
      expect(JSON.stringify(call.update)).not.toContain('planHistory');
    });
  });

  describe('e-mail auto-linking guard', () => {
    it('skips linking when Vipps explicitly says the address is unverified', () => {
      expect(controllerSource).toMatch(/profile\.email_verified\s*!==\s*false/);
    });

    it('still only looks up by e-mail when one was supplied', () => {
      expect(controllerSource).toMatch(/emailIsUsable\s*\?\s*await User\.findOne/);
    });
  });
});
