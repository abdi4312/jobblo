# Subscription V2 database boundary

Phase 1 defines persistence; Phase 2 adds the feature-flagged checkout and verified
webhook boundary described below. Phase 3 adds feature-flagged cancellation,
resumption, paid-plan changes, and webhook-confirmed plan synchronization. Free
fallback and billing-period contact usage are described in Phase 4 below; grace
recovery is described in Phase 5 below; refunds are not implemented.

| Model | Collection | Responsibility |
| --- | --- | --- |
| `SubscriptionPlan` | `subscriptionplans` | Existing plan catalogue and unchanged seed compatibility |
| `SubscriptionV2` | `subscription_v2` | Current subscription snapshot plus plan-change history |
| `SubscriptionBillingOperationV2` | `subscription_billing_operations_v2` | Idempotency and outcome record for a billing operation |
| `SubscriptionUsagePeriod` | `subscription_usage_periods` | Included-contact and separately purchased-contact accounting by exact period |
| `SubscriptionWebhookEventV2` | `subscription_webhook_events_v2` | Mode-scoped, retryable webhook event ledger |
| `SubscriptionRecoveryEmailV2` | `subscription_recovery_emails_v2` | Idempotent recovery-email outbox and delivery attempts |

The `SubscriptionV2` collection is intentionally distinct from the historical
`subscriptions` collection. No application code reads or writes that historical
collection; it remains in MongoDB untouched and is not dropped. The `SubscriptionPlan`
model explicitly uses the existing `subscriptionplans` collection; its schema accepts
the unchanged `plan.seed.js` documents. Do not run the destructive seed script.

Future services should verify webhook signatures through the existing shared ingress,
record an event before processing, and use `(stripeMode, stripeEventId)` as the event
idempotency boundary. Create billing-operation records with a stable client/request
idempotency key before making a Stripe request; reuse that key for Stripe idempotency.
Apply state updates conditionally (compare current state/period) and keep each
operation's Stripe mode consistent across customer, subscription, event, and operation
references. Models do not enforce transitions; services must do so.

`SubscriptionV2` is a single current snapshot per user, enforced by its unique `userId`
index. A later subscription may replace the current Stripe ID while preserving prior
subscription and plan details in `planHistory`. Its exact period timestamps are the
source for creating a unique usage-period record. Included contacts are period-scoped
and do not roll over; extra-contact counts are tracked separately. Historic `User`
quota fields remain untouched until an explicit migration is designed.

The optional withdrawal-evidence snapshot stores the version and presentation time
of customer information, any early-service-start request and pro-rata-payment
acknowledgement, and a withdrawal resolution reference. A future phase must have
Norwegian consumer-law review determine the required wording, consent flow, retention,
and refund decisions; these fields do not implement or decide those rules. The
account-deletion billing safeguard verifies V2 subscriptions in their recorded Stripe
mode and blocks unresolved V2 checkout operations. It does not consult V1 data.

## Phase 2: checkout and webhook boundary

`POST /api/stripe/v2/create-checkout-session` is authenticated and accepts the
existing minimal request shape `{ "planId": "..." }`. The response on success is
`{ "url": "https://checkout.stripe.com/..." }`. `couponCode` is explicitly rejected
until V2 promotion rules exist; client-supplied price, customer, user, metadata, and
return URLs are ignored. Errors use `{ "code": "...", "message": "..." }`.

The route is disabled unless the server environment has
`SUBSCRIPTION_V2_CHECKOUT_ENABLED=true`; the default is OFF. No environment value is
changed by this work. A success redirect is never treated as payment evidence; the
legacy status endpoint stays disabled.

Checkout verifies the active plan, account type, positive NOK amount, mode-specific
Stripe Price and Product references, active monthly recurrence, and exact minor-unit
amount. It uses only the Stripe mode selected by the existing `STRIPE_TEST_MODE`
configuration and only a matching mode-specific customer/price. It does not create
Stripe Products or Prices. Checkout and customer creation use persisted operation
idempotency keys. A pending-checkout unique partial index plus a short atomic operation
lease serializes simultaneous requests.

