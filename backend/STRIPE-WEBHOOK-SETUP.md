# Stripe webhook deployment

> **Subscription V2 checkout is disabled by default and lifecycle management is
> incomplete. Do not enable it or treat this branch as production-ready.** The shared
> webhook remains signature-verified for SafePay and finance events, and processes
> only properly marked V2 subscription events. It does not process old subscription
> events or modify Stripe subscriptions or MongoDB history.

SafePay's canonical endpoint is `POST https://<api-host>/api/stripe/webhook`.
It must be publicly reachable over HTTPS. New Stripe event destinations should
use this URL; `/api/safepay-checkout/webhook` remains as a legacy alias.

## Required event subscriptions

For SafePay Checkout, subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

For provider transfer and connected-account bank payout history, also subscribe
to:

- `transfer.created`
- `transfer.reversed`
- `payout.created`
- `payout.updated`
- `payout.paid`
- `payout.failed`
- `payout.canceled`

Before enabling Subscription V2 in a future release, its destination must also
deliver:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

The `SUBSCRIPTION_V2_CHECKOUT_ENABLED` flag remains off by default. Do not enable it
until cancellation, plan changes, usage/entitlement handling, recovery, legal review,
and end-to-end migration verification are complete.

Transfer and payout updates must be delivered with the connected account context
(`event.account`). Platform-level payouts are intentionally not treated as
provider bank payouts. History can also be reconciled from Stripe's read-only
list APIs by an administrator; reconciliation never initiates money movement.

Use Stripe's snapshot event payload format and the API version configured by this
backend. Configure test and live destinations separately. Store each endpoint's
signing secret only in its matching environment variable:

- Test destination: `STRIPE_TEST_WEBHOOK_SECRET`
- Live destination: `STRIPE_WEBHOOK_SECRET`

The matching API key must also be selected by the persisted `STRIPE_TEST_MODE`
setting. The application never falls back between modes.

## Verify delivery before enabling live checkout

1. In Stripe Workbench, create the HTTPS event destination for the appropriate
   mode and endpoint above. Select the required events and reveal that
   destination's signing secret.
2. Set the secret in the matching server environment variable and restart the
   application. A `whsec_` prefix is only a format check; it is not evidence that
   Stripe is delivering to the right endpoint or that the secret is correct.
3. In Stripe's Dashboard, use a non-payment event from the same Stripe mode and
   send/resend it to this endpoint. For live mode, use a real, non-financial
   account event such as `account.updated`; do not run a live payment merely to
   validate the webhook. Stripe must show a successful delivery.
4. As an authenticated administrator, inspect
   `GET /api/admin/stripe/webhook-readiness`. Production live checkout stays
   blocked until this backend has verified and successfully processed a
   correctly signed event. Confirm `status: "healthy"` and a recent
   `lastVerifiedAt`. Production verification expires after 30 days without a
   successfully processed signed delivery, so repeat this check at least monthly.
5. Repeat verification whenever the live/test mode, API key, endpoint signing
   secret, or Stripe account configuration is changed. The health record is
   bound to a one-way fingerprint of the selected configuration; secret values
   are never stored in that record or returned by the endpoint.

Stripe does not provide a safe, read-only API call that proves a configured
webhook signing secret matches an endpoint before an event is delivered. The
backend therefore does not call Stripe on every checkout to inspect endpoints.
Only a Stripe-signed event successfully accepted by this backend establishes
readiness. After configuration rotation, production checkout fails closed until
the new configuration receives such a delivery. Production checkout also fails
closed when no successfully processed signed event has been received in the
last 30 days.

The health endpoint is read-only and protected by the admin router. Ordinary
users cannot mark an endpoint verified or clear a delivery problem.

## Subscription V1 removed; V2 incomplete

Legacy checkout, subscription-management, plan-catalogue, membership coupon, and
extra-contact endpoints return HTTP 503 with `SUBSCRIPTION_REBUILD_IN_PROGRESS`.
The V2 checkout endpoint is also disabled with `SUBSCRIPTION_V2_CHECKOUT_DISABLED`
unless explicitly enabled by server configuration. The existing webhook verifies
signatures using the raw request body; old subscription sessions/events are
acknowledged without state changes. Only server-marked V2 events reach the V2
processor. SafePay and unrelated payment/finance handlers remain active.

V2 models use separate collections, while `SubscriptionPlan` remains compatible with
the unchanged `subscriptionplans` collection and plan seed definitions. The obsolete
`subscriptions` collection and historical transactions are retained but no active
backend source code depends on the V1 subscription collection. No seed, migration,
or database cleanup has been run. Extra-contact purchases remain unavailable because
their fulfillment depended on V1 quota rules and V2 usage fulfillment is not yet
implemented.

## Verify provider finance history

1. Add the transfer and payout event types above to both the test and live
   destinations as applicable. The endpoint must be configured to deliver
   connected-account events.
2. In Stripe test mode, use a connected test account and create a test transfer
   and bank payout using Stripe's supported test flow. Do not create a live
   transfer or payout solely to test the application. Use Stripe Workbench's
   signed event delivery/resend capability for event processing checks.
3. Confirm the backend accepts the event (HTTP 2xx), and inspect the provider
   and administrator finance-history screens for the resulting record and
   correct test-mode label. A signature-verified event is not proof that an
   unrelated financial object belongs to the selected Jobblo provider; the
   backend scopes records to the connected account and verifies local payout
   account/mode details when available.
4. An administrator can run the read-only reconciliation endpoint for an
   explicit `test` or `live` mode to backfill missed history. This requires
   Stripe Connect account read/list permissions. A permission or API failure is
   reported as a failed account sync; it is not shown as a successful sync.
