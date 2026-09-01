const fs = require('fs');
const path = require('path');
const {
  classifySubscriptionGroup,
  assertNoStripeIdLost,
  isDisposable,
  describeRow,
} = require('../utils/subscriptionDedupe');
const { stripComments } = require('../test-utils/stripComments');

/**
 * Cleaning up the duplicate Subscription rows the Vipps login bug left behind.
 *
 * The rules are in utils/subscriptionDedupe.js. What matters is that the accidental
 * rows are the NEW ones, so ordering by insertion would delete exactly the row worth
 * keeping — a real Stripe-backed plan is usually older than the free default written
 * by last night's login.
 */

let seq = 0;
/** A lean Subscription row. Defaults produce a plain free signup default. */
function row(overrides = {}) {
  const {
    id = `row_${++seq}`,
    plan = 'Standard',
    planType = 'private',
    status = 'active',
    stripeSubscriptionId,
    planHistory = [],
    createdAt = '2025-01-01T00:00:00.000Z',
  } = overrides;

  return {
    _id: id,
    userId: 'user_1',
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    planHistory,
    currentPlan: { plan, planType, status, stripeSubscriptionId },
  };
}

describe('which row is disposable', () => {
  it('a bare signup default is disposable', () => {
    expect(isDisposable(row())).toBe(true);
    expect(isDisposable(row({ plan: 'Start', planType: 'business' }))).toBe(true);
  });

  it('anything carrying a Stripe subscription is not', () => {
    expect(isDisposable(row({ stripeSubscriptionId: 'sub_123' }))).toBe(false);
  });

  it('anything carrying plan history is not', () => {
    expect(isDisposable(row({ planHistory: [{ plan: 'Pro' }] }))).toBe(false);
  });

  it('a plan nobody is handed at signup is not', () => {
    for (const plan of ['Pro', 'Plus', 'Premium', 'Fleksibel', 'Jobblo Pluss']) {
      expect(isDisposable(row({ plan }))).toBe(false);
    }
  });
});

describe('1. a user with one subscription', () => {
  it('is left completely alone', () => {
    const rows = [row({ id: 'only' })];
    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.decision).toBe('SINGLE');
    expect(verdict.deleteIds).toEqual([]);
  });

  it('is left alone even when that one row is a paid Stripe plan', () => {
    const verdict = classifySubscriptionGroup([
      row({ id: 'only', plan: 'Pro', stripeSubscriptionId: 'sub_1' }),
    ]);

    expect(verdict.decision).toBe('SINGLE');
    expect(verdict.deleteIds).toEqual([]);
  });
});

describe('2. duplicate free rows', () => {
  it('keeps exactly one — the oldest', () => {
    const rows = [
      row({ id: 'newest', createdAt: '2025-06-01T00:00:00.000Z' }),
      row({ id: 'oldest', createdAt: '2025-01-01T00:00:00.000Z' }),
      row({ id: 'middle', createdAt: '2025-03-01T00:00:00.000Z' }),
    ];

    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.decision).toBe('SAFE');
    expect(verdict.keepId).toBe('oldest');
    expect(verdict.deleteIds.sort()).toEqual(['middle', 'newest']);
  });

  it('collapses a ten-login pile-up down to one row', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ id: `login_${i}`, createdAt: `2025-0${(i % 9) + 1}-01T00:00:00.000Z` })
    );

    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.decision).toBe('SAFE');
    expect(verdict.deleteIds).toHaveLength(9);
    expect(verdict.deleteIds).not.toContain(verdict.keepId);
  });
});