| API surface | Current behavior |
| --- | --- |
| `POST /api/stripe/v2/create-checkout-session` | Authenticated; accepts `{ planId }`; returns `{ url }`; disabled by default with `503 SUBSCRIPTION_V2_CHECKOUT_DISABLED` |
| Legacy Stripe checkout/status and subscription management | `503 SUBSCRIPTION_REBUILD_IN_PROGRESS` by default; these URLs are V2 adapters when their required flags are enabled (see Phase 6) |
| Extra-contact checkout/status at `/api/stripe/create-extra-contact-payment` and `/api/stripe/extra-contact-status/:sessionId` | `503 SUBSCRIPTION_REBUILD_IN_PROGRESS`; purchase fulfillment remains disabled |
| Plan catalogue at `GET /api/plans` | Read-only active-plan projection when checkout is enabled; otherwise `503 SUBSCRIPTION_REBUILD_IN_PROGRESS` |
| Plan catalogue writes at `/api/plans` | `503 SUBSCRIPTION_REBUILD_IN_PROGRESS`; seed-defined plan data is not editable through these routes |
| Membership coupon CRUD and validation at `/api/coupons` | `503 SUBSCRIPTION_REBUILD_IN_PROGRESS`; legacy membership coupon endpoints only |
| Admin subscription billing and membership promotion-code routes | `503 SUBSCRIPTION_REBUILD_IN_PROGRESS` |
| Promotional campaign routes | Remain active and separate from membership subscriptions |

V2 checkout error codes include `SUBSCRIPTION_V2_CHECKOUT_DISABLED`,
`INVALID_PLAN_ID`, `PLAN_NOT_FOUND`, `plan_inactive`, `plan_type_not_allowed`,
`FREE_PLAN_CHECKOUT_NOT_ALLOWED`, `SUBSCRIPTION_PRICE_UNCONFIGURED`,
`SUBSCRIPTION_PRICE_INVALID`, `active_subscription_exists`,
`SUBSCRIPTION_STATUS_UNAVAILABLE`,
`SUBSCRIPTION_CHECKOUT_IN_PROGRESS`, `SUBSCRIPTION_PAYMENT_PENDING`, and
`STRIPE_CHECKOUT_UNAVAILABLE`. Responses do not contain Stripe customer/subscription
details or secrets.

Before checkout, the service checks the user's V2 record and pending V2 checkout
operation. A Stripe subscription already represented in V2 blocks another purchase;
unverifiable V2 state fails closed. It does not inspect historical V1 records or
enumerate the user's Stripe subscriptions. The supplied V2 feature flag must remain
off until any development environment's old Stripe objects have been separately
verified.

The existing raw-body Stripe endpoint and signature verification remain the sole
webhook ingress. V2 Checkout sessions are identified by server-generated
`subscriptionV2` metadata. Subscription sessions without that marker are acknowledged
without business-state changes; they cannot activate V2. SafePay sessions and
unrelated refunds, disputes, transfers, and payouts continue down their existing
handlers. V2 events are recorded in the separate
`subscription_webhook_events_v2` ledger, atomically claimed, and marked processed
only after their durable state update. Interrupted processing is retryable after a
stale claim. Business writes are idempotent so a retry after a partial write can
complete safely without a transaction-capable Mongo deployment.

## Phase 3: subscription management

Authenticated V2 management endpoints are available at:

| Route | Request | Behavior |
| --- | --- | --- |
| `GET /api/stripe/v2/subscription` | none | Returns the verified Stripe subscription snapshot |
| `POST /api/stripe/v2/subscription/cancel` | none | Stops renewal at the verified billing-period end; no proration |
| `POST /api/stripe/v2/subscription/resume` | none | Reverses period-end cancellation before expiry |
| `POST /api/stripe/v2/subscription/change/preview` | `{ "planId": "..." }` | Previews immediate-upgrade proration or downgrade effective date |
| `POST /api/stripe/v2/subscription/change` | `{ "planId": "..." }` | Applies a paid upgrade pending invoice payment or schedules a downgrade |

