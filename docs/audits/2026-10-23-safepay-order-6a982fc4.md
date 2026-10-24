# Investigation — SafePay order `6a982fc4c9f28a8d07c772c4` (36 NOK held, never paid out)

**Status:** open. **No funds have been moved and none should be** until the questions below are answered.
All evidence comes from the local `jobblo-dev` database and from read-only Stripe API calls on 2026-10-23.

## What the records say

| Source | Finding |
|---|---|
| Order | `completed` / `paid`. Agreed price 36, customer total 37, fee 1, provider net 35 |
| Order history | `contract_created` 14:16, `payment_confirmed` 14:17 (`stripeSessionId: cs_test_a1oj8iDV…`), `job_started` 14:23, `ready_for_review` 14:23, `work_approved` 14:26 (all on 2026-09-02, UTC) |
| Order checkout fields | `checkoutSessionId` set. **`checkoutMode`, `checkoutAmountMinor` and `checkoutCurrency` are missing** |
| Payment | `status: completed`, amount 36, `stripePaymentIntentId: pi_3UBEy7FKI4I7PacU0GeLcEtx`. No `stripeLivemode` and no `capturedAmountMinor`. This is the older record format |
| Payout | **none** |
| SafePayHistory | `completed`; no Stripe IDs, card details or mode |
| Stripe webhook ledger | **no events** for this PaymentIntent or session. Payment was confirmed through the redirect path |
| Financial operations / incidents / disputes / transfers | none |
| Notifications | The last one, at 14:26, tells the provider to finish Stripe Connect setup. So the payout was refused at approval because the provider was not payout-ready |
| Provider | Has a Stripe Connect account; `payoutEnabled: false` |
| Error log | Nothing was recorded. This gap is now fixed: refusals are logged by the `releasePayoutToProvider` wrapper |

## Stripe (read-only)

| Check | Result |
|---|---|
| Current TEST account `acct_1T70Is3acMP9uu8L`: session `cs_test_a1oj…` | `resource_missing` |
| Current TEST account: PaymentIntent `pi_3UBEy7…` | `resource_missing` |
| Current LIVE account `acct_1T70If3m2BdjiodU`: PaymentIntent | `resource_missing` |
| Current TEST account: search `metadata['orderId']:'6a982fc4…'` | 0 results |

**Inference, not proof:** the session prefix `cs_test_` says this was a test-mode payment. Object IDs from the current test account contain `…acMP9uu8L…`, while this one contains `…FKI4I7Pac…`. That suggests a different test account. As noted, failing to find it in the current accounts does **not** prove where it came from.

## Why the money is stuck

1. At approval on 2026-09-02, the provider was not payout-ready. `releasePayoutToProvider` refused, and the approval handler only logged to the console and notified the provider.
2. The refusal happened before any Payout row existed, so `retryFailedPayouts` (which retries Payout rows) never picks it up.
3. Today the same call would also stop with `PAYOUT_MODE_UNKNOWN`, because `order.checkoutMode` is missing. That is correct behaviour: it requires manual reconciliation.

## Open questions, all required before any action

1. **Which Stripe account** issued `pi_3UBEy7FKI4I7PacU0GeLcEtx`? Someone with access to every past Jobblo Stripe account (test and live) must search for it in the dashboard.
2. Did that account **capture** 37 NOK? Was it refunded or disputed there?
3. **Accounting:** is there any ledger or export entry for this order?
4. Is this **test data** (test-mode session, development database)? If so, the right outcome is "close as test data", not a payout.
5. If it is real money: has the provider since finished Connect onboarding, and on which account?

## Allowed next steps

- Read-only lookups in old Stripe dashboards, and an accounting check.
- If confirmed as test data: record the decision here, then mark the order as reconciled in the admin dashboard.
- If confirmed real and captured: release through the normal admin flow only, after `checkoutMode`, `capturedAmountMinor` and livemode have been verified and recorded. A Super Admin approves.
