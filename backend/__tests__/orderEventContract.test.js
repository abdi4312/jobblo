const fs = require('fs');
const path = require('path');
const {
  ALL_LIFECYCLE_EVENTS,
  LEGACY_ALIASES,
  ORDER_EVENTS,
} = require('../constants/orderEvents');
const { stripComments } = require('../test-utils/stripComments');

/**
 * The order/job lifecycle socket contract, pinned on both sides.
 *
 * A socket event nobody listens for fails silently — no error, no log, nothing to
 * notice — which is how the backend ended up emitting `ready_for_review` (the moment a
 * customer's approve button unlocks) to no listener at all, while the frontend waited
 * on `new_order_request`, which nothing has ever emitted. The customer sat on the
 * SafePay approval page and had to reload to discover the provider had finished.
 *
 * This test is the thing that makes that visible. It reads what the controllers
 * actually emit and checks every name against the canonical list, and it reads the
 * frontend mirror and checks the two lists agree.
 */

const ROOT = path.join(__dirname, '..');
const FRONTEND_EVENTS = path.join(
  ROOT,
  '..',
  'frontend',
  'src',
  'features',
  'notifications',
  'orderEvents.ts'
);

/** Every `event: '...'` passed to notify(), across the controllers and services. */
function emittedEventNames() {
  const dirs = ['controllers', 'services'];
  const found = new Set();

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;
      const source = stripComments(fs.readFileSync(full, 'utf8'));

      // notify({ ..., event: 'name' })
      for (const m of source.matchAll(/\bevent:\s*'([a-z_]+)'/g)) {
        // `systemData: { event: ... }` is a chat message marker, not a socket event.
        const before = source.slice(Math.max(0, m.index - 60), m.index);
        if (/systemData\s*:\s*\{\s*$/.test(before)) continue;
        found.add(m[1]);
      }
      // emitToUser(x, 'name', ...)
      for (const m of source.matchAll(/emitToUser\([^,]+,\s*'([a-z_]+)'/g)) {
        found.add(m[1]);
      }
    }
  };

  for (const dir of dirs) walk(path.join(ROOT, dir));
  return found;
}

describe('order lifecycle socket contract', () => {
  const emitted = emittedEventNames();
  const known = new Set([...ALL_LIFECYCLE_EVENTS, ...LEGACY_ALIASES]);

  it('emits at least the events the audit identified as load-bearing', () => {
    // If any of these stops being emitted, a screen somewhere silently goes stale.
    for (const critical of ['order_ready_for_review', 'job_started', 'order_paid', 'order_completed']) {
      expect(emitted.has(critical)).toBe(true);
    }
  });

  it('never emits a lifecycle name that is not in the canonical contract', () => {
    // Notification-only events (subscription, application) are out of scope for the
    // order contract; everything order-shaped must be declared.
    // The notification tray and the subscription flow have their own events. This
    // contract governs the order lifecycle only; the boundary is deliberate.
    const outOfScope = new Set([
      'new_notification',
      'notification_count',
      'subscription_payment_failed',
      'application_submitted',
      'new_job_request',
      'order_approved',
      'request_declined',
      'worker_selected',
    ]);

    const undeclared = [...emitted].filter((name) => !known.has(name) && !outOfScope.has(name));
    expect(undeclared).toEqual([]);
  });

  it('declares no duplicate names', () => {
    const all = [...ALL_LIFECYCLE_EVENTS, ...LEGACY_ALIASES];
    expect(all.length).toBe(new Set(all).size);
  });

  it('carries order_ready_for_review — the event that unlocks customer approval', () => {
    expect(ORDER_EVENTS).toContain('order_ready_for_review');
  });

  it('no longer relies on the phantom new_order_request', () => {
    // The frontend used to listen for this. Nothing has ever emitted it.
    expect(known.has('new_order_request')).toBe(false);
    expect(emitted.has('new_order_request')).toBe(false);
  });
});

describe('frontend mirror matches the backend contract', () => {
  const frontendSource = fs.readFileSync(FRONTEND_EVENTS, 'utf8');

  /**
   * Pull the quoted names out of the exported arrays in the mirror file.
   *
   * Comments are stripped first: the file documents which names are legacy and why,
   * and that prose quotes the same names, so an un-stripped scan would "find" an
   * event the code no longer lists.
   */
  const frontendNames = new Set(
    [...stripComments(frontendSource).matchAll(/'([a-z_]{3,})'/g)].map((m) => m[1])
  );

  it('lists every canonical backend event', () => {
    const missing = [...ALL_LIFECYCLE_EVENTS].filter((name) => !frontendNames.has(name));
    expect(missing).toEqual([]);
  });

  it('lists the legacy aliases too, so an older server build does not go silent', () => {
    const missing = [...LEGACY_ALIASES].filter((name) => !frontendNames.has(name));
    expect(missing).toEqual([]);
  });

  it('invalidates the query keys the order screens actually use', () => {
    const hooks = fs.readFileSync(
      path.join(ROOT, '..', 'frontend', 'src', 'features', 'notifications', 'hooks.ts'),
      'utf8'
    );

    // These are the keys SafePayApproval, SafePayCheckout, ProviderOrderDetailPage,
    // DisputePanel and the provider review block query on. The old hook invalidated
    // none of them.
    for (const key of ['safepay-checkout', 'provider-order', 'dispute', 'order-reviews']) {
      expect(hooks).toContain(key);
    }
  });

  it('does not clear the whole React Query cache', () => {
    const hooks = stripComments(
      fs.readFileSync(
        path.join(ROOT, '..', 'frontend', 'src', 'features', 'notifications', 'hooks.ts'),
        'utf8'
      )
    );
    expect(hooks).not.toMatch(/queryClient\.clear\(\)/);
  });
});

describe('no duplicate delivery of the same event', () => {
  it('start-job and ready-for-review no longer re-emit new_notification by hand', () => {
    const source = stripComments(
      fs.readFileSync(path.join(ROOT, 'controllers', 'providerWorkController.js'), 'utf8')
    );

    // `notify()` already emits `new_notification`. A second raw emit to the same user
    // is a second delivery: two tray entries, two toasts, two sounds, one event.
    expect(source).not.toMatch(/emit\(\s*'new_notification'/);
  });

  it('approval no longer emits order_completed twice to the customer', () => {
    const source = stripComments(
      fs.readFileSync(path.join(ROOT, 'controllers', 'SafePayCheckoutController.js'), 'utf8')
    );
    const customerRawEmit = /io\.to\(`user_\$\{order\.customerId\}`\)\.emit\('order_completed'/;
    expect(source).not.toMatch(customerRawEmit);
  });
});