These endpoints require `SUBSCRIPTION_V2_MANAGEMENT_ENABLED=true`; the default is
OFF. They use the Stripe mode and subscription/customer IDs stored on the V2 record,
verify Stripe ownership and the current plan price before changing anything, and
serialize lifecycle operations with the billing-operation lock. Upgrade entitlement
state changes only after a verified paid invoice and canonical Stripe price; failed
or unknown outcomes remain locked for reconciliation. Downgrades retain the current
plan until a verified Stripe schedule reaches the target phase. The legacy URL
adapters are documented in Phase 6 and remain disabled by default.

Scheduling a downgrade first migrates the existing subscription with
`from_subscription`, then updates the returned schedule in a separate request.
Stripe rejects `end_behavior` when supplied alongside `from_subscription`, so the
schedule's `release` behavior is set on the update. Create and update use distinct,
stable idempotency keys. A Stripe 400 invalid-request response at the create stage is
recorded as a failed no-effect operation and releases its lifecycle lock; errors at
later stages, or errors without a definitive no-effect response, retain the lock and
record the failure stage and available Stripe request metadata for reconciliation.

Phase 3 does not implement plan-change cancellation, refunds, or consumer withdrawal
consent handling.

Activation requires a complete, paid Checkout session, matching user/plan/operation
metadata and Stripe mode, a canonical active Stripe subscription, one verified
monthly NOK price item, and its paid invoice. Renewal invoice events retrieve current
invoice and subscription state before updating the exact item period. Invoice
operations are keyed by Stripe invoice ID. Payment failures record retry state but do
not cancel; canceled state is synchronized without a Free-plan transition. Period
timestamps are read from the subscription item's `current_period_start` and
`current_period_end` fields in the installed Stripe SDK/API version
`2025-12-15.clover`, not approximated from the local clock.

The account-deletion safeguard checks pending/reconciliation checkout operations and
V2 subscriptions using their recorded Stripe mode. It still fails closed when
database or Stripe verification is unavailable. The admin overview's existing
`activeSubscriptions` metric now counts active V2 records.

### Deliberately deferred / not production-ready

- Grace-period automation and refund workflow remain absent.
- The old extra-contact purchase route remains unavailable because its fulfillment
  depended on V1 included-contact quota and has no V2 usage fulfillment yet. The
  unrelated SafePay one-time payment flow remains active.
- Membership coupon and promotion-code routes remain unavailable; separately managed
  promotional campaigns remain active.
- The existing UI and mobile APIs are unchanged; legacy web membership URLs have
  feature-gated V2 adapters, while mobile subscription compatibility is not enabled.
- Checkout, management, and entitlement feature flags are OFF by default and must
  remain OFF until the target MongoDB indexes, consumer-law review, webhook setup,
  and end-to-end testing are complete.
- The existing webhook configuration selects one Stripe mode at a time. Test and
  live events must use the matching selected mode and signing secret; events from the
  other mode are rejected by the shared dispatcher.
- Index declarations are part of the new V2 schemas; confirm index creation and
  uniqueness on the target MongoDB deployment before enabling flags. No migration,
  seed, or historical-record update is performed by Phases 1–3.

## Phase 4: entitlements and contact usage

`GET /api/stripe/v2/entitlements` returns the authenticated user's effective plan,
server-side plan entitlements, current included-contact quota, usage, and exact
period. It requires `SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED=true`; the default is OFF.
The same flag gates contact accounting on `POST /api/orders/request`; a contact is
consumed only after reserving a valid new application in that endpoint.
Chat creation, reading, and messaging never consume
contacts, including SafePay/contract chats. Each charge uses the exact `JobRequest`
ID (`job-request:<id>`), not a service or counterparty key, so a new application for
another job is a separate contact while retries of the same application cannot
double-charge. The explicitly enabled `FREE_PRIVATE_JOBS_UNDER_10000` global config
exempts private-account applications for services priced below 10,000 NOK; no plan
quotas or prices are changed. Invalid, duplicate, and failed application inserts
are not charged. A charge reserved for an insert failure is released only if that
exact JobRequest ID was not persisted. Once the application is durable, later chat
or notification errors do not release or repeat its charge. Withdrawal or owner
decline does not automatically restore a contact; no restoration/refund policy is
implemented here. Existing authorization rules still run before accounting.

