const fs = require('fs');
const path = require('path');
const { stripComments } = require('../test-utils/stripComments');

/**
 * One Subscription document per user.
 *
 * The Vipps callback used to call `Subscription.create(...)` on every sign-in, so ten
 * logins produced ten rows. Every reader — middleware/checkSubscription,
 * controllers/stripeController, services/stripe/provisioning — resolves the plan with
 * a bare `findOne({ userId })`, so which row won was natural document order and an
 * upgraded customer could be served a stale free row.
 *
 * Two things enforce the invariant now:
 *   - utils/subscription.ensureDefaultSubscription, an atomic upsert whose entire
 *     payload sits inside `$setOnInsert`;
 *   - a unique index on Subscription.userId, where the deployment supports adding one.
 *
 * The index cannot be added to a non-empty collection on Azure Cosmos DB for MongoDB,
 * which is what production uses, so the application-level guarantee has to stand on
 * its own. These tests are about that guarantee.
 */

// ── A fake collection with Mongo's upsert semantics and a unique index ──────────
function makeCollection({ unique = true } = {}) {
  const docs = [];

  return {
    docs,
    async findOneAndUpdate(filter, update, options = {}) {
      const existing = docs.find((d) => String(d.userId) === String(filter.userId));

      if (existing) {
        // $setOnInsert is a no-op on a match — this is the property that protects a
        // paid plan from being reset by the next login.
        if (update.$set) Object.assign(existing, update.$set);
        return existing;
      }

      if (!options.upsert) return null;

      if (unique && docs.some((d) => String(d.userId) === String(filter.userId))) {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      }

      const inserted = { _id: `sub_${docs.length + 1}`, ...(update.$setOnInsert || {}) };
      docs.push(inserted);
      return inserted;
    },
    async findOne(filter) {
      return docs.find((d) => String(d.userId) === String(filter.userId)) || null;
    },
  };
}

let collection;
jest.mock('../models/Subscription', () => ({
  findOneAndUpdate: (...args) => collection.findOneAndUpdate(...args),
  findOne: (...args) => collection.findOne(...args),
}));

const { ensureDefaultSubscription } = require('../utils/subscription');

beforeEach(() => {
  collection = makeCollection();
});

describe('repeat provisioning', () => {
  it('a single call creates exactly one row', async () => {
    await ensureDefaultSubscription({ _id: 'u1', role: 'user' });
    expect(collection.docs).toHaveLength(1);
  });

  it('ten sequential logins still leave exactly one row', async () => {
    for (let i = 0; i < 10; i++) {
      await ensureDefaultSubscription({ _id: 'u1', role: 'user' });
    }
    expect(collection.docs).toHaveLength(1);
  });

  it('ten CONCURRENT logins still leave exactly one row', async () => {
    await Promise.all(
      Array.from({ length: 10 }, () => ensureDefaultSubscription({ _id: 'u1', role: 'user' }))
    );
    expect(collection.docs).toHaveLength(1);
  });

  it('different users each get their own row', async () => {
    await Promise.all(
      ['u1', 'u2', 'u3'].map((id) => ensureDefaultSubscription({ _id: id, role: 'user' }))
    );
    expect(collection.docs).toHaveLength(3);
  });
});

describe('an existing subscription is never modified', () => {
  it('a paid Stripe plan survives the next login untouched', async () => {
    collection.docs.push({
      _id: 'sub_paid',
      userId: 'u1',
      currentPlan: {
        plan: 'Pro',
        planType: 'private',
        status: 'active',
        stripeSubscriptionId: 'sub_live_1',
        autoRenew: true,
      },
      planHistory: [{ plan: 'Standard' }],
    });

    await ensureDefaultSubscription({ _id: 'u1', role: 'user' });

    expect(collection.docs).toHaveLength(1);
    expect(collection.docs[0].currentPlan.plan).toBe('Pro');
    expect(collection.docs[0].currentPlan.stripeSubscriptionId).toBe('sub_live_1');
    expect(collection.docs[0].currentPlan.autoRenew).toBe(true);
    expect(collection.docs[0].planHistory).toHaveLength(1);
  });

  it('a cancelled plan is not quietly reactivated', async () => {
    collection.docs.push({
      _id: 'sub_cancelled',
      userId: 'u1',
      currentPlan: { plan: 'Plus', status: 'cancelled' },
    });

    await ensureDefaultSubscription({ _id: 'u1', role: 'user' });

    expect(collection.docs[0].currentPlan.status).toBe('cancelled');
  });
});

