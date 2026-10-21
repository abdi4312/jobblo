# Subscription Branch Code Review

**Date:** 2026-10-19  
**Branch:** `fixed/Subscription`  
**Audited HEAD:** `9a4a79aa703d6b53578fb5e95d26dacab6a239d1`  
**Pushed HEAD:** `origin/fixed/Subscription` at the same commit  
**Scope:** Read-only code, runtime, TEST billing, dependency, and regression audit. No application code, plans, seeds, feature flags, MongoDB records, Stripe objects, or SafePay records were changed. No commit, push, merge, or deployment was performed.

The worktree already contained eight staged files before this report was created. Those pre-existing changes are listed under [Branch and worktree state](#branch-and-worktree-state); this audit did not alter them.

## Executive summary

| Area | Finding |
|---|---|
| Subscription implementation | Active subscription operations route to V2 services. No reachable V1 subscription writer, checkout processor, renewal worker, or webhook processor was found. V1-named route adapters and disabled stubs remain. |
| Paid upgrades | Two unrelated TEST accounts have paid Stripe upgrades to Pro while their local V2 records remain Plus and their upgrade operations remain pending with lifecycle locks. This is confirmed; why the event processing did not reach this database is not verified. |
| Webhooks | Stripe signatures, mode, shared event IDs, and V2 event IDs have independent validation/idempotency paths. The six Stripe event IDs examined for the two stuck upgrades are absent from both ledgers in the current local database. Stripe event metadata cannot establish whether an event was delivered or replayed. |
| Scheduler isolation | The local frontend points directly to port 5001; the listener is PID 11380 (`node server.js`). `ENABLE_SCHEDULER` is absent from the local backend `.env`; the scheduler defaults to enabled. This is unsafe for isolated financial tests. |
| Dependencies | `npm audit --omit=dev`: backend 3 critical / 6 high / 3 moderate / 2 low; frontend 1 critical / 24 high / 8 moderate / 2 low. Several advisories are in direct packages with reachable application use; others are in unused or build-tool chains and are not confirmed exploitable. |
| Verification | Frontend production build succeeded; mocked Playwright passed 5/5. Full backend suite had 80/81 suites pass (1156/1157 tests). Frontend typecheck and lint fail on numerous current-project diagnostics. |
| Verdict | **Do not deploy to production yet.** Resolve the two paid TEST/local-state mismatches, establish reliable recovery for partially applied webhook changes, isolate test schedulers, and triage/update vulnerable dependencies before release. |

## Findings by severity

Counts below are repository findings, not raw npm advisory counts. Dependency advisory totals are reported separately.

| Severity | Count | Confirmed | Potential / not verified |
|---|---:|---:|---:|
| Critical | 0 confirmed code exploits; 2 dependency-chain findings | 0 | 2 (reachability not demonstrated) |
| High | 3 | 1 | 2 |
| Medium | 4 | 3 | 1 |
| Low | 0 | 0 | 0 |

### F-01 — Paid TEST upgrades are not reconciled locally

- **Severity:** High
- **Confidence:** Confirmed state divergence; root cause not verified.
- **Files / execution path:** `backend/services/subscriptions/v2Management.js:783-870`; `backend/services/subscriptions/v2WebhookProcessor.js:526-652, 1053-1109`; `backend/models/SubscriptionBillingOperationV2.js:8-50`.
- **Affected path:** Immediate V2 upgrade request, followed by signed Stripe subscription/invoice webhook processing.
- **Evidence:** Read-only checks against `127.0.0.1/jobblo-dev` and Stripe TEST account `acct_1T70Is3acMP9uu8L` found:

  | User | Operation | Stripe subscription | Stripe state | Invoice | Local V2 state |
  |---|---|---|---|---|---|
  | `6ad2cd95ea6a160f33f376f7` | `a60aca92-b2a2-4e5e-9044-d18ec3dd6a2d` | `sub_1URMb43acMP9uu8LjXu3vHrz` | Active, Pro price `price_1UQrra3acMP9uu8LK57Lc1LI`, TEST | `in_1USIZ03acMP9uu8LgLHZ2N3r`, paid, 4,584 minor units | Plus; operation pending; lifecycle lock held; no invoice ID recorded |
  | `6ad62d50328eff6b49248d0d` | `d6a0c297-7240-4005-b58d-4d7208637a88` | `sub_1USHtt3acMP9uu8LKk3OTIHU` | Active, same Pro price, TEST | `in_1USJWX3acMP9uu8LRLjbuZak`, paid, 4,988 minor units | Plus; operation pending; lifecycle lock held; no invoice ID recorded |

  Stripe customer metadata and local `User.stripeCustomerIdTest` match each operation owner. The paid invoices are subscription updates with Plus credit and Pro proration lines; payment intents succeeded. The retrieved invoice lists showed one upgrade invoice per subscription, not duplicate upgrade invoices. Refund status was not queried for these two accounts and is therefore **not verified**.

  The six matching Stripe subscription-update and invoice-paid event IDs examined were absent from both `subscription_webhook_events_v2` and `StripeEvent` in the current local database. This proves they are not recorded in this database; it does not distinguish absent delivery from processing in another database/process or later ledger loss. Stripe `request.id` and `request.idempotency_key` describe the API mutation request, not webhook delivery provenance.
- **Root cause:** Local plan/operation state was not advanced to the confirmed Stripe state. The missing ledger rows and unset operation invoice/error fields indicate that this local database has no recorded completion for the matching events. The exact reason those events did not result in local reconciliation is **NOT VERIFIED** without Stripe endpoint delivery logs and process-specific request logs.
- **Impact:** These customers have paid for Pro but local entitlements remain Plus, and the lifecycle lock blocks further subscription management. No evidence of duplicate upgrade billing was found in the inspected invoice lists.
- **Proposed fix:** Do not retry or reconcile by reusing old metadata. Obtain the original Stripe delivery records and verify the current canonical customer, subscription, price, paid invoice, event IDs, and exact local owner again. After explicit approval, reconcile only these two exact TEST operations transactionally: update each V2 plan/period/history and usage allowance to the verified Pro period, record the paid invoice ID, mark its operation succeeded, and clear its lock. Then add a general recovery path that can safely handle equivalent verified operations rather than relying on a one-account exception.
- **Existing tests:** `backend/__tests__/subscriptionV2Management.test.js:865` covers a verified paid-upgrade webhook; `backend/__tests__/subscriptionV2WebhookProcessor.test.js` covers payment verification, ownership, duplicate events, and retryable failures.
- **Missing regression:** A real-shaped paid update event with an operation in `pending` must reconcile a matching V2 owner and invoice, and a missing or ambiguous invoice/owner must retain the lock without granting the target plan.
- **Release risk:** **Blocker.** No records were changed during this audit.

### F-02 — A failure between plan update and operation completion can strand a paid upgrade

- **Severity:** High
- **Confidence:** Potential; confirmed by the non-transactional code path, not reproduced against data.
- **Files / execution path:** `backend/services/subscriptions/v2WebhookProcessor.js:526-652, 1053-1109, 1418-1435`.
- **Affected path:** V2 paid-upgrade webhook processor.
- **Root cause:** `applyVerifiedPlanChange` updates the subscription document, then updates the usage allowance, then completes the lifecycle operation. These are separate writes. If the usage write fails after the plan write, the webhook is marked retryable. On retry the existing plan already equals the target, so the subscription-update branch calls `updateSubscriptionState`; that path does not complete the upgrade operation. The webhook can finish while the upgrade operation remains pending and locked.
- **Impact:** A transient database failure can leave a paid plan applied but the billing operation locked; entitlement-period data can also lag the subscription record.
- **Reproduction evidence:** Static execution-path analysis; no live or mocked fault injection at the exact post-plan-update boundary was run.
- **Proposed fix:** Make the plan, allowance, and operation transition atomic where supported, or make webhook retries explicitly resume/complete the matching upgrade operation after re-verifying canonical Stripe state. Check matched update counts before reporting success.
- **Existing tests:** Paid upgrade reconciliation and generic webhook retry tests pass.
- **Missing regression:** Force the usage-period write to fail after the subscription-plan write, retry the same event, and assert the record, usage period, and operation all converge with no duplicate plan-history entry.
- **Release risk:** **Potential blocker** until fault-injection coverage and an idempotent recovery path exist.

### F-03 — Disabled compatibility routes can return the obsolete rebuild response before V2 controllers

- **Severity:** Medium
- **Confidence:** Confirmed.
- **Files / execution path:** `backend/routes/stripe.js:7-10, 28-37, 47-93`; `backend/middleware/subscriptionRebuildInProgress.js:1-5`; `backend/controllers/subscriptionV2Controller.js:14-20, 45-50`.
- **Affected paths:** Existing UI-compatible checkout, cancellation, resume, portal, billing-history, preview, and plan-change routes when their feature flags are off.
- **Root cause:** `compatibilityGate` returns `SUBSCRIPTION_REBUILD_IN_PROGRESS` before dispatching to the V2 controller whenever a required flag is false. Checkout and management controllers also contain V2-specific disabled responses, but the outer compatibility gate prevents those from being used on the old UI URLs. The route-level gate also executes before authentication.
- **Impact:** Supported V2 compatibility URLs present as a generic V1 rebuild rather than an explicit V2 feature-gate response. This is misleading and conflicts with the requirement that compatibility URLs dispatch to V2 with V2 policy. It does not execute V1 billing logic or mutate subscriptions.
- **Proposed fix:** Keep feature flags authoritative but have compatibility routes authenticate first and return the corresponding V2-disabled code from the V2 controller (or a V2-specific gate), not the legacy rebuild middleware. Leave intentionally retired extra-contact routes disabled.
- **Existing tests:** `backend/__tests__/subscriptionV2CompatibilityRoutes.test.js` and `backend/__tests__/subscriptionDisabledRoutes.test.js` test both compatibility and gated behavior; several expectations currently encode the generic rebuild response.
- **Missing regression:** With each feature flag off, call the authenticated compatibility route and assert the specific V2 disabled code; verify unauthenticated requests remain unauthorized and no Stripe service is called.
- **Release risk:** Medium; local management and checkout flags were on during this audit, so this response was not triggered by a live request.

### F-04 — Job-detail UI still bases quota/cooldown behavior on the V1 user counter

- **Severity:** Medium
- **Confidence:** Confirmed stale dependency; user-facing impact depends on account data.
- **Files / execution path:** `frontend/src/pages/JobListingDetailPage/JobListingDetailPage.tsx:222, 381`; `backend/models/User.js:215-224`; `backend/routes/stripe.js:40-41`.
- **Affected path:** Applying to a job after the displayed monthly quota is reached, and the old extra-contact purchase action.
- **Root cause:** The page reads `currentUser.monthlyContactUsage` and the old plan cooldown values to decide whether to show a timer; it also calls `/api/stripe/create-extra-contact-payment`. That endpoint is an unconditional 503 stub. Authoritative V2 contact consumption is instead done by `consumeApplicationContact` on a successful `POST /api/orders/request`.
- **Impact:** The page can display a stale or inaccurate quota/cooldown and expose a purchase path that always fails. The server-side V2 limit remains authoritative; no contact bypass was found.
- **Proposed fix:** In a later approved UI task, remove the legacy cooldown/purchase dependency or use the V2 entitlement summary as the only quota source. Do not remove persisted `monthlyContactUsage` data in this cleanup.
- **Existing tests:** Backend `backend/__tests__/jobRequestContactUsage.test.js` verifies authoritative server-side charging and reservation behavior.
- **Missing regression:** A browser test should show the V2 remaining balance, hide unavailable extra-contact purchase, and correctly render exhausted allowance.
- **Release risk:** Medium UX/compatibility issue, not a backend billing bypass.

### F-05 — Contact reservation and JobRequest creation are separate writes

- **Severity:** Medium
- **Confidence:** Potential.
- **Files / execution path:** `backend/services/subscriptions/v2Entitlements.js:374-454`; `backend/controllers/orderController.js:133-170`.
- **Affected path:** `POST /api/orders/request`.
- **Root cause:** The V2 usage document is atomically incremented before `JobRequest.create`. Normal insert failures release the reservation, but a process crash after the increment and before the insert cannot execute that release.
- **Impact:** In this narrow crash window, an included contact may be consumed without a durable application. This is not evidence of double-charging or a quota bypass.
- **Proposed fix:** Use a Mongo transaction for reservation plus application creation where deployment topology supports it, or add a durable pending-reservation/reconciliation state with an expiry. Do not change the contact rule.
- **Existing tests:** `backend/__tests__/jobRequestContactUsage.test.js:107-228` covers single consumption, duplicate submissions, insert-failure release, concurrency, and notification failure.
- **Missing regression:** Inject process-equivalent failure between reservation and insert and prove a bounded recovery releases only the orphaned reservation.
- **Release risk:** Medium; normal error paths and concurrency tests passed.

### F-06 — Local TEST backend starts the general scheduler by default

- **Severity:** Medium
- **Confidence:** Confirmed configuration risk; job execution during this audit was not triggered.
- **Files / execution path:** `backend/services/scheduler/index.js:20-48`; `backend/server.js:153-160`; `backend/services/scheduler/jobs.js:389-479`; `frontend/.env:1`; `frontend/vite.config.ts:23-29`.
- **Affected path:** Any local/test backend launched without an explicit `ENABLE_SCHEDULER=false`.
- **Evidence:** The current port-5001 listener is PID `11380`, executable `node.exe`, command line `node server.js`; a read-only `GET http://127.0.0.1:5001/api/plans` returned HTTP 200. The frontend `.env` points directly at `http://localhost:5001`, and backend `.env` sets `PORT=5001`. `ENABLE_SCHEDULER` is absent from the backend `.env`; code defaults it to enabled. The process working directory and inherited environment cannot be proven from the exposed process metadata, so the exact source checkout/environment loaded by PID 11380 is not fully verified.

  Earlier audit logs recorded `reconcileMoneyState` finding an unrelated completed/paid order with no payout record and `reconcileStripeFinancialHistory` refreshing two local transfer verification timestamps. No Stripe payment/payout mutation was observed. Those logs are separate from this read-only audit run.
- **Root cause:** A missing scheduler variable is treated as enabled, and the general scheduler includes money reconciliation, SafePay lifecycle jobs, Stripe financial history, and subscription recovery jobs.
- **Impact:** A browser/API test aimed at the ordinary local server can run scheduled reconciliation or SafePay jobs against the local database. The frontend’s absolute `VITE_MAIN_URL` bypasses the Vite proxy target, so changing only `VITE_PROXY_TARGET` does not isolate it.
- **Proposed fix:** For isolated tests, use a dedicated backend process and explicit TEST configuration, set `ENABLE_SCHEDULER=false`, set `VITE_MAIN_URL` to that process, and verify its PID, port, database name, Stripe mode, and feature flags before running. Do not change production scheduler defaults without separate review.
- **Existing tests:** Scheduler and V2 recovery jobs have flag-gated tests; the Playwright config uses a separate Vite server on port 5176 and mocked API responses.
- **Missing regression:** An isolated test-server startup check should fail if the selected API base points to a non-test backend or if the scheduler is enabled.
- **Release risk:** Medium operational risk for test isolation; no scheduler job was started by this audit.

### F-07 — Direct backend image/email dependencies have high advisories and reachable use

- **Severity:** High
- **Confidence:** Potentially exploitable package advisories; no exploit reproduced.
- **Files / execution path:** `backend/package.json:15-43`; `backend/middleware/upload.js:2, 14-18`; `backend/utils/emailService.js:1, 6-8, 85-87, 116-117`.
- **Affected paths:** User/job image upload processing through Sharp; SMTP email dispatch through Nodemailer.
- **Root cause:** Installed direct packages are within npm’s reported vulnerable ranges: `sharp@0.33.5` and `nodemailer@9.1.1`.
- **Evidence:** Backend `npm audit --omit=dev` reports Sharp high advisories inherited from `libvips`, `libheif`, and `librsvg`; npm reports a possible fixed Sharp version `0.35.5` as a semver-major update. Nodemailer high advisories include TLS-servername cache credential disclosure and address-parser denial-of-service cases; npm reports a fix but did not supply a concrete version in its JSON summary. Upload middleware limits file size and MIME types, but image parsers still process uploaded bytes. Email paths send to application recipients; no exploit path was demonstrated.
- **Impact:** Potential denial of service or image-parser exploitation; Nodemailer’s SMTP credential disclosure scenario requires its stated cross-tenant transport/DNS conditions. Treat as potentially reachable, not as a confirmed exploit.
- **Proposed fix:** Review vendor advisories and use the smallest supported patched releases, then run upload, email, and subscription recovery tests. Do not blindly apply `npm audit fix --force`.
- **Existing tests:** Backend upload and email behavior have project tests; subscription recovery email tests mock Nodemailer.
- **Missing regression:** Add bounded adversarial image/parser input coverage and transport reuse tests matching the relevant advisories.
- **Release risk:** High until patched versions and application usage are reviewed.

### F-08 — Critical dependency advisories are present but no application path was found

- **Severity:** Critical advisory rating; reachability not confirmed.
- **Confidence:** Potential / not applicable to normal runtime based on inspected call sites.
- **Files / dependency chains:** `backend/package.json:15-43`; `frontend/package.json:15-68`; backend `jade -> constantinople / transformers / uglify-js`; frontend `shadcn -> @modelcontextprotocol/sdk -> express -> proxy-addr`.
- **Affected paths:** Template compilation if Jade is invoked; MCP/Express proxy handling if the frontend `shadcn` CLI/server chain is executed.
- **Root cause:** The production-only npm audits report three backend critical package advisories in the direct `jade@1.11.0` dependency chain and one frontend critical `proxy-addr` advisory (`proxy-addr@2.0.7`, affected range through `2.0.7`).
- **Reachability evidence:** No Jade import, `res.render`, or Express view-engine configuration was found in backend source. Frontend `proxy-addr` is nested under the `shadcn`/MCP SDK package tree, not the built browser application; `shadcn` is used as a component/tooling dependency, and no server-side import was found in frontend source. Backend Express resolves `proxy-addr@2.0.8`, outside the reported vulnerable range. This does not prove no build-time or indirect invocation exists.
- **Impact:** Critical only if vulnerable template/proxy code is invoked under attacker-controlled input and affected preconditions. No such application execution path was established.
- **Proposed fix:** Remove or replace the unused Jade dependency after verifying no external deployment hook relies on it; update the frontend tooling chain to a patched resolution and consider moving CLI-only packages to development dependencies. Npm’s report suggests a major-version change for the Jade chain and does not name a specific proxy-addr fix; verify versions before changing lockfiles.
- **Existing tests:** No application tests directly exercise Jade or the frontend MCP server chain.
- **Missing regression:** Dependency-tree verification and production-bundle checks should confirm these packages are absent or not invoked in deployed runtime.
- **Release risk:** Do not label these as confirmed exploitable app vulnerabilities; clear the critical audit findings before production release.

## Dependency vulnerability matrix

`npm audit --omit=dev` reported the following package totals. These are advisory counts, not counts of confirmed exploitable application flaws.

| Project | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Backend | 3 | 6 | 3 | 2 | 14 |
| Frontend | 1 | 24 | 8 | 2 | 35 |
| **Combined** | **4** | **30** | **11** | **4** | **49** |

| Package (installed) | Direct/transitive and execution | Reported severity / vulnerable range | Fix information from npm audit | Reachability assessment |
|---|---|---|---|---|
| `jade@1.11.0` | Backend direct dependency | Critical; audit reports Jade and transitive `constantinople <3.1.1`, `uglify-js <=2.5.0`, plus related chain advisories | Audit suggests `jade@1.9.2` as a major change; do not assume this is the safe update without checking package advisories | No backend source import or template rendering found; not confirmed reachable |
| `sharp@0.33.5` | Backend direct; upload middleware | High; libvips/libheif/librsvg advisory chain | Audit suggests `sharp@0.35.5` (major) | Image upload bytes reach Sharp; potentially reachable |
| `nodemailer@9.1.1` | Backend direct; mail utility | High; TLS transport/DNS cache and address-parser advisories, including DoS | `fixAvailable=true`; exact version not provided in audit summary | Email code uses it; potentially reachable under advisory preconditions |
| `nodemon@3.1.14`, `chokidar`, `braces` | Backend direct package and watcher chain | High; nested-pattern stack exhaustion / watcher advisories | Npm proposes a major package change; verify supported release rather than downgrade blindly | Script invokes nodemon; primarily process-start/watch tooling |
| `morgan@1.9.1`, `on-headers` | Backend direct logging chain | Moderate/low; log forging and header manipulation | Npm suggests `morgan@1.12.1` | Request-derived logging is live; low impact log integrity hardening |
| `axios@1.13.5` | Frontend direct; also backend dependency | High; audit reports SSRF/proxy bypass, prototype-pollution gadgets, request/response tampering, header injection, and DoS ranges | `fixAvailable=true`; audit output does not name a concrete version | Frontend uses Axios for API calls; browser-only execution excludes several Node adapter SSRF cases, but not every config/prototype gadget is proven unreachable |
| `react-router-dom@7.13.0` | Frontend direct | High; audit range includes `7.0.0-pre.0` through `7.14.1` | `fixAvailable=true` | Normal client route handling is active; evaluate affected advisory preconditions and update |
| `proxy-addr@2.0.7` | Frontend transitive via `shadcn@4.6.0` -> MCP SDK -> Express | Critical; `1.1.0 - 2.0.7`, IPv4-mapped IPv6 trust-subnet spoofing | `fixAvailable=true`; exact version not emitted | Tool/server dependency chain, not browser bundle; not confirmed deployed runtime |
| `shadcn@4.6.0`, `fast-glob`, `micromatch`, `ts-morph` | Frontend direct CLI package and transitive chain | High; file matching / parser issues | Npm suggests major changes for some fixes | No import of the `shadcn` CLI package was found in frontend source; the separate `@shadcn/react` package is imported by UI components. Treat as build/developer tooling until its execution is verified. |
| `vite@7.1.11` | Frontend dev dependency and build-plugin dependency | High; dev-server path traversal/file-read advisories | Audit suggests `vite@7.3.7` | Build/dev server, not production browser runtime; remains relevant to developer/build infrastructure |
| `proxy-addr@2.0.8` | Backend transitive under Express | Not reported by backend audit; outside the frontend advisory’s vulnerable range | No backend fix indicated by this audit | Backend proxy trust handling uses this version; no current advisory finding |
| Other transitive entries (`gaxios`, `uuid`, `form-data`, `follow-redirects`, `ws`, `postcss`, `fast-uri`, `ip-address`, etc.) | Both lockfiles; details in npm audit output | Included in the totals above | Many report `fixAvailable=true`; some require a major parent update | Reachability varies by package chain; not individually shown to be exploitable in Jobblo |

**Triage limits:** The audit summary verifies installed versions, advisory ranges, package chains, and npm’s `fixAvailable` result. It does not prove exploitation. In particular, Axios Node-adapter SSRF findings are not equivalent to browser exposure; Vite and MCP findings are tooling/server surfaces; Jade has no source call site; and the Sharp/Nodemailer findings require advisory-specific exploit preconditions. Review current upstream advisory details and lockfile resolutions before updating.

## V1 / V2 conflict inventory

| Classification | Current code/evidence | Decision |
|---|---|---|
| 1. Active V2 implementation | `backend/services/subscriptions/v2Checkout.js`, `v2Management.js`, `v2Entitlements.js`, `v2RecoveryPolicy.js`, `v2WebhookProcessor.js`; models `SubscriptionV2`, `SubscriptionBillingOperationV2`, `SubscriptionUsagePeriod`, `SubscriptionWebhookEventV2` | Keep. These are the active subscription system. |
| 2. V2 compatibility API adapter | `backend/routes/stripe.js` maps existing `/api/stripe/subscription*` URLs to `subscriptionV2Controller`; `getLegacySubscription` constructs the legacy-shaped response using V2 entitlement/management services | Keep for existing UI URLs; rename legacy identifiers only in a separately authorized cleanup. |
| 3. Active non-subscription dependency | `backend/services/stripe/subscriptionState.js` is used by account deletion to block deletion for billing-capable V2 subscriptions; shared Stripe webhook dispatcher also handles SafePay, transfers, payouts, disputes, and refunds | Keep; these are active safeguards/shared payment infrastructure. |
| 4. Unused V1 implementation | `backend/controllers/stripeController.js` and `stripeBillingController.js` are absent. No `Subscription` model import or legacy renewal writer was found. Unmarked legacy subscription webhook events are acknowledged without invoking a V1 processor. Old extra-contact and plan mutation endpoints return a 503 stub. | No reachable V1 subscription business logic found. No V1 code was removed in this audit. |
| 5. Historical data / migration | `User.monthlyContactUsage`, `Transaction` rows of type `extra_contact`, `SubscriptionPlan`, Stripe customer identifiers, and historical invoices are retained. `monthlyContactUsage` has no active backend writer in the inspected code but is still projected to/read by the web UI. | Preserve. No data, collection, seed, or migration changes were made. |
| 6. Ambiguous / investigate | The job-detail page still consumes V1-style `monthlyContactUsage` and calls the disabled extra-contact endpoint. Route-level compatibility gates still use the rebuild middleware for supported V2 mutation aliases when a flag is off. | No destructive cleanup until UI and rollout compatibility are explicitly addressed. |

**Conclusion:** No active V1 subscription checkout, upgrade/downgrade, cancellation, renewal, entitlement, or webhook business logic was found. The `SUBSCRIPTION_REBUILD_IN_PROGRESS` middleware is still reachable for disabled compatibility gates, catalogue-off behavior, and retired extra-contact/admin endpoints. This is stale response behavior, not a V1 payment implementation.

## Stripe billing lifecycle matrix

| Flow | V2 implementation / evidence | Result |
|---|---|---|
| Catalogue | `GET /api/plans` uses `getPlanCatalogue`; current local port 5001 returned HTTP 200. Catalogue flag or checkout flag controls access. | Verified read-only response; no seed changes. |
| Checkout | Compatibility checkout route calls V2 checkout service and checks the checkout flag. Unit tests cover checkout validation/idempotency. | Code path present; no real checkout was started. Local checkout flag is `true`, so do not use this server for casual UI tests. |
| Upgrade | Immediate prorated Stripe update uses a persisted operation and idempotency key; webhook checks a paid canonical invoice before changing the local plan. Mock tests pass. | Two unrelated TEST upgrades remain paid at Stripe but Plus/pending/locked in Mongo; release blocker. |
| Downgrade | Stripe schedule is created/verified for period end; local plan is retained until target phase. | Mock tests pass. User A’s previously verified schedule remained intact; no schedule changed during this audit. |
| Cancellation / resume | Period-end cancellation and resume use V2 subscription-management operations. | Mock tests pass. User B’s existing TEST cancellation state was not changed. |
| Renewal / grace | V2 recovery policy and scheduler jobs are feature-flagged; tests cover paid renewal, seven-day grace, retry and expiry behaviors. | Mock tests pass; no real renewal or billing-clock change. |
| Contact allowance | V2 usage-period model and atomic quota update; called only from the job-application creation path. Chat code does not consume contacts. | Contact usage tests passed. A process-crash window between reservation and application insert remains a potential orphan reservation. |
| Webhooks | Raw-body endpoint, signature check, mode check, shared `StripeEvent` ledger, plus V2 event ledger; V2 metadata routes subscription events into V2 only. | Signature/idempotency tests passed. Delivery provenance is not persisted; six events for the stuck upgrades are missing from local ledgers. |
| Duplicate billing | Checkout and management operation keys persist across retries; Stripe update keys include mode and operation key. | No duplicate upgrade invoice found in the retrieved invoice lists. This is not a guarantee against every unexamined payment object. |

## Frontend API compatibility matrix

| URL | Current backend mapping | Gate / behavior | Result |
|---|---|---|---|
| `GET /api/plans` | `routes/subscriptionPlan.js` -> V2 catalogue controller | Catalogue policy; checkout also enables read | Local read returned 200. |
| `GET /api/stripe/subscription` | Authenticated V2 compatibility summary (`getLegacySubscription`) | Existing V2 owners retain read access when management/entitlements flags are off; non-owners remain gated | Code path is V2-only; no live authenticated account request was made in this audit. |
| `POST /api/stripe/create-checkout-session` | Compatibility route -> V2 checkout controller/service | Checkout flag required | No payment request made. When OFF, route middleware currently returns the old rebuild code instead of the controller’s V2 checkout-disabled code. |
| `POST /api/stripe/subscription/change*` | Compatibility URLs -> V2 preview/change/scheduled-change services | Management flag required | Mock tests cover preview, upgrade, downgrade, and cancel-plan-change. Route gate can return old rebuild code before the V2 controller when OFF. |
| Cancel / resume / portal / billing history / invoice PDF | Compatibility URLs -> V2 management services | Management flag required | Mock tests cover the service/API mapping; no real Stripe action was performed. The staged local portal/recovery link points to `/settings/subscriptions`, matching the current frontend route. |
| Extra-contact checkout/status | Disabled backend stub; frontend still calls extra-contact checkout | Always 503 `SUBSCRIPTION_REBUILD_IN_PROGRESS` | Confirmed dead frontend dependency; no V1 charge path. |

## Dependency security triage

See [Dependency vulnerability matrix](#dependency-vulnerability-matrix) for versions, ranges, fixes, and reachability. The highest-priority runtime review is `sharp@0.33.5` (untrusted uploaded image processing) and `nodemailer@9.1.1` (active mail transport). `jade` and frontend `proxy-addr` have critical npm advisory ratings, but no normal application runtime call site was found. `proxy-addr@2.0.8` in the backend is not in the frontend’s affected range. Do not run `npm audit fix --force` without compatibility review.

## SafePay and scheduler isolation

SafePay remains a separate matter. Earlier read-only TEST inspection found order `6a982fc4c9f28a8d07c772c4` completed/paid with no local payout/transfer record, missing `checkoutMode`, and a `PAYOUT_MODE_UNKNOWN` reconciliation error; the associated PaymentIntent was unavailable in the selected TEST account at that time. This is **not evidence of a live financial loss**, and it is not related to the subscription lock findings. SafePay records and code were not changed. Re-verify that order and payout evidence separately before making any SafePay conclusion or repair.

For isolated TEST UI work:

1. Launch a dedicated backend process against the explicitly approved local TEST database and TEST Stripe configuration.
2. Set `ENABLE_SCHEDULER=false` for that process; do not change production scheduler behavior.
3. Set `VITE_MAIN_URL` to the dedicated backend URL. Changing only `VITE_PROXY_TARGET` does not change the absolute API URL used by `mainLink`.
4. Before testing, verify listener PID, script path/working directory, database name, `GET /api/plans`, Stripe mode report, and flags. Do not submit checkout or lifecycle mutations during an audit.
5. Keep mocked Playwright tests on their isolated Vite server/API mocks; do not point them at port 5001.

## Test results

| Check | Result |
|---|---|
| Backend full Jest suite | **Failed:** 80/81 suites passed; 1156/1157 tests passed. The failing test is `backend/__tests__/vippsOAuthState.test.js`, “keeps the pending state when an unrelated callback fails validation” (`session.vippsAuth` was undefined at line 187). This is unrelated to subscriptions; baseline provenance was not checked. |
| Subscription V2, webhook, and SafePay tests | Included in the full backend run; all their suites passed. Coverage included checkout, management, recovery/grace, contact usage, route compatibility, webhook idempotency, and SafePay regressions. |
| Frontend production build | **Passed.** Vite warned about `eval` in `lottie-web` and emitted large chunks (largest listed about 1.2 MB before gzip). |
| Frontend TypeScript typecheck | **Failed:** 252 `error TS` diagnostics counted in output, across existing files including unused React imports and a `UserTerm` style typing error. |
| Frontend ESLint | **Failed:** 312 problems (301 errors, 11 warnings) across the project. |
| Playwright customer UI | **Passed:** 5/5 Chromium tests, using mocked API/Stripe responses on port 5176. This is repeatable UI regression coverage, **not** real financial E2E coverage. |
| `npm audit --omit=dev` | Backend: 14 advisories; frontend: 35. No dependency changes were made. |
| Real Stripe TEST | Read-only verification only. No new Checkout, charge, invoice, refund, schedule change, upgrade, downgrade, cancellation, or clock advance. |
| MongoDB | Read-only queries against `127.0.0.1/jobblo-dev` only. No record writes or schema/data changes. |

## Production-readiness blockers

1. **Two TEST upgrade records remain out of sync and locked.** Obtain webhook delivery evidence and explicit approval before any record reconciliation.
2. **General paid-upgrade retry/recovery needs a fault-safe completion path.** The current hard-coded recovery helper is restricted to a different known operation; it is not a general repair path for these two records.
3. **Local scheduler isolation is unsafe by default.** Explicitly disable it for isolated TEST processes and verify the selected backend/database before test activity.
4. **High and critical dependency advisories remain unresolved.** Confirm application reachability and update direct runtime packages with regression coverage; remove unused critical chains where safe.
5. **Frontend validation is not green.** Typecheck and lint failures remain, even though the production build and mocked Playwright suite pass.
6. **SafePay mismatch remains a separate unverified investigation.** Do not combine it with subscription reconciliation.

## Final verdict

| Question | Answer |
|---|---|
| Is Subscription V2 safe to deploy? | **No.** Keep deployment blocked until the two locked paid TEST upgrades are understood/reconciled safely and the recovery, scheduler-isolation, and dependency risks are addressed. |
| Can V1 still execute subscription business logic? | **No reachable V1 billing writer or processor found.** Legacy-named adapters call V2; some routes still return the old disabled response. |
| Can duplicate charges occur? | **Not observed** in the inspected TEST invoices; idempotency is present. This audit cannot prove absence for all accounts or all event-delivery histories. |
| Can a user gain paid benefits without payment? | V2 checkout/upgrade paths verify paid canonical invoices before activation/upgrade. **No unauthorized grant was observed.** |
| Can contacts be double-charged or bypassed? | No active V1 contact writer found; the server-side V2 reservation is atomic and tests cover duplicate/concurrent applications. A narrow crash window can consume a contact without a durable application. |
| Can a billing operation become stuck? | **Yes.** Two current TEST upgrade operations are pending with lifecycle locks; the partial-webhook-write path is an additional potential cause. |
| Can webhooks process the same event twice? | Duplicate event IDs are protected by shared and V2 ledgers and tests pass. The two unresolved events are missing from the current local ledgers; delivery provenance is not stored. |
| Are TEST/LIVE environments isolated? | Stripe config separates keys/secrets and validates `livemode`; inspected subscription events were TEST (`livemode=false`). The selected backend process’s exact working directory and inherited environment were not fully verifiable from process metadata. |
| Which defects must be fixed before release? | Resolve the paid/local state divergence under approval, make upgrade processing recoverable after partial writes, isolate schedulers in TEST, and triage/update vulnerable runtime dependencies. |

## Branch and worktree state

- `HEAD` and `origin/fixed/Subscription` both equal `9a4a79aa703d6b53578fb5e95d26dacab6a239d1`.
- Existing staged work at audit start: eight paths, **402 insertions / 9 deletions**:
  - `backend/__tests__/subscriptionRecoveryEmail.test.js`
  - `backend/__tests__/subscriptionV2Management.test.js`
  - `backend/services/subscriptions/v2Management.js`
  - `backend/utils/emailService.js`
  - `frontend/e2e/membership.spec.js`
  - `frontend/package-lock.json`
  - `frontend/package.json`
  - `frontend/playwright.config.js`
- Those staged changes include a billing portal/recovery URL correction to `/settings/subscriptions` and the mocked Playwright suite. They are not part of the pushed HEAD. No staged changes were modified by this audit.
- The only file created by this audit is `docs/audits/SUBSCRIPTION_BRANCH_CODE_REVIEW.md`. It remains uncommitted and unstaged.