For paid users, only an owned, mode-matched Stripe subscription and a paid
`SubscriptionUsagePeriod` covering the current instant grants paid benefits. If the
current record is missing, it is reconstructed only from a paid, mode-matched invoice
whose subscription, recurring price, and exact line period match Stripe's canonical
current subscription period. The period uses Stripe's item
`current_period_start`/`current_period_end`; cancellation retains access only to that
period. An expired/canceled private subscription resolves
to the active `Standard` Free plan and reads its included-contact allowance from the
plan document. A business account without a paid subscription has no plan and receives
zero included contacts; no business Free plan is invented. During configured Phase 5
grace, past-due accounts use only the previously verified paid usage period anchored
when recovery began.

Private Free periods use UTC calendar months (00:00 UTC on the first day through
00:00 UTC on the first of the next month). This is deterministic and intentionally
not a rolling 30-day window. Period records are created with `$setOnInsert`; repeated
reads and duplicate webhooks do not reset usage. A paid renewal creates a separate
record for Stripe's next exact period with zero included contacts, leaving old periods
stored. A confirmed upgrade updates only the current period allowance, preserving
consumed contacts; a downgrade retains the old plan until its verified target phase
starts, then creates the new period allowance without carrying unused contacts.
Resume does not alter usage.

Contact consumption is an atomic conditional update on the period record, guarded by
the remaining allowance and a single-use JobRequest operation ID stored in that same
document. Concurrent submissions cannot exceed the allowance; a duplicate-pending
unique index elects one application, and the losing request releases only its own
reservation. A released operation ID cannot be consumed again. Purchased
extra-contact counters remain separate from included usage and are never consumed or
cleared here. Extra-contact checkout/fulfillment remains disabled.

The usage index changed from unique `(subscriptionId, billingPeriodStart)` to unique
`(userId, billingPeriodStart)` so Stripe and Free periods share one canonical ledger.
Before enabling the entitlement flag on a database that already has the earlier V2
index, run `node scripts/migrate-subscription-usage-period-index.js` in the intended
environment. It only changes those indexes and does not modify documents or drop a
collection. This task did not run that script or connect to MongoDB.

Extra-contact fulfillment remains unimplemented. No frontend, mobile, or seed files
were changed, and no external Stripe or MongoDB data was changed.

## Phase 5: failed-payment recovery

Grace recovery applies only to an already-provisioned V2 subscription's failed
`subscription_cycle` invoice. Checkout failures are not provisioned and do not enter
grace. A verified `invoice.payment_failed` or
`invoice.payment_action_required` starts one seven-day deadline from Stripe's
failure-event timestamp. Repeated events for that invoice reuse the original
deadline; a later invoice cannot replace a retrying recovery.

During grace, entitlements read the exact previously paid usage period recorded at
recovery start; they do not create a renewal quota before payment succeeds. At the
deadline, entitlements stop paid access immediately even if the scheduler has not
yet reached Stripe. The recovery worker runs every minute, leases each record, then
re-fetches and verifies the subscription and invoice in the recorded Stripe mode.
It cancels an unpaid subscription without invoicing or proration, using a stable
`SubscriptionBillingOperationV2` ID/idempotency key. Unknown Stripe outcomes remain
available for retry/reconciliation. A verified payment before the deadline restores
the canonical paid period and cancels pending reminder emails; a payment at or after
the deadline does not restore paid access. No refund, replacement subscription, or
additional charge is created by this recovery code.

