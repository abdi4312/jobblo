/**
 * Deciding which Subscription row survives when a user has more than one.
 *
 * Extracted from scripts/dedupe-subscriptions.js so the rules can be tested directly
 * rather than only through a database. The script is the only caller in production.
 *
 * -- Why duplicates exist ------------------------------------------------------
 * The Vipps callback ran `Subscription.create(...)` on every sign-in rather than only
 * at signup, so a user who logged in ten times has ten rows. That is fixed
 * (controllers/vippsController.js now uses an idempotent upsert), but the rows it
 * already wrote are still there.
 *
 * -- Why "newest wins" is wrong ------------------------------------------------
 * The accidental rows are the NEW ones. The valuable row -- a real Stripe-backed plan
 * -- is usually older than the free default written by last night's login. Ordering by
 * insertion would delete exactly the row worth keeping. So insertion order is used
 * only to break ties between rows that are otherwise indistinguishable.
 *
 * -- The rule ------------------------------------------------------------------
 * Split the group into *substantive* and *disposable* rows.
 *
 *   disposable  - carries no Stripe subscription id, has an empty planHistory, and its
 *                 current plan is one of the two signup defaults ('Standard' private /
 *                 'Start' business). Such a row is what the bug produced and what
 *                 authController.register produces; it holds nothing that cannot be
 *                 recreated.
 *
 *   substantive - anything else: a Stripe id, a plan history, or a plan somebody
 *                 actually chose or was granted.
 *
 *   0 substantive  -> keep the OLDEST disposable, drop the rest.  (SAFE)
 *   1 substantive  -> keep it, drop every disposable.             (SAFE)
 *   2+ substantive -> touch nothing.                              (MANUAL_REVIEW)
 *
 * Note what this rule does NOT do: it never compares two substantive rows and picks a
 * winner. An active Stripe plan alongside a cancelled one, two different Stripe
 * subscription ids, or two manually granted plans are all real data problems, and
 * guessing between them can silently revoke something a customer paid for. Those stop
 * and ask for a human.
 *
 * -- The constraint that makes deletion safe -----------------------------------
 * services/stripe/provisioning.js resolves renewals, plan changes and cancellations
 * with `Subscription.findOne({ 'currentPlan.stripeSubscriptionId': ... })`. Deleting a
 * row that carries such an id would orphan every future webhook for that Stripe
 * subscription -- renewals would stop being recorded and the customer would keep
 * access to a plan nobody is billing. Disposable rows have no Stripe id by
 * definition, so this holds automatically; `assertNoStripeIdLost` re-checks it anyway,
 * because an invariant that costs nothing to verify should not depend on a future
 * edit to the classifier remembering it.
 */

/** Plans handed out at signup. Anything else was chosen, bought, or granted. */
const DEFAULT_SIGNUP_PLANS = new Set(['Standard', 'Start']);

/** The Stripe subscription id a row carries, if any. */
function stripeIdOf(row) {
  const id = row?.currentPlan?.stripeSubscriptionId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * Is this row indistinguishable from a fresh signup default?
 *
 * Deliberately conservative: every test must pass for a row to be disposable, so
 * anything unusual -- an unrecognised plan, a stray history entry, a Stripe id --
 * counts as substantive and either survives or forces a manual review.
 */
function isDisposable(row) {
  if (stripeIdOf(row)) return false;
  if (Array.isArray(row?.planHistory) && row.planHistory.length > 0) return false;

  const plan = row?.currentPlan?.plan;
  // A row with no plan at all cannot be serving anyone an entitlement and holds
  // nothing worth preserving.
  if (!plan) return true;

  return DEFAULT_SIGNUP_PLANS.has(plan);
}

/** Oldest first; `_id` breaks the tie so the ordering is total and reproducible. */
function byAgeThenId(a, b) {
  const at = new Date(a?.createdAt || 0).getTime();
  const bt = new Date(b?.createdAt || 0).getTime();
  if (at !== bt) return at - bt;
  return String(a?._id) < String(b?._id) ? -1 : 1;
}

/**
 * Classify one user's Subscription rows.
 *
 * @param {Array<Object>} rows lean Subscription documents for a single userId
 * @returns {{decision: 'SINGLE'|'SAFE'|'MANUAL_REVIEW', keepId: string|null,
 *            deleteIds: string[], reason: string, substantive: number}}
 */
function classifySubscriptionGroup(rows) {
  const ordered = (rows || []).slice().sort(byAgeThenId);

  if (ordered.length <= 1) {
    return {
      decision: 'SINGLE',
      keepId: ordered[0] ? String(ordered[0]._id) : null,
      deleteIds: [],
      reason: 'only one subscription -- nothing to do',
      substantive: ordered.filter((r) => !isDisposable(r)).length,
    };
  }

  const substantive = ordered.filter((r) => !isDisposable(r));

  if (substantive.length > 1) {
    // Two rows that both mean something. Report the distinguishing detail so whoever
    // picks this up knows what kind of collision it is.
    const stripeIds = [...new Set(substantive.map(stripeIdOf).filter(Boolean))];
    const reason =
      stripeIds.length > 1
        ? `${substantive.length} substantive rows carrying ${stripeIds.length} different Stripe subscription ids`
        : `${substantive.length} substantive rows -- plan history or a non-default plan on more than one`;

    return {
      decision: 'MANUAL_REVIEW',
      keepId: null,
      deleteIds: [],
      reason,
      substantive: substantive.length,
    };
  }

  const keep = substantive.length === 1 ? substantive[0] : ordered[0];
  const reason =
    substantive.length === 1
      ? stripeIdOf(keep)
        ? 'only row backed by a Stripe subscription'
        : 'only row carrying a non-default plan or plan history'
      : 'all rows are signup defaults -- kept the oldest';

  return {
    decision: 'SAFE',
    keepId: String(keep._id),
    deleteIds: ordered.filter((r) => String(r._id) !== String(keep._id)).map((r) => String(r._id)),
    reason,
    substantive: substantive.length,
  };
}

/**
 * Refuse to delete a row whose Stripe subscription id the survivor does not also
 * carry. See the header: losing that id detaches the customer from their own billing
 * webhooks. Throws rather than returning false -- this is an invariant, not a case to
 * handle.
 */
function assertNoStripeIdLost(rows, keepId, deleteIds) {
  const keep = rows.find((r) => String(r._id) === String(keepId));
  const keepStripeId = stripeIdOf(keep);

  for (const id of deleteIds) {
    const row = rows.find((r) => String(r._id) === String(id));
    const doomedStripeId = stripeIdOf(row);
    if (doomedStripeId && doomedStripeId !== keepStripeId) {
      throw new Error(
        `refusing to delete subscription ${id}: it carries Stripe subscription ` +
          `${doomedStripeId}, which the surviving row does not. Deleting it would ` +
          `orphan that subscription's renewal and cancellation webhooks.`
      );
    }
  }
}

/** One-line, PII-free summary of a row for the dry-run report. */
function describeRow(row) {
  const plan = row?.currentPlan || {};
  return {
    id: String(row?._id),
    plan: plan.plan || '(none)',
    type: plan.planType || '(none)',
    status: plan.status || '(none)',
    hasStripeSubscriptionId: Boolean(stripeIdOf(row)),
    historyEntries: Array.isArray(row?.planHistory) ? row.planHistory.length : 0,
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : '(none)',
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : '(none)',
    disposable: isDisposable(row),
  };
}

module.exports = {
  classifySubscriptionGroup,
  assertNoStripeIdLost,
  describeRow,
  isDisposable,
  stripeIdOf,
  DEFAULT_SIGNUP_PLANS,
};