describe('3. a paid Stripe subscription alongside an accidental free row', () => {
  it('keeps the paid row even though the free one is newer', () => {
    const rows = [
      row({ id: 'free_from_last_login', createdAt: '2025-06-01T00:00:00.000Z' }),
      row({
        id: 'paid',
        plan: 'Pro',
        stripeSubscriptionId: 'sub_live_1',
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
    ];

    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.decision).toBe('SAFE');
    expect(verdict.keepId).toBe('paid');
    expect(verdict.deleteIds).toEqual(['free_from_last_login']);
  });

  it('keeps a non-Stripe upgraded plan over free defaults too', () => {
    // A plan granted by an admin has no Stripe id but is still not a signup default.
    const rows = [
      row({ id: 'granted_premium', plan: 'Premium', createdAt: '2025-01-01T00:00:00.000Z' }),
      row({ id: 'free_a', createdAt: '2025-05-01T00:00:00.000Z' }),
      row({ id: 'free_b', createdAt: '2025-06-01T00:00:00.000Z' }),
    ];

    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.keepId).toBe('granted_premium');
    expect(verdict.deleteIds.sort()).toEqual(['free_a', 'free_b']);
  });

  it('keeps the row holding plan history', () => {
    const rows = [
      row({ id: 'free', createdAt: '2025-06-01T00:00:00.000Z' }),
      row({
        id: 'has_history',
        planHistory: [{ plan: 'Pro', planType: 'private', status: 'expired' }],
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
    ];

    expect(classifySubscriptionGroup(rows).keepId).toBe('has_history');
  });
});

describe('4. active versus cancelled or expired', () => {
  it('a cancelled Stripe row still beats an accidental free default', () => {
    // The free row is not a subscription anyone chose — it is what the bug wrote.
    // The cancelled row carries the billing history AND the stripeSubscriptionId that
    // services/stripe/provisioning.js needs to resolve future webhooks.
    const rows = [
      row({ id: 'free', createdAt: '2025-06-01T00:00:00.000Z' }),
      row({
        id: 'cancelled_paid',
        plan: 'Pro',
        status: 'cancelled',
        stripeSubscriptionId: 'sub_1',
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
    ];

    const verdict = classifySubscriptionGroup(rows);
    expect(verdict.keepId).toBe('cancelled_paid');
  });

  it('an ACTIVE paid row is never dropped in favour of a cancelled one', () => {
    // Both mean something, so nothing is guessed and nothing is deleted.
    const rows = [
      row({ id: 'active_paid', plan: 'Pro', status: 'active', stripeSubscriptionId: 'sub_new' }),
      row({
        id: 'cancelled_paid',
        plan: 'Plus',
        status: 'cancelled',
        stripeSubscriptionId: 'sub_old',
      }),
    ];

    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.decision).toBe('MANUAL_REVIEW');
    expect(verdict.deleteIds).toEqual([]);
    expect(verdict.keepId).toBeNull();
  });
});

describe('5. ambiguous paid duplicates are never cleaned up destructively', () => {
  it('two different Stripe subscription ids stop for a human', () => {
    const rows = [
      row({ id: 'a', plan: 'Pro', stripeSubscriptionId: 'sub_1' }),
      row({ id: 'b', plan: 'Plus', stripeSubscriptionId: 'sub_2' }),
    ];

    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.decision).toBe('MANUAL_REVIEW');
    expect(verdict.deleteIds).toEqual([]);
    expect(verdict.reason).toMatch(/different Stripe subscription ids/);
  });

  it('two non-default plans with no Stripe id stop for a human as well', () => {
    const rows = [row({ id: 'a', plan: 'Pro' }), row({ id: 'b', plan: 'Premium' })];

    const verdict = classifySubscriptionGroup(rows);

    expect(verdict.decision).toBe('MANUAL_REVIEW');
    expect(verdict.deleteIds).toEqual([]);
  });

  it('a paid row plus free rows is NOT ambiguous — only the paid row is substantive', () => {
    const rows = [
      row({ id: 'paid', plan: 'Pro', stripeSubscriptionId: 'sub_1' }),
      row({ id: 'free_a' }),
      row({ id: 'free_b' }),
    ];

    expect(classifySubscriptionGroup(rows).decision).toBe('SAFE');
  });

  it('refuses outright to delete a row whose Stripe id the survivor lacks', () => {
    // Belt and braces: disposable rows carry no Stripe id by construction, so this
    // cannot fire today. It exists so a future edit to the classifier cannot quietly
    // orphan a customer's renewal and cancellation webhooks.
    const rows = [
      row({ id: 'keep', plan: 'Pro', stripeSubscriptionId: 'sub_keep' }),
      row({ id: 'doomed', plan: 'Plus', stripeSubscriptionId: 'sub_doomed' }),
    ];

    expect(() => assertNoStripeIdLost(rows, 'keep', ['doomed'])).toThrow(
      /orphan that subscription's renewal/
    );
  });

  it('allows the delete when survivor and doomed row share the Stripe id', () => {
    const rows = [
      row({ id: 'keep', plan: 'Pro', stripeSubscriptionId: 'sub_same' }),
      row({ id: 'doomed', plan: 'Pro', stripeSubscriptionId: 'sub_same' }),
    ];

    expect(() => assertNoStripeIdLost(rows, 'keep', ['doomed'])).not.toThrow();
  });
});

describe('6. the dry run cannot change anything', () => {
  const scriptSource = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'scripts', 'dedupe-subscriptions.js'), 'utf8')
  );

  it('defaults to read-only — --apply is opt-in', () => {
    expect(scriptSource).toMatch(/const APPLY = process\.argv\.includes\('--apply'\)/);
  });

  it('performs no delete outside the APPLY branch', () => {
    // Every mutation must sit after `if (APPLY) {`.
    const applyIndex = scriptSource.indexOf('if (APPLY) {');
    expect(applyIndex).toBeGreaterThan(-1);

    const beforeApply = scriptSource.slice(0, applyIndex);
    expect(beforeApply).not.toMatch(/deleteMany|deleteOne|updateOne|updateMany|\.save\(/);
  });

  it('never writes anything other than a delete of the doomed ids', () => {
    expect(scriptSource).not.toMatch(/\.save\(\)/);
    expect(scriptSource).not.toMatch(/updateMany|findOneAndUpdate/);
    expect(scriptSource).toMatch(/deleteMany\(\{\s*_id: \{ \$in: verdict\.deleteIds/);
  });

  it('reports without printing e-mail addresses or names', () => {
    const printed = Object.keys(describeRow(row({ id: 'x' })));
    expect(printed).toEqual(
      expect.arrayContaining(['id', 'plan', 'type', 'status', 'hasStripeSubscriptionId'])
    );
    expect(printed).not.toContain('email');
    expect(printed).not.toContain('name');
    // The Stripe id itself is reduced to a boolean.
    expect(describeRow(row({ stripeSubscriptionId: 'sub_secret' })).hasStripeSubscriptionId).toBe(
      true
    );
    expect(JSON.stringify(describeRow(row({ stripeSubscriptionId: 'sub_secret' })))).not.toContain(
      'sub_secret'
    );
  });
});

describe('7. apply is idempotent', () => {
  /** Mirrors the script's decision loop against an in-memory collection. */
  function runApply(collection) {
    const byUser = new Map();
    for (const r of collection) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, []);
      byUser.get(r.userId).push(r);
    }

    const doomed = new Set();
    for (const rows of byUser.values()) {
      if (rows.length <= 1) continue;
      const verdict = classifySubscriptionGroup(rows);
      if (verdict.decision !== 'SAFE') continue;
      assertNoStripeIdLost(rows, verdict.keepId, verdict.deleteIds);
      verdict.deleteIds.forEach((id) => doomed.add(id));
    }

    return { remaining: collection.filter((r) => !doomed.has(r._id)), deleted: doomed.size };
  }

  it('a second run deletes nothing more', () => {
    const collection = [
      row({ id: 'a1', createdAt: '2025-01-01T00:00:00.000Z' }),
      row({ id: 'a2', createdAt: '2025-02-01T00:00:00.000Z' }),
      row({ id: 'a3', createdAt: '2025-03-01T00:00:00.000Z' }),
    ];

    const first = runApply(collection);
    expect(first.deleted).toBe(2);
    expect(first.remaining).toHaveLength(1);

    const second = runApply(first.remaining);
    expect(second.deleted).toBe(0);
    expect(second.remaining).toEqual(first.remaining);
  });

  it('leaves manual-review groups untouched on every run', () => {
    const collection = [
      row({ id: 'p1', plan: 'Pro', stripeSubscriptionId: 'sub_1' }),
      row({ id: 'p2', plan: 'Plus', stripeSubscriptionId: 'sub_2' }),
    ];

    const first = runApply(collection);
    expect(first.deleted).toBe(0);
    expect(first.remaining).toHaveLength(2);

    const second = runApply(first.remaining);
    expect(second.deleted).toBe(0);
    expect(second.remaining).toHaveLength(2);
  });

  it('is stable across a mixed collection of many users', () => {
    const mk = (userId, rows) => rows.map((r) => ({ ...r, userId }));
    const collection = [
      ...mk('clean', [row({ id: 'c1' })]),
      ...mk('dupes', [
        row({ id: 'd1', createdAt: '2025-01-01T00:00:00.000Z' }),
        row({ id: 'd2', createdAt: '2025-02-01T00:00:00.000Z' }),
      ]),
      ...mk('paid', [
        row({ id: 'x1', plan: 'Pro', stripeSubscriptionId: 'sub_x' }),
        row({ id: 'x2' }),
      ]),
      ...mk('ambiguous', [
        row({ id: 'm1', plan: 'Pro', stripeSubscriptionId: 'sub_a' }),
        row({ id: 'm2', plan: 'Plus', stripeSubscriptionId: 'sub_b' }),
      ]),
    ];

    const first = runApply(collection);
    expect(first.remaining.map((r) => r._id).sort()).toEqual(['c1', 'd1', 'm1', 'm2', 'x1']);

    const second = runApply(first.remaining);
    expect(second.deleted).toBe(0);
  });
});