`GET /api/stripe/v2/subscription` includes the authenticated user's `paymentRecovery`
status, start time, deadline, remaining time, and `update_payment_method` action.
`POST /api/stripe/v2/subscription/portal` creates an authenticated Stripe Billing
Portal session using the V2 customer's recorded mode and a server-configured return
URL. Both routes require `SUBSCRIPTION_V2_MANAGEMENT_ENABLED=true`.

Recovery starts only when `SUBSCRIPTION_V2_GRACE_PERIOD_ENABLED=true`. The expiry
worker additionally requires `SUBSCRIPTION_V2_RECOVERY_JOB_ENABLED=true`; the
email outbox worker additionally requires
`SUBSCRIPTION_V2_RECOVERY_EMAILS_ENABLED=true`. All default to OFF. Email delivery
uses a durable, unique `(stripeMode, invoiceId, kind)` outbox with retry backoff and
stale-worker lease recovery. The default reminders are days 3 and 6; the optional
`SUBSCRIPTION_V2_RECOVERY_REMINDER_DAYS` setting accepts comma-separated days 1–6.
The existing scheduler polls recovery deadlines every minute and email delivery
every five minutes, but both workers remain no-ops while their flags are off.

Stripe Smart Retries are configured in Stripe Dashboard, not changed by this code.
Before enabling recovery in any Stripe mode, configure automatic collection and
Smart Retries for that mode, ensure retries do not extend beyond the seven-day
grace policy, and test payment recovery and cancellation behavior with that mode's
webhook signing secret. No Stripe Dashboard setting or live Stripe object was
changed as part of this work. `SUBSCRIPTION_V2_CHECKOUT_ENABLED`,
`SUBSCRIPTION_V2_MANAGEMENT_ENABLED`, and
`SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED` remain independently OFF by default.

Email templates use the existing SMTP configuration and link to the unchanged
subscription settings page. Set a trusted `FRONTEND_URL` and working SMTP
credentials before enabling email delivery. Stripe cancellation failures or
ownership mismatches require operational reconciliation; no automated refund or
manual billing action is performed.

### Historical V1 cleanup

The old `subscriptions` collection is retained but no active backend code reads or
writes it. Historical transaction fields and user plan/customer fields remain in the
shared schemas for data preservation; they do not run subscription logic. Obsolete
subscription dedupe and company-plan migration scripts were removed. Legacy
membership checkout and management routes are V2 compatibility adapters, disabled
by default. Promotion-code and extra-contact routes remain compatibility stubs only.
Extra-contact purchases remain unavailable until V2 usage accounting can fulfill
them; SafePay and unrelated payment routes are not disabled.

No UI, mobile, or seed files were changed, and no database data, Stripe Dashboard
configuration, or live Stripe object was changed. No data cleanup, seeder, migration,
or live Stripe request was run.

## Phase 6: unchanged web UI compatibility

The unchanged web UI contract was audited from `MembershipPage`, the settings
subscription view, the plan hooks, and the checkout success page. The server exposes
the following existing URLs as adapters to V2; all adapters are gated and remain
unavailable unless their listed flags are explicitly enabled. The common response
envelope for errors is `{ "code": "...", "message": "..." }`.

| Existing UI request | Enabled behavior | Flags |
| --- | --- | --- |
| `GET /api/plans` | Read-only array of active plans with `_id`, `name`, `price`, `type`, `entitlements`, `featuresText`, `features`, `freeViews`, and `pricePerExtraView`; no Stripe IDs are returned | Plan catalogue or Checkout |
| `POST /api/stripe/create-checkout-session` | Accepts `{ "planId": "..." }`; returns `{ "url": "..." }`. Unsupported coupon input is rejected by the V2 checkout service | Checkout |
| `GET /api/stripe/checkout-session/:sessionId` | Authenticated, owner-scoped, mode-verified read-only checkout projection (`payment_status`, `provisioning_status`, `checkout_status`, plan, amount, currency); does not provision | Checkout |
| `GET /api/stripe/subscription` | Returns `{ "subscription": ... }` with V2 plan/status, contact summary, billing dates, pending change, and recovery summary | Management + Entitlements |
| `POST /api/stripe/subscription/cancel` / `resume` | Existing V2 cancellation/resumption service | Management |
| `POST /api/stripe/subscription/portal` | Returns an ownership/mode-scoped V2 Billing Portal URL | Management |
| `POST /api/stripe/subscription/change/preview` / `change` | Existing V2 preview and paid-plan change service; preview accepts `{ "planId": "..." }` | Management |
| `POST /api/stripe/subscription/change/cancel` | Releases a verified scheduled downgrade; the current paid plan remains in effect | Management |
| `GET /api/stripe/subscription/billing-history` | Returns V2 invoices, payments projection, payment method, and billing address for the recorded V2 customer and Stripe mode | Management |
| `GET /api/stripe/subscription/invoices/:invoiceId/pdf` | Returns an invoice PDF URL only after checking invoice customer, subscription, and recorded Stripe mode | Management |