describe('duplicate-key races resolve to the winning row', () => {
  it('returns the existing document instead of throwing on E11000', async () => {
    const winner = { _id: 'sub_winner', userId: 'u1', currentPlan: { plan: 'Pro' } };

    const Subscription = require('../models/Subscription');
    const spy = jest.spyOn(collection, 'findOneAndUpdate').mockImplementationOnce(async () => {
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      throw err;
    });
    collection.docs.push(winner);

    const result = await ensureDefaultSubscription({ _id: 'u1', role: 'user' });

    expect(result).toBe(winner);
    expect(collection.docs).toHaveLength(1);
    spy.mockRestore();
    expect(Subscription).toBeDefined();
  });

  it('does not swallow errors that are not duplicate-key', async () => {
    jest.spyOn(collection, 'findOneAndUpdate').mockImplementationOnce(async () => {
      throw new Error('connection lost');
    });

    await expect(ensureDefaultSubscription({ _id: 'u1' })).rejects.toThrow('connection lost');
  });
});

describe('plan defaults match the e-mail signup path', () => {
  it('a private account starts on Standard/private', async () => {
    await ensureDefaultSubscription({ _id: 'u1', role: 'user' });
    expect(collection.docs[0].currentPlan).toMatchObject({
      plan: 'Standard',
      planType: 'private',
      status: 'active',
      autoRenew: false,
    });
  });

  it('a company account starts on Start/business', async () => {
    await ensureDefaultSubscription({ _id: 'u2', role: 'company' });
    expect(collection.docs[0].currentPlan).toMatchObject({
      plan: 'Start',
      planType: 'business',
    });
  });

  it('planType: business is honoured even when role is not company', async () => {
    await ensureDefaultSubscription({ _id: 'u3', role: 'user', planType: 'business' });
    expect(collection.docs[0].currentPlan.plan).toBe('Start');
  });
});

describe('the write is insert-only by construction', () => {
  const source = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'utils', 'subscription.js'), 'utf8')
  );
  const helper = source.slice(
    source.indexOf('exports.ensureDefaultSubscription'),
    source.indexOf('exports.upsertSubscription')
  );

  it('uses upsert with $setOnInsert', () => {
    expect(helper).toMatch(/\$setOnInsert/);
    expect(helper).toMatch(/upsert:\s*true/);
  });

  it('contains no $set — that would reset a paid subscriber to the free default', () => {
    expect(helper).not.toMatch(/\$set\s*:/);
  });

  it('never references the fields a real subscription carries', () => {
    expect(helper).not.toMatch(/stripeSubscriptionId/);
    expect(helper).not.toMatch(/planHistory/);
  });
});

describe('every default-provisioning path goes through the helper', () => {
  it.each([
    ['controllers/vippsController.js', 'Vipps'],
    ['config/passport.js', 'Google'],
    ['controllers/authController.js', 'e-mail registration'],
  ])('%s (%s) calls ensureDefaultSubscription', (file) => {
    const src = stripComments(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
    expect(src).toMatch(/ensureDefaultSubscription\(/);
  });

  it.each([['controllers/vippsController.js'], ['config/passport.js']])(
    '%s no longer calls Subscription.create',
    (file) => {
      const src = stripComments(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
      expect(src).not.toMatch(/Subscription\.create\s*\(/);
    }
  );
});

describe('the storage-layer constraint is declared', () => {
  const model = fs.readFileSync(path.join(__dirname, '..', 'models', 'Subscription.js'), 'utf8');

  it('declares a unique index on userId', () => {
    expect(stripComments(model)).toMatch(
      /subscriptionSchema\.index\(\{\s*userId:\s*1\s*\},\s*\{\s*unique:\s*true\s*\}\)/
    );
  });

  it('declares that key exactly once', () => {
    // `index: true` on the path plus a schema-level index would define { userId: 1 }
    // twice with different options.
    const stripped = stripComments(model);
    const pathBlock = stripped.slice(stripped.indexOf('userId:'), stripped.indexOf('currentPlan'));
    expect(pathBlock).not.toMatch(/index:\s*true/);
  });

  it('documents the Cosmos limitation rather than assuming the index exists', () => {
    // Production is Azure Cosmos DB for MongoDB, which cannot add a unique index to a
    // collection that already holds data. Whoever deploys this has to know that.
    expect(model).toMatch(/Cosmos/);
    expect(model).toMatch(/dedupe:subscriptions/);
    expect(model).toMatch(/dropIndex\('userId_1'\)/);
  });
});