All legacy subscription adapters return exactly `503
SUBSCRIPTION_REBUILD_IN_PROGRESS` when their required flag is off, before
authentication or service execution. With flags on, they require authentication.
The V2-native `/api/stripe/v2/*` management routes remain available only through
their own V2 feature checks; the public legacy routes do not expose additional
management capabilities.

Scheduled downgrade cancellation validates the V2 ownership metadata, schedule
identity, target phase, recorded operation, and Stripe mode before releasing the
schedule. It clears the pending change only after Stripe confirms release; unknown
outcomes retain the billing-operation lock for reconciliation. Extra-contact
checkout/status, membership coupon/promotion-code, plan write, and admin membership
routes remain disabled. The ordinary
`/api/transactions/user` history endpoint remains unchanged and separate. The
legacy contact projection reads `totalPaidForExtraContacts` from succeeded,
non-refunded NOK extra-contact transaction rows scoped to the authenticated user;
this does not make extra-contact purchases available again. The
billing-history adapter returns only invoices associated with the V2 record's
current or recorded historical subscription IDs in its recorded Stripe mode; it
does not merge historical V1 invoices or test/live data.

| Flag | Gates | Default |
| --- | --- | --- |
| `SUBSCRIPTION_V2_PLAN_CATALOGUE_ENABLED` | Read-only plan catalogue without enabling payments | OFF |
| `SUBSCRIPTION_V2_CHECKOUT_ENABLED` | Legacy checkout and checkout status; also exposes the catalogue for the existing checkout flow | OFF |
| `SUBSCRIPTION_V2_MANAGEMENT_ENABLED` | Legacy status-management, portal, cancellation/resumption, changes, invoices | OFF |
| `SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED` | Legacy current-subscription/contact projection and contact entitlement flow | OFF |

The plan-catalogue flag does not enable Checkout. `/api/plans` remains read-only
and retains its existing route/authentication behavior. The Checkout flag also
continues to expose the catalogue when Checkout itself is enabled.

Checkout status verifies the session against its owned billing operation, recorded
customer and mode, session metadata, selected plan, currency, and expected server
price. Its result is read-only; the signed webhook remains the only provisioning
source. Invoice and PDF lookups use only V2-owned IDs and never trust a client
customer or subscription identifier. No V1 service is used by these adapters.

Signed V2 `subscription_schedule.created`, `.updated`, `.canceled`, `.released`,
and `.aborted` events are routed through the common webhook. Creation is
acknowledged without synchronizing because the initial schedule metadata does not
yet contain the target plan; the subsequent update is checked against the
canonical Stripe schedule and ownership records. Active schedules synchronize
the exact pending downgrade; canceled or pre-effective released/aborted schedules
clear only their matching pending change.
The schedule uses `end_behavior: release`, so completing its phases preserves the
underlying subscription. After the target phase begins, the existing subscription
and paid-invoice events remain authoritative for applying the new plan and contact
allowance.

No frontend, mobile, or seed files were modified for Phase 6. The compatibility
adapters do not change plan definitions, enable the flags, run migrations, or make
Stripe mutations during startup.
